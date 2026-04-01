const TAVILY_URL = "https://api.tavily.com/search";
const MAX_QUERY_LEN = 400;
const REQUEST_TIMEOUT_MS = 25_000;

export type TavilySearchSuccess = {
  ok: true;
  /** Kurzantwort der API, falls vorhanden */
  answer: string | null;
  results: Array<{ title: string; url: string; content: string }>;
};

export type TavilySearchFailure = { ok: false; error: string };

/**
 * Websuche für den Assistenten (Tavily). Benötigt TAVILY_API_KEY.
 * @see https://docs.tavily.com/documentation/api-reference/endpoint/search
 */
export async function tavilySearch(query: string): Promise<TavilySearchSuccess | TavilySearchFailure> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "Web-Recherche ist nicht eingerichtet (Umgebungsvariable TAVILY_API_KEY fehlt)." };
  }

  const q = query.trim().slice(0, MAX_QUERY_LEN);
  if (!q) {
    return { ok: false, error: "Suchanfrage fehlt." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query: q,
        search_depth: "basic",
        max_results: 6,
        include_answer: true,
      }),
    });

    const raw = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const detail =
        typeof raw.detail === "string"
          ? raw.detail
          : typeof raw.message === "string"
            ? raw.message
            : res.statusText;
      return { ok: false, error: `Websuche fehlgeschlagen (${res.status}): ${detail}` };
    }

    const answer = typeof raw.answer === "string" && raw.answer.trim() ? raw.answer.trim() : null;

    const rawResults = Array.isArray(raw.results) ? raw.results : [];
    const results: TavilySearchSuccess["results"] = [];
    for (const item of rawResults) {
      if (typeof item !== "object" || item === null) continue;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title : "";
      const url = typeof o.url === "string" ? o.url : "";
      const content = typeof o.content === "string" ? o.content : "";
      if (title || content) {
        results.push({ title, url, content: content.slice(0, 2_000) });
      }
    }

    return { ok: true, answer, results };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Websuche hat zu lange gedauert." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Websuche fehlgeschlagen." };
  } finally {
    clearTimeout(timer);
  }
}
