// Month-grid arithmetic, shared by the calendar view and the mini
// calendar (spec/138 §2.2).
//
// Pure and UTC, matching the grouping helper — the day a cell
// represents has to be the same day the feed grouped events into, or a
// dot appears on the wrong square.

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
  return new Date(at).toISOString().slice(0, 7);
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

// The nearest month in `direction` that actually has events, or null
// when there is none.
//
// Chevrons that step one empty month at a time are what makes a
// calendar feel broken during a quiet quarter: the reader clicks four
// times to find out there was nothing to find. Jumping straight to the
// next populated month — and disabling the chevron when there isn't
// one — turns four dead clicks into one honest answer.
export function nearestPopulatedMonth(
  monthKeys: Iterable<string>,
  from: string,
  direction: 1 | -1,
): string | null {
  let best: string | null = null;
  for (const key of monthKeys) {
    if (direction === 1 ? key <= from : key >= from) continue;
    if (best === null || (direction === 1 ? key < best : key > best)) best = key;
  }
  return best;
}
