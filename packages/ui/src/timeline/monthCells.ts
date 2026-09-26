// Month-grid arithmetic, shared by the calendar view and the mini
// calendar (docs/specs/013-workspace/timeline.md §2.2).
//
// Pure, and CIVIL rather than UTC: a cell is a calendar square, not an
// instant. The one function that converts a timestamp (`monthKeyOf`)
// reads local fields, matching `dateKey` in the grouping helper — the
// day a cell represents has to be the same day the feed grouped events
// into, or a dot appears on the wrong square.

export type MonthCell = {
  // YYYY-MM-DD, or null for a leading/trailing pad square.
  key: string | null;
  day: number | null;
};

// "2026-08" -> the 7-column grid, Monday-first.
export function buildMonthCells(monthKey: string): MonthCell[] {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return [];
  const first = new Date(Date.UTC(year, month - 1, 1));
  // getUTCDay is Sunday-0; this grid is Monday-first (en-GB), so
  // Sunday pads by six rather than zero.
  const pad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: MonthCell[] = [];
  for (let i = 0; i < pad; i += 1) cells.push({ key: null, day: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: `${monthKey}-${String(day).padStart(2, '0')}`,
      day,
    });
  }
  // Pad the tail so the grid is whole weeks and the container doesn't
  // change height between a month that ends mid-row and one that
  // doesn't.
  while (cells.length % 7 !== 0) cells.push({ key: null, day: null });
  return cells;
}

export function monthKeyOf(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(Date.UTC(year!, month! - 1 + delta, 1));
  return next.toISOString().slice(0, 7);
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
