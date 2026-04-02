import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { ImapConnectConfig } from "@/lib/data/imap-accounts";

export type ImapListedMessage = {
  uid: number;
  subject: string;
  from: string;
  date: string | null;
};

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

/**
 * Die letzten Nachrichten aus INBOX (nach Datum absteigend), nur Metadaten.
 */
export async function listRecentInboxMessages(
  cfg: ImapConnectConfig,
  options: { limit: number; sinceDays?: number },
): Promise<{ ok: true; messages: ImapListedMessage[] } | { ok: false; error: string }> {
  const limit = Math.min(Math.max(1, options.limit), 30);
  const client = clientFor(cfg);
  try {
    await client.connect();
    const inbox = await client.mailboxOpen("INBOX");
    const exists = inbox.exists ?? 0;
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

    const lock = await client.getMailboxLock("INBOX");
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
export async function fetchInboxMessageBody(
  cfg: ImapConnectConfig,
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
    await client.mailboxOpen("INBOX");
    const lock = await client.getMailboxLock("INBOX");
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
      return { ok: false, error: "Nachricht nicht gefunden (falsche UID oder gelöscht)." };
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
