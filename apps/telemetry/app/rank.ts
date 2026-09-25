import type { TelemetryCount } from '@livediagram/api-schema';

// Filter rows to a predicate (with a non-empty type) and sort by count desc.
export function rank(
  rows: TelemetryCount[],
  predicate: (r: TelemetryCount) => boolean,
): TelemetryCount[] {
  return rows.filter((r) => predicate(r) && r.type).sort((a, b) => b.count - a.count);
}
