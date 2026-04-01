import { BrowserUse, BrowserUseError, type SessionRun } from "browser-use-sdk/v3";
import { isTrustedBrowserUseLiveUrl } from "@/lib/assistant/browser-use-live-url";

const MAX_QUERY_LEN = 500;

const DEFAULT_TASK_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_MS = 2_500;

function agentModel(): "bu-mini" | "bu-max" | "bu-ultra" {
  const m = process.env.BROWSER_USE_AGENT_MODEL?.trim().toLowerCase();
  if (m === "bu-mini" || m === "bu-max" || m === "bu-ultra") return m;
  return "bu-mini";
}

function taskTimeoutMs(): number {
  const n = Number(process.env.BROWSER_USE_TASK_TIMEOUT_MS);
  if (Number.isFinite(n) && n >= 30_000 && n <= 3_600_000) return Math.floor(n);
  return DEFAULT_TASK_TIMEOUT_MS;
}

function extractUrls(text: string): Array<{ title: string; url: string; excerpt: string }> {
  const urlRe = /https?:\/\/[^\s\]>)"',\\]+/gi;
  const seen = new Set<string>();
  const out: Array<{ title: string; url: string; excerpt: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text)) !== null) {
    let u = m[0].replace(/[.,;:)]+$/, "");
    if (seen.has(u)) continue;
    seen.add(u);
    try {
      const host = new URL(u).hostname;
      out.push({ title: host, url: u, excerpt: "" });
    } catch {
      out.push({ title: u, url: u, excerpt: "" });
    }
    if (out.length >= 12) break;
  }
  return out;
}

export type BrowserResearchSuccess = {
  ok: true;
  answer: string | null;
  results: Array<{ title: string; url: string; content: string }>;
};

export type BrowserResearchFailure = { ok: false; error: string };

/**
 * Web-Recherche über Browser Use (Cloud-Agent mit echtem Browser).
 * Optional: Live-Preview-URL solange die Session läuft (für eingebettete Ansicht im Chat).
 */
export async function browserUseResearch(
  query: string,
  onLiveSessionUrl?: (url: string | null) => void,
): Promise<BrowserResearchSuccess | BrowserResearchFailure> {
  const apiKey = process.env.BROWSER_USE_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Web-Recherche ist nicht eingerichtet. Lege BROWSER_USE_API_KEY an (Browser Use Cloud: https://cloud.browser-use.com/settings?tab=api-keys&new=1 — derselbe Zugang wie bei der browser-use CLI „cloud login“).",
    };
  }

  const q = query.trim().slice(0, MAX_QUERY_LEN);
  if (!q) {
    return { ok: false, error: "Suchanfrage fehlt." };
  }

  const task = [
    "Recherchiere im offenen Web und beantworte auf Deutsch, sachlich und präzise.",
    "Nutze Suchmaschinen und verlässliche Seiten. Wenn du Adressen, Telefon oder ähnliche Fakten findest, gib sie klar wieder.",
    "Nenne am Ende die wichtigsten Quellen mit vollständiger URL (eine URL pro Zeile unter „Quellen:“).",
    "",
    `Auftrag: ${q}`,
  ].join("\n");

  const emitLive = (url: string | null) => {
    if (!onLiveSessionUrl) return;
    if (url !== null && !isTrustedBrowserUseLiveUrl(url)) return;
    onLiveSessionUrl(url);
  };

  try {
    const client = new BrowserUse({ apiKey });
    const run = client.run(task, {
      model: agentModel(),
      proxyCountryCode: "de",
      timeout: taskTimeoutMs(),
      interval: DEFAULT_POLL_MS,
      keepAlive: false,
    }) as SessionRun<string>;

    let lastUrl: string | null = null;
    const syncLive = async () => {
      const sid = run.sessionId;
      if (!sid) return;
      try {
        const s = await client.sessions.get(sid);
        const next = s.liveUrl?.trim() || null;
        const trusted = next && isTrustedBrowserUseLiveUrl(next) ? next : null;
        if (trusted !== lastUrl) {
          lastUrl = trusted;
          emitLive(trusted);
        }
      } catch {
        /* Session kann kurz nicht erreichbar sein */
      }
    };

    const pollMs = 1200;
    const poll = setInterval(() => {
      void syncLive();
    }, pollMs);

    try {
      for await (const _msg of run) {
        await syncLive();
      }
    } finally {
      clearInterval(poll);
      lastUrl = null;
      emitLive(null);
    }

    const sessionResult = run.result;
    if (!sessionResult) {
      return {
        ok: false,
        error: "Die Browser-Recherche konnte nicht abgeschlossen werden.",
      };
    }

    const rawOutput = sessionResult.output;
    const text =
      rawOutput == null
        ? ""
        : typeof rawOutput === "string"
          ? rawOutput
          : JSON.stringify(rawOutput);

    const trimmed = text.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: "Die Browser-Recherche lieferte keinen Text (Auftrag evtl. zu knapp oder Sitzung ohne Ergebnis).",
      };
    }

    const fromText = extractUrls(trimmed);
    return {
      ok: true,
      answer: trimmed.length > 4000 ? `${trimmed.slice(0, 4000)}…` : trimmed,
      results: fromText.map((r) => ({ ...r, content: r.excerpt })),
    };
  } catch (e) {
    emitLive(null);
    if (e instanceof BrowserUseError) {
      const detail =
        typeof e.detail === "string"
          ? e.detail
          : e.detail != null && typeof e.detail === "object" && "detail" in e.detail
            ? String((e.detail as { detail?: unknown }).detail)
            : e.message;
      return { ok: false, error: `Browser Use: ${detail}` };
    }
    if (e instanceof Error && e.message.includes("API key")) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Web-Recherche fehlgeschlagen." };
  }
}
