// Work that outlives the response, and work that runs on a clock. Both are
// Worker concepts (`ExecutionContext.waitUntil`, `triggers.crons`) with direct
// Node equivalents (an unawaited promise the process holds, and a timer).

export type Scheduler = {
  /**
   * Run a promise the request does not wait for. The Cloudflare runtime forwards
   * to `ctx.waitUntil` when it exists and drops the promise otherwise, exactly
   * as the api worker already does (`executionCtx?.waitUntil?.()`).
   */
  waitUntil(promise: Promise<unknown>): void;
  /**
   * Register a recurring job. One registration per cron expression, run by the
   * runtime's own tick: `triggers.crons` in wrangler.toml on Cloudflare, a
   * timer in the Node process.
   */
  cron(expression: string, job: () => Promise<void> | void): void;
};
