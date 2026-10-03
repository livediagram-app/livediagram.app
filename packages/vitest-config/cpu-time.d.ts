/** CPU time (user + system, ms) this process spent running `fn`; see cpu-time.js. */
export declare function cpuMsOf(fn: () => void): number;
/** CPU time (user + system, ms) this process spent while `fn`'s promise settled; see cpu-time.js. */
export declare function cpuMsOfAsync(fn: () => Promise<unknown>): Promise<number>;
