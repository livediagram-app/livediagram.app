// Month-grid arithmetic, shared by the calendar view and the mini
// calendar (docs/specs/013-workspace/timeline.md §2.2).
//
// Pure, and CIVIL rather than UTC: a cell is a calendar square, not an
// instant. The one function that converts a timestamp (`monthKeyOf`)
// reads local fields, matching `dateKey` in the grouping helper — the
// day a cell represents has to be the same day the feed grouped events
// into, or a dot appears on the wrong square. The day arithmetic is the
// Plan views' (@livediagram/items plan-view-dates), so both month grids
// pad, step and name months the same way.
import {
  MONTH_LONG,
  dayParts,
  daysInMonth,
  monthStart,
  shiftMonth as shiftCivilMonth,
} from '@livediagram/items';

export type MonthCell = {
  // YYYY-MM-DD, or null for a leading/trailing pad square.
  key: string | null;
  day: number | null;
};

// "2026-08" -> the 7-column grid, Monday-first.
export function buildMonthCells(monthKey: string): MonthCell[] {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return [];
  // Monday-first (en-GB): `dayParts`'s weekday is 0 on a Monday, so a
  // month starting on a Sunday pads by six.
  const pad = dayParts(monthStart(year, month - 1)).weekday;
  const days = daysInMonth(year, month - 1);

  const cells: MonthCell[] = [];
  for (let i = 0; i < pad; i += 1) cells.push({ key: null, day: null });
  for (let day = 1; day <= days; day += 1) {
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
  const next = shiftCivilMonth(year!, month! - 1, delta);
  return `${next.year}-${String(next.month + 1).padStart(2, '0')}`;
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_LONG[month! - 1]} ${year}`;
}
