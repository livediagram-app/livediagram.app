// How an answer is judged (liveworkspace/docs/specs/010-site/site.md "Status", liveworkspace/docs/specs/009-status/status.md "The hourly run"): the
// same rules in the visitor's browser and in the status Worker, so a service is up, slow or down for the same reasons
// in both.

import type { Check, Probe, Service } from './services';

// Slower than this, an expected answer is slow.
export const SLOW_MS = 1500;
// No answer in this long, the check gives up and the service is down.
export const TIMEOUT_MS = 10_000;

// A stored check's state. The browser adds `reached`, `checking` and `skipped` of its own (lib/status/probe.ts).
export type CheckState = 'up' | 'slow' | 'down';

// Why a check was down, as a short code: no answer in time, no answer at all, a status code it shouldn't give, or
// HTML where a Worker's JSON was expected.
export type CheckError = 'timeout' | 'network' | 'status' | 'not_json';

/** What is wrong with an answer the checker can read, or null when it is the one expected. A `reach` probe is only
 *  ever read on the server, where any 2xx or 3xx is up. */
export function judgeAnswer(
  probe: Probe,
  status: number,
  contentType: string | null,
): Extract<CheckError, 'status' | 'not_json'> | null {
  if (probe.kind === 'reach') return status >= 200 && status < 400 ? null : 'status';
  if (!probe.ok.includes(status)) return 'status';
  if (probe.json && !/\bjson\b/i.test(contentType ?? '')) return 'not_json';
  return null;
}

/** An answer's state: down on any error, slow after SLOW_MS, else up. */
export function stateOf(ms: number, error: CheckError | null): CheckState {
  if (error) return 'down';
  return ms > SLOW_MS ? 'slow' : 'up';
}

// One service's result in a run, as the Worker stores it. `code` is null when nothing answered.
export type CheckResult = {
  state: CheckState;
  code: number | null;
  ms: number;
  error: CheckError | null;
};

const ANSWERED = new Set<CheckState>(['up', 'slow']);

/** The results of the services with no check of their own, from those they stand on: the realtime rooms take the
 *  API's; the router is up when any check through it answered (its fastest), and down when none did. A service whose
 *  sources have no result yet gets none. */
export function deriveResults(
  services: readonly Service[],
  results: ReadonlyMap<string, CheckResult>,
): Map<string, CheckResult> {
  const out = new Map<string, CheckResult>();
  for (const s of services) {
    const check: Check = s.check;
    if (check.mode !== 'derived') continue;
    const sources = check.from.flatMap((id) => {
      const r = results.get(id);
      return r ? [r] : [];
    });
    if (sources.length === 0) continue;
    if (check.rule === 'same') {
      out.set(s.id, { ...sources[0]! });
      continue;
    }
    const fastest = sources.filter((r) => ANSWERED.has(r.state)).toSorted((a, b) => a.ms - b.ms)[0];
    out.set(
      s.id,
      fastest
        ? { ...fastest }
        : { ...sources.toSorted((a, b) => a.ms - b.ms)[0]!, state: 'down' as const },
    );
  }
  return out;
}

const WORST_ORDER: Record<CheckState, number> = { up: 0, slow: 1, down: 2 };

/** The worse of two states (down over slow over up). */
export function worse(a: CheckState, b: CheckState): CheckState {
  return WORST_ORDER[b] > WORST_ORDER[a] ? b : a;
}
