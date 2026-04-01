import { BrowserUse, BrowserUseError } from "browser-use-sdk/v3";

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
 * Nutzt dieselbe API wie die Browser-Use-CLI (`BROWSER_USE_API_KEY`, Keys mit bu_…).
 *
 * @see https://docs.browser-use.com/cloud/quickstart
 * @see https://docs.browser-use.com/open-source/browser-use-cli
 */
export async function browserUseResearch(query: string): Promise<BrowserResearchSuccess | BrowserResearchFailure> {
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

  try {
    const client = new BrowserUse({ apiKey });
    const result = await client.run(task, {
      model: agentModel(),
      proxyCountryCode: "de",
      timeout: taskTimeoutMs(),
      interval: DEFAULT_POLL_MS,
      keepAlive: false,
    });

    const rawOutput = result.output;
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
