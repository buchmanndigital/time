/** Für Formulareingaben und Tool-Args: leer → null; unterstützt 1234,56 und 1.234,56 (DE). */

const MAX_EURO = 99_999_999.99;

export type ParseOptionalEuroResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

export function parseOptionalEuroInput(raw: string): ParseOptionalEuroResult {
  const s = raw.trim();
  if (s === "") return { ok: true, value: null };

  let t = s.replace(/\s/g, "");
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  if (hasComma && hasDot) {
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      t = t.replace(/,/g, "");
    }
  } else if (hasComma) {
    t = t.replace(",", ".");
  }

  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "Betrag ungültig (nur nicht-negative Zahlen)." };
  }
  if (n > MAX_EURO) {
    return { ok: false, error: "Betrag zu groß." };
  }
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/** Gemini liefert Zahlen oft als number; Strings wie „1.500,00“ auch möglich. */
export function optionalEuroFromToolArg(raw: unknown): ParseOptionalEuroResult {
  if (raw == null || raw === "") return { ok: true, value: null };
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) {
      return { ok: false, error: "potential_amount_eur ungültig (nur nicht-negative Zahlen)." };
    }
    if (raw > MAX_EURO) return { ok: false, error: "Betrag zu groß." };
    return { ok: true, value: Math.round(raw * 100) / 100 };
  }
  return parseOptionalEuroInput(String(raw));
}
