import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { ImapConnectConfig } from "@/lib/data/imap-accounts";

export type ImapListedMessage = {
  uid: number;
  subject: string;
  from: string;
  date: string | null;
};

export type ImapFolderInfo = {
  path: string;
  name: string;
  /** z. B. \Inbox, \Sent – wenn der Server es setzt */
  special_use: string | null;
};

const MAILBOX_MAX_LEN = 500;

/** Validiert den Ordnerpfad für IMAP SELECT (UTF-8 wie ImapFlow). */
export function parseImapMailboxPath(raw: unknown): { ok: true; path: string } | { ok: false; error: string } {
  if (raw == null || raw === "") {
    return { ok: true, path: "INBOX" };
  }
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!s) {
    return { ok: true, path: "INBOX" };
  }
  if (s.length > MAILBOX_MAX_LEN) {
    return { ok: false, error: `Ordnerpfad zu lang (max. ${MAILBOX_MAX_LEN} Zeichen).` };
  }
  if (/[\r\n\x00]/.test(s)) {
    return { ok: false, error: "Ungültiger Ordnerpfad." };
  }
  return { ok: true, path: s };
}

function clientFor(cfg: ImapConnectConfig): ImapFlow {
  return new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.email, pass: cfg.password },
    logger: false,
  });
}

export async function testImapConnection(cfg: ImapConnectConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = clientFor(cfg);
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    await client.logout();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "IMAP-Verbindung fehlgeschlagen";
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error:
        msg.length > 200
          ? `${msg.slice(0, 200)}…`
          : msg || "IMAP: Anmeldung abgelehnt oder Server nicht erreichbar.",
    };
  }
}

function envelopeSubject(env: { subject?: unknown }): string {
  const s = env?.subject;
  if (typeof s === "string" && s.trim()) return s.trim();
  return "(Ohne Betreff)";
}

function envelopeFrom(env: { from?: Array<{ name?: string; address?: string }> }): string {
  if (!env.from?.length) return "";
  return env.from
    .map((a) => (a.name ? `${a.name} <${a.address ?? ""}>` : (a.address ?? "")))
    .filter(Boolean)
    .join(", ");
}

function normalizeDate(d: Date | undefined | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const MAX_LISTED_FOLDERS = 250;

/**
 * Alle wählbaren IMAP-Ordner (Pfade), alphabetisch. Hilft beim Finden exakter Pfade für Unterordner.
 */
export async function listImapMailboxPaths(
  cfg: ImapConnectConfig,
): Promise<
  | { ok: true; delimiter: string; folders: ImapFolderInfo[]; list_truncated: boolean }
  | { ok: false; error: string }
> {
  const client = clientFor(cfg);
  try {
    await client.connect();
    const entries = await client.list();
    await client.logout();

    const folders: ImapFolderInfo[] = entries
      .map((e) => ({
        path: e.path,
        name: e.name,
        special_use: e.specialUse ?? null,
      }))
      .sort((a, b) => a.path.localeCompare(b.path, "de"));

    const delimiter = entries[0]?.delimiter ?? ".";
    const list_truncated = folders.length > MAX_LISTED_FOLDERS;

    return {
      ok: true,
      delimiter,
      list_truncated,
      folders: folders.slice(0, MAX_LISTED_FOLDERS),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "IMAP: Ordner konnten nicht gelistet werden";
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg.length > 220 ? `${msg.slice(0, 220)}…` : msg };
  }
}

/**
 * Die letzten Nachrichten aus einem Ordner (nach Datum absteigend), nur Metadaten.
 */
export async function listRecentMailboxMessages(
  cfg: ImapConnectConfig,
  mailboxPath: string,
  options: { limit: number; sinceDays?: number },
): Promise<{ ok: true; messages: ImapListedMessage[] } | { ok: false; error: string }> {
  const limit = Math.min(Math.max(1, options.limit), 30);
  const client = clientFor(cfg);
  try {
    await client.connect();
    const box = await client.mailboxOpen(mailboxPath);
    const exists = box.exists ?? 0;
    if (exists === 0) {
      await client.logout();
      return { ok: true, messages: [] };
    }
    const fromSeq = Math.max(1, exists - Math.max(limit * 3, limit) + 1);
    const items: ImapListedMessage[] = [];
    const sinceCut =
      options.sinceDays != null && options.sinceDays > 0
        ? new Date(Date.now() - options.sinceDays * 86_400_000)
        : null;

    const lock = await client.getMailboxLock(mailboxPath);
    try {
      for await (const msg of client.fetch(`${fromSeq}:${exists}`, {
        uid: true,
        envelope: true,
        internalDate: true,
      })) {
        const internal = msg.internalDate ? new Date(msg.internalDate) : undefined;
        if (sinceCut && internal && internal < sinceCut) continue;
        if (typeof msg.uid !== "number") continue;
        items.push({
          uid: msg.uid,
          subject: envelopeSubject(msg.envelope ?? {}),
          from: envelopeFrom(msg.envelope ?? {}),
          date: normalizeDate(internal),
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();

    items.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return tb - ta;
    });
    return { ok: true, messages: items.slice(0, limit) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "IMAP: Postfach konnte nicht gelesen werden";
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg.length > 220 ? `${msg.slice(0, 220)}…` : msg };
  }
}

/**
 * Volltext (plain bevorzugt, sonst HTML bereinigt), gekappt.
 */
export async function fetchMailboxMessageBody(
  cfg: ImapConnectConfig,
  mailboxPath: string,
  uid: number,
  maxChars: number,
): Promise<
  | {
      ok: true;
      subject: string;
      from: string;
      date: string | null;
      body: string;
      truncated: boolean;
    }
  | { ok: false; error: string }
> {
  const max = Math.min(Math.max(500, maxChars), 24_000);
  const client = clientFor(cfg);
  try {
    await client.connect();
    await client.mailboxOpen(mailboxPath);
    const lock = await client.getMailboxLock(mailboxPath);
    let msg: Awaited<ReturnType<typeof client.fetchOne>> = false;
    try {
      msg = await client.fetchOne(
        String(uid),
        { envelope: true, internalDate: true, source: true, uid: true },
        { uid: true },
      );
    } finally {
      lock.release();
    }
    await client.logout();

    if (!msg || !msg.source) {
      return { ok: false, error: "Nachricht nicht gefunden (falsche UID, falscher Ordner oder gelöscht)." };
    }

    const parsed = await simpleParser(msg.source);
    const subject = typeof parsed.subject === "string" && parsed.subject.trim() ? parsed.subject.trim() : "(Ohne Betreff)";
    const from = parsed.from
      ? parsed.from.value.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ")
      : "";
    const date = parsed.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date.toISOString() : null;
    let text = (parsed.text && parsed.text.trim()) || "";
    if (!text && parsed.html) {
      text = parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    const truncated = text.length > max;
    if (truncated) {
      text = `${text.slice(0, max)}…`;
    }
    return { ok: true, subject, from, date, body: text || "(Kein lesbarer Textinhalt)", truncated };
  } catch (e) {
    const msgErr = e instanceof Error ? e.message : "E-Mail konnte nicht gelesen werden";
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    return { ok: false, error: msgErr.length > 220 ? `${msgErr.slice(0, 220)}…` : msgErr };
  }
}
