/** CPU time (user + system, ms) this process spent running `fn`; see cpu-time.js. */
export declare function cpuMsOf(fn: () => void): number;
/** CPU time (user + system, ms) this process spent while `fn`'s promise settled; see cpu-time.js. */
export declare function cpuMsOfAsync(fn: () => Promise<unknown>): Promise<number>;
/** How much slower a CI runner runs the same work; see cpu-time.js. */
export declare const CI_CPU_HEADROOM: number;
/** A speed test's CPU budget: `ms` locally, `ms x CI_CPU_HEADROOM` on CI; see cpu-time.js. */
export declare function cpuBudgetMs(ms: number): number;
