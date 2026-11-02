// When a paired workbench was paired, as the Settings row says it. Pure, so it is unit-tested.
import { DAY_MS } from '@livehuddle/document';

// Compact relative time: "2 days ago" (past) / "in 5 months" (future).
export function relativeTime(ms: number, now: number): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [365 * DAY_MS, 'year'],
    [30 * DAY_MS, 'month'],
    [7 * DAY_MS, 'week'],
    [DAY_MS, 'day'],
    [3_600_000, 'hour'],
    [60_000, 'minute'],
  ];
  for (const [size, name] of units) {
    if (abs >= size) {
      const n = Math.round(abs / size);
      const label = `${n} ${name}${n !== 1 ? 's' : ''}`;
      return diff < 0 ? `${label} ago` : `in ${label}`;
    }
  }
  return diff < 0 ? 'just now' : 'in a moment';
}
