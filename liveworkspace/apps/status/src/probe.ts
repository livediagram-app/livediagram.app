// Checking every service from the Worker (liveworkspace/docs/status.md "The hourly run"): each probe of the shared
// list, with a timeout, judged by the same rules as the page's, and never a response body kept.

import {
  type CheckError,
  type CheckResult,
  judgeAnswer,
  type Probe,
  stateOf,
  TIMEOUT_MS,
} from '@liveworkspace/status';
import { PROBE_CONCURRENCY, USER_AGENT } from './config';

export type Fetch = (request: Request) => Promise<Response>;
export type Clock = () => number;

/** Check one address. Never throws: a failure is a `down` result with its error code. */
export async function probeOne(
  probe: Probe,
  url: string,
  fetchImpl: Fetch,
  now: Clock = Date.now,
  timeoutMs = TIMEOUT_MS,
): Promise<CheckResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The timer both aborts the request and ends the wait, so a fetch that ignores its signal can't hold the run.
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
  });
  const started = now();
  const elapsed = () => Math.max(0, Math.round(now() - started));
  try {
    const res = await Promise.race([
      fetchImpl(
        new Request(url, {
          method: probe.method,
          redirect: 'follow',
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, */*;q=0.5' },
          signal: controller.signal,
        }),
      ),
      timedOut,
    ]);
    const ms = elapsed();
    // The body is never read: cancel it so the connection is freed.
    await res.body?.cancel().catch(() => {});
    const error = judgeAnswer(probe, res.status, res.headers.get('Content-Type'));
    return { state: stateOf(ms, error), code: res.status, ms, error };
  } catch {
    const error: CheckError = controller.signal.aborted ? 'timeout' : 'network';
    return { state: 'down', code: null, ms: Math.min(elapsed(), timeoutMs), error };
  } finally {
    clearTimeout(timer);
  }
}

/** Run every task, at most `limit` at once, in their order. Each starts only when a slot is free, so a probe's clock
 *  starts when its request leaves. */
export async function pooled<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const out: T[] = Array.from({ length: tasks.length });
  let next = 0;
  async function lane() {
    while (next < tasks.length) {
      const i = next++;
      out[i] = await tasks[i]!();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, lane));
  return out;
}

export type ProbeTarget = { id: string; probe: Probe; url: string; fetch: Fetch };

/** Check every target, PROBE_CONCURRENCY at a time. */
export async function probeAll(
  targets: readonly ProbeTarget[],
  now?: Clock,
  timeoutMs?: number,
): Promise<Map<string, CheckResult>> {
  const results = await pooled(
    targets.map((t) => () => probeOne(t.probe, t.url, t.fetch, now, timeoutMs)),
    PROBE_CONCURRENCY,
  );
  return new Map(targets.map((t, i) => [t.id, results[i]!]));
}
