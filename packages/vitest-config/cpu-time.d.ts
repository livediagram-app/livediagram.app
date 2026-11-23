/** CPU time (user + system, ms) this process spent running `fn`; see cpu-time.js. */
export declare function cpuMsOf(fn: () => void): number;
/** The least CPU time (ms) `fn` took over `runs` runs (5): one sample also counts the collector and the compiler; see cpu-time.js. */
export declare function cpuLeastMsOf(fn: () => void, runs?: number): number;
/** CPU time (user + system, ms) this process has spent so far: `performance.now()`'s stand-in for a budget; see cpu-time.js. */
export declare function cpuNowMs(): number;
/** CPU time (user + system, ms) this process spent while `fn`'s promise settled; see cpu-time.js. */
export declare function cpuMsOfAsync(fn: () => Promise<unknown>): Promise<number>;
/** How much slower a CI runner runs the same work; see cpu-time.js. */
export declare const CI_CPU_HEADROOM: number;
/** The variable workers see when the run collects coverage; see cpu-time.js. */
export declare const UNDER_COVERAGE_ENV: 'LIVEWORKSPACE_COVERAGE';
/** A speed test's CPU budget: `ms` locally, `ms x CI_CPU_HEADROOM` on CI, unbounded under coverage; see cpu-time.js. */
export declare function cpuBudgetMs(ms: number): number;
/** A growth check's ceiling on a ratio of two CPU times: `ratio`, unbounded under coverage; see cpu-time.js. */
export declare function cpuRatioCeiling(ratio: number): number;
/** A growth check's CPU limit on the larger input: `ms x ratio + slackMs`, unbounded under coverage; see cpu-time.js. */
export declare function cpuGrowthLimitMs(ms: number, ratio: number, slackMs?: number): number;
/** A growth check's ratio: two sizes sampled in turns, best kept, more rounds while over `ceiling`; see cpu-time.js. */
export declare function cpuGrowthRatio(
  small: () => number,
  large: () => number,
  options: { ceiling: number; runs?: number; attempts?: number },
): number;
