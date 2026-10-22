/** CPU time (user + system, ms) this process spent running `fn`; see cpu-time.js. */
export declare function cpuMsOf(fn: () => void): number;
/** CPU time (user + system, ms) this process spent while `fn`'s promise settled; see cpu-time.js. */
export declare function cpuMsOfAsync(fn: () => Promise<unknown>): Promise<number>;
/** How much slower a CI runner runs the same work; see cpu-time.js. */
export declare const CI_CPU_HEADROOM: number;
/** The variable workers see when the run collects coverage; see cpu-time.js. */
export declare const UNDER_COVERAGE_ENV: 'LIVEDOCUMENTS_COVERAGE';
/** A speed test's CPU budget: `ms` locally, `ms x CI_CPU_HEADROOM` on CI or under coverage; see cpu-time.js. */
export declare function cpuBudgetMs(ms: number): number;
