import type { Scheduler } from '@livediagram/runtime';

// Work that outlives the response, and work that runs on a clock
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime").
//
// \`waitUntil\` holds a promise so the process does not exit mid-write; the process
// is expected to call \`drain()\` on shutdown. \`cron\` accepts the one shape the
// production schedule uses (\`0 3 * * *\`) and refuses anything else rather than
// silently never running.

export type NodeScheduler = Scheduler & {
  /** How many background promises are still in flight. */
  pending(): number;
  /** Wait for every held promise; used on shutdown and in tests. */
  drain(): Promise<void>;
  /** Start the registered schedules. Returns a stop function. */
  start(): () => void;
  /** The expressions registered so far, for logs and tests. */
  registered(): string[];
};

const DAILY_AT = /^(\d{1,2}) (\d{1,2}) \* \* \*$/;

export function nodeScheduler(): NodeScheduler {
  const held = new Set<Promise<unknown>>();
  const jobs = new Map<string, () => Promise<void> | void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const scheduleDaily = (hour: number, minute: number, job: () => Promise<void> | void): void => {
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0),
    );
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    const timer = setTimeout(() => {
      timers.delete(timer);
      void Promise.resolve(job()).finally(() => scheduleDaily(hour, minute, job));
    }, next.getTime() - now.getTime());
    timers.add(timer);
  };

  return {
    waitUntil: (promise) => {
      const tracked = promise.catch(() => undefined);
      held.add(tracked);
      void tracked.finally(() => held.delete(tracked));
    },
    cron: (expression, job) => {
      const match = DAILY_AT.exec(expression.trim());
      if (!match) {
        throw new Error(
          `the self-hosted runtime implements "0 3 * * *" and nothing else; got "${expression}"`,
        );
      }
      jobs.set(expression, job);
    },
    pending: () => held.size,
    drain: async () => {
      while (held.size > 0) await Promise.all([...held]);
    },
    start: () => {
      for (const [expression, job] of jobs) {
        const match = DAILY_AT.exec(expression.trim());
        if (!match) continue;
        scheduleDaily(Number(match[2]), Number(match[1]), job);
      }
      return () => {
        for (const timer of timers) clearTimeout(timer);
        timers.clear();
      };
    },
    registered: () => [...jobs.keys()],
  };
}
