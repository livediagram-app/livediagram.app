// Small maths/format helpers shared by the dashboard charts. Kept in
// their own module so the page shell and the window panel (and any
// future chart) reuse one definition instead of copy-pasting.

// `part` as a percentage of `whole` (0–100, unrounded). Callers apply their own
// Math.round / toFixed / clamp + the `%` unit. One definition for the bar-width
// and share-label maths that recur across the dashboard.
export const pct = (part: number, whole: number): number => (part / whole) * 100;

// "Month day" axis label shared by the trend charts. The api buckets
// events by UTC day and hands back exact UTC midnights, so the label
// must be UTC too — the viewer's local zone would shift every label
// (and tooltip) by a day for anyone west of UTC.
export function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
