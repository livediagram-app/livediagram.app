/**
 * CPU time this process spent running `fn`, in ms (user + system).
 *
 * Speed tests assert on THIS, not wall-clock time: `performance.now()` also
 * counts the time a test waits for a core while every other package's suite
 * runs in parallel (turbo), which made wall-clock budgets flake: a 30 ms
 * conversion measured at over a second. CPU time barely moves under
 * contention, so a budget on it still catches a real regression (a quadratic
 * loop, an accidental re-scan) without failing on a busy machine.
 *
 * @param {() => void} fn
 * @returns {number}
 */
export function cpuMsOf(fn) {
  const before = process.cpuUsage();
  fn();
  const spent = process.cpuUsage(before);
  return (spent.user + spent.system) / 1000;
}

/**
 * `cpuMsOf` for async work: the CPU time this process spent while `fn`'s
 * promise settled. The worker runs one test at a time, so nothing else is
 * on its CPU meanwhile.
 *
 * @param {() => Promise<unknown>} fn
 * @returns {Promise<number>}
 */
export async function cpuMsOfAsync(fn) {
  const before = process.cpuUsage();
  await fn();
  const spent = process.cpuUsage(before);
  return (spent.user + spent.system) / 1000;
}

/**
 * How much slower a CI runner runs the same work than a developer's machine. CI's shared
 * two-core runners run the editor suite under v8 coverage, and measured the Tidy Up hover at
 * 101 to 104 ms of CPU where an M-series Mac takes 24 (main, 2026-10-14): about 4x. A budget
 * set for a person's device sits at the line there and turned main red at random.
 */
export const CI_CPU_HEADROOM = 3;

/** Whether this run is on CI: `CI` says so (`true` or `1`), never merely by being set. */
function onCi() {
  const ci = (process.env.CI ?? '').toLowerCase();
  return ci === 'true' || ci === '1';
}

/**
 * The variable the shared Vitest config hands its workers when the run collects coverage (`--coverage`):
 * instrumented code runs the same work slower, wherever it runs.
 */
export const UNDER_COVERAGE_ENV = 'LIVEPAGES_COVERAGE';

/**
 * A speed test's CPU budget: `ms` as written on a developer's machine, `ms x CI_CPU_HEADROOM` on
 * CI (`CI` is `true` or `1`, as GitHub Actions sets it; `CI=false` or `CI=0`, which some shells and
 * images export to turn CI behaviour off, is a developer's machine). The written number stays the
 * product's own budget and holds wherever it is meaningful; CI still fails a slide past three times
 * it. Three is enough beside a 4x slower runner because a budget is written with its own room over
 * the local timing (Tidy Up: 100 ms against 24 measured). The same headroom applies under coverage
 * (`UNDER_COVERAGE_ENV`, the pre-push hook's run): the instrumentation is what slows the work.
 *
 * @param {number} ms
 * @returns {number}
 */
export function cpuBudgetMs(ms) {
  return onCi() || process.env[UNDER_COVERAGE_ENV] ? ms * CI_CPU_HEADROOM : ms;
}
