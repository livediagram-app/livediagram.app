// A service's day, from its checks (liveworkspace/docs/specs/009-status/status.md "The hourly run"): how many, how many up, slow and
// down, the median and 95th percentile answer time, and the worst state. Pure, so the seed script uses it too.

import { type CheckState, worse } from '@liveworkspace/status';

export type DayCheck = { state: CheckState; ms: number };

export type DayRollup = {
  checks: number;
  up: number;
  slow: number;
  down: number;
  // Over the checks that answered; null when none did.
  p50: number | null;
  p95: number | null;
  worst: CheckState;
};

/** The nearest-rank percentile of sorted values (`q` from 0 to 1). */
export function percentile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[rank - 1]!;
}

export function rollupDay(checks: readonly DayCheck[]): DayRollup {
  let up = 0;
  let slow = 0;
  let down = 0;
  let worst: CheckState = 'up';
  const times: number[] = [];
  for (const c of checks) {
    if (c.state === 'up') up++;
    else if (c.state === 'slow') slow++;
    else down++;
    if (c.state !== 'down') times.push(c.ms);
    worst = worse(worst, c.state);
  }
  times.sort((a, b) => a - b);
  return {
    checks: checks.length,
    up,
    slow,
    down,
    p50: percentile(times, 0.5),
    p95: percentile(times, 0.95),
    worst,
  };
}

/** A day's uptime in tenths of a percent: the checks that answered (up or slow) over all of them. */
export function uptimeTenths(r: Pick<DayRollup, 'checks' | 'up' | 'slow'>): number | null {
  return r.checks === 0 ? null : Math.round(((r.up + r.slow) * 1000) / r.checks);
}
