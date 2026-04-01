const eurFmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Nur Anzeige; bei fehlendem Betrag null. */
export function formatPotentialEurDe(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return eurFmt.format(amount);
}

/** Fürs Bearbeitungsfeld (ohne Währungssymbol, Komma als Dezimaltrenner). */
export function euroNumberToFormString(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(n);
}
