import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  deleteImapAccountForUser,
  findImapAccountMetaByUserId,
  upsertImapAccountForUser,
} from "@/lib/data/imap-accounts";
import { testImapConnection } from "@/lib/imap/read-mail";

export const runtime = "nodejs";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const pre = local.length <= 2 ? local[0] ?? "" : local.slice(0, 2);
  return `${pre}***@${domain}`;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const row = await findImapAccountMetaByUserId(session.userId);
  if (!row) {
    return NextResponse.json({ connected: false });
  }
  const updated =
    row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
  return NextResponse.json({
    connected: true,
    email_masked: maskEmail(row.email_address),
    imap_host: row.imap_host,
    imap_port: row.imap_port,
    updated_at: updated,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const email = String(o.email ?? "").trim();
  const password = String(o.password ?? "");
  const imap_host = String(o.imap_host ?? "imap.strato.de").trim() || "imap.strato.de";
  let imap_port = Number(o.imap_port);
  if (!Number.isFinite(imap_port) || imap_port <= 0) imap_port = 993;
  if (imap_port > 65535) imap_port = 993;
  const use_tls = o.use_tls !== false;

  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail-Adresse und Passwort sind erforderlich." }, { status: 400 });
  }

  const tested = await testImapConnection({
    email,
    host: imap_host,
    port: imap_port,
    secure: imap_port === 993,
    password,
  });
  if (!tested.ok) {
    return NextResponse.json(
      { error: tested.error || "IMAP-Login fehlgeschlagen." },
      { status: 400 },
    );
  }

  try {
    await upsertImapAccountForUser(session.userId, {
      email_address: email,
      imap_host,
      imap_port,
      use_tls,
      password_plain: password,
    });
  } catch (e) {
    console.error("[imap settings POST] upsert", e);
    const raw = e instanceof Error ? e.message : String(e);
    if (raw.includes("AUTH_SECRET")) {
      return NextResponse.json(
        {
          error:
            "Server: AUTH_SECRET fehlt oder ist zu kurz (mindestens 16 Zeichen). Bitte in .env.local setzen.",
        },
        { status: 500 },
      );
    }
    if (/user_imap_accounts|relation .* does not exist|undefined_table/i.test(raw)) {
      return NextResponse.json(
        {
          error:
            "Datenbank: Die IMAP-Tabelle fehlt noch. Bitte lokal ausführen: npm run db:migrate-user-imap",
        },
        { status: 500 },
      );
    }
    const short =
      raw.length > 280 ? `${raw.slice(0, 280)}…` : raw || "Speichern in der Datenbank fehlgeschlagen.";
    return NextResponse.json({ error: short }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  await deleteImapAccountForUser(session.userId);
  return NextResponse.json({ ok: true });
}
