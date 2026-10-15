// A card's calendar dates, `YYYY-MM-DD`, as Plan shows and compares them
// (docs/specs/004-interface-design/date-fields.md "Showing a date").

// The formatting lives with the card values in @livediagram/items (card-text.ts), so every export labels a day as
// the canvas does.
export { dayLabel, type DayLabelStyle } from '@livediagram/items';

// The viewer's own calendar day, `offset` days from today: local, never UTC, so it does not
// slip a day either side of midnight.
export function dayKey(offset = 0, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
