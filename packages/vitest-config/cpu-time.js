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
 * The variable the shared Vitest config hands its workers when the run collects coverage (`--coverage`).
 * Instrumented code runs the same work several times slower, so a budget read there says nothing about the
 * code: `cpuBudgetMs` is unbounded under it, and `vitest-budgets` checks the budgets again without coverage.
 */
export const UNDER_COVERAGE_ENV = 'LIVEWORKSPACE_COVERAGE';

/**
 * A speed test's CPU budget: `ms` as written on a developer's machine, `ms x CI_CPU_HEADROOM` on CI (`CI` is
 * `true` or `1`, as GitHub Actions sets it; `CI=false` or `CI=0`, which some shells and images export to turn
 * CI behaviour off, is a developer's machine). The written number stays the product's own budget and holds
 * wherever it is meaningful; CI still fails a slide past three times it. Three is enough beside a 4x slower
 * runner because a budget is written with its own room over the local timing (Tidy Up: 100 ms against 24
 * measured).
 *
 * Under coverage (`UNDER_COVERAGE_ENV`) it is `Infinity`: the test runs and counts its lines but cannot fail
 * on time, because instrumentation, not the code, sets the pace there. The same files then run without
 * coverage through `vitest-budgets` (budgets.js), where the budget holds. So a budget is always an upper
 * bound (`toBeLessThan(cpuBudgetMs(ms))`), never a timeout.
 *
 * @param {number} ms
 * @returns {number}
 */
export function cpuBudgetMs(ms) {
  if (process.env[UNDER_COVERAGE_ENV]) return Number.POSITIVE_INFINITY;
  return onCi() ? ms * CI_CPU_HEADROOM : ms;
}

/**
 * A growth check's ceiling: the ratio of two CPU times, a larger input's over a smaller one's, that a test
 * holds work under (four times the input under eight times the CPU, where a quadratic scan reads sixteen).
 * The same ratio in a plain run and on CI, since a ratio already cancels a slower runner.
 *
 * Under coverage (`UNDER_COVERAGE_ENV`) it is `Infinity`, as `cpuBudgetMs` is: instrumentation slows a large
 * input's allocation and collection more than a small one's, so a ratio read there measures the collector, not
 * the code (livehuddle's stored-arrow bounds read 8.68 against 8 on CI). Importing it puts the file in
 * `vitest-budgets`' plain rerun, where the ratio holds (docs/ci.md "Speed budgets").
 *
 * @param {number} ratio
 * @returns {number}
 */
export function cpuRatioCeiling(ratio) {
  return process.env[UNDER_COVERAGE_ENV] ? Number.POSITIVE_INFINITY : ratio;
}

/**
 * A growth check written on the smaller time: the larger input's CPU limit, `ms x ratio + slackMs` (the slack
 * keeps a sub-millisecond small time from reading timer noise as growth). Unbounded under coverage, as
 * `cpuRatioCeiling` is, and so never `0 x Infinity`.
 *
 * @param {number} ms
 * @param {number} ratio
 * @param {number} [slackMs]
 * @returns {number}
 */
export function cpuGrowthLimitMs(ms, ratio, slackMs = 0) {
  if (process.env[UNDER_COVERAGE_ENV]) return Number.POSITIVE_INFINITY;
  return ms * ratio + slackMs;
}

/**
 * A growth check's ratio of two CPU times, measured so noise cannot pass for growth: `large()` over `small()`,
 * each a function that times one sample (`cpuMsOf`) and builds what it needs outside the timing. Each runs once
 * untimed (that run pays the compile), then both are sampled `runs` times in turns, never one size after the
 * other (the larger would take whatever collection lands on it), and the fastest sample of each is kept.
 * Interference only ever adds CPU time, so while the ratio reads at or over `ceiling` it samples `runs` more of
 * each, up to `attempts` rounds in all: a noisy round settles, while a quadratic step reads sixteen in every
 * round. Under coverage the ceiling (`cpuRatioCeiling`) is unbounded, so one round runs (docs/ci.md "Speed
 * budgets").
 *
 * @param {() => number} small
 * @param {() => number} large
 * @param {{ ceiling: number, runs?: number, attempts?: number }} options
 * @returns {number}
 */
export function cpuGrowthRatio(small, large, { ceiling, runs = 5, attempts = 3 }) {
  small();
  large();
  let fastestSmall = Number.POSITIVE_INFINITY;
  let fastestLarge = Number.POSITIVE_INFINITY;
  let ratio = Number.POSITIVE_INFINITY;
  for (let round = 0; round < attempts; round++) {
    for (let run = 0; run < runs; run++) {
      fastestSmall = Math.min(fastestSmall, small());
      fastestLarge = Math.min(fastestLarge, large());
    }
    // `process.cpuUsage` counts in microseconds, so a small sample can read 0: floor it there.
    ratio = fastestLarge / Math.max(fastestSmall, 0.001);
    if (ratio < ceiling) break;
  }
  return ratio;
}
