/**
 * Termine ohne explizite Zeitzone gelten als Uhzeit in Europe/Berlin (App-Nutzer: DE).
 * Ohne diese Regel würde Node/Vercel (meist UTC) "2026-04-01T13:00:00" als 13:00 UTC lesen
 * (= 15:00 MESZ auf dem Bildschirm = „2 Stunden zu spät“).
 */

const BERLIN = "Europe/Berlin";

function berlinWallTimeToUtc(
  y: number,
  mo: number,
  day: number,
  h: number,
  min: number,
  sec: number,
): Date | null {
  if (
    [y, mo, day, h, min, sec].some((n) => !Number.isFinite(n)) ||
    mo < 1 ||
    mo > 12 ||
    day < 1 ||
    day > 31 ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59 ||
    sec < 0 ||
    sec > 59
  ) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  function readBerlin(utcMs: number) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const g = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value);
    return {
      y: g("year"),
      mo: g("month"),
      d: g("day"),
      h: g("hour"),
      mi: g("minute"),
      s: g("second"),
    };
  }

  function cmp(
    p: ReturnType<typeof readBerlin>,
    ty: number,
    tmo: number,
    td: number,
    th: number,
    tmi: number,
    ts: number,
  ): number {
    if (p.y !== ty) return p.y - ty;
    if (p.mo !== tmo) return p.mo - tmo;
    if (p.d !== td) return p.d - td;
    if (p.h !== th) return p.h - th;
    if (p.mi !== tmi) return p.mi - tmi;
    return p.s - ts;
  }

  let lo = Date.UTC(y, mo - 1, day - 2, 0, 0, 0);
  let hi = Date.UTC(y, mo - 1, day + 2, 23, 59, 59);

  for (let i = 0; i < 56 && lo <= hi; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const p = readBerlin(mid);
    const c = cmp(p, y, mo, day, h, min, sec);
    if (c === 0) return new Date(mid);
    if (c < 0) lo = mid + 1;
    else hi = mid - 1;
  }

  return null;
}

/** Rohtext aus Formular / KI: nimmt Z/Offset wörtlich, sonst Berlin-Ortszeit. */
export function parseStartsAtInputToUtc(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    return berlinWallTimeToUtc(+dateOnly[1], +dateOnly[2], +dateOnly[3], 0, 0, 0);
  }

  const dt = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?/.exec(s);
  if (dt) {
    return berlinWallTimeToUtc(+dt[1], +dt[2], +dt[3], +dt[4], +dt[5], dt[6] != null ? +dt[6] : 0);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
