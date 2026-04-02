import Holidays from "date-holidays";

const holidays = new Holidays("DE", "BY", {
  languages: ["de"],
  types: ["public"],
});

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Alle gesetzlichen Feiertage in Bayern zwischen zwei Daten (inklusive), als Map yyyy-mm-dd → Anzeigename.
 */
export function getBayernHolidayMapBetween(from: Date, to: Date): Map<string, string> {
  const map = new Map<string, string>();
  const fromKey = ymd(from);
  const toKey = ymd(to);
  const y0 = from.getFullYear();
  const y1 = to.getFullYear();
  for (let year = y0; year <= y1; year++) {
    const list = holidays.getHolidays(year, "de");
    for (const h of list) {
      if (h.type !== "public") continue;
      const key = h.date.slice(0, 10);
      if (key < fromKey || key > toKey) continue;
      const prev = map.get(key);
      map.set(key, prev ? `${prev} · ${h.name}` : h.name);
    }
  }
  return map;
}
