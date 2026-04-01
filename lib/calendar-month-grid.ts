export type MonthCell = {
  date: Date;
  inCurrentMonth: boolean;
};

const GRID_DAYS = 42;

/** Montag = erste Spalte, immer 6 Wochen für stabile Höhe */
export function getMonthGrid(year: number, monthIndex: number): MonthCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const jsDow = firstOfMonth.getDay();
  const mondayOffset = (jsDow + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1);
  gridStart.setDate(1 - mondayOffset);

  const cells: MonthCell[] = [];
  for (let i = 0; i < GRID_DAYS; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      inCurrentMonth: d.getMonth() === monthIndex,
    });
  }
  return cells;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Kalenderwoche Montag–Sonntag (lokal), 00:00 am Montag */
export function startOfWeekMonday(from: Date): Date {
  const x = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const jsDow = x.getDay();
  const mondayOffset = (jsDow + 6) % 7;
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

/** Sieben aufeinanderfolgende Tage ab Montag (inkl.) */
export function getWeekFromMonday(mondayStart: Date): Date[] {
  const m = new Date(
    mondayStart.getFullYear(),
    mondayStart.getMonth(),
    mondayStart.getDate(),
  );
  return Array.from({ length: 7 }, (_, i) => addDays(m, i));
}
