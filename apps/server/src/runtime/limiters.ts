import type { Limiter, LimiterName, Limiters } from '@livediagram/runtime';

// The named rate limiters for the self-hosted runtime: fixed windows in memory,
// keyed \`<limiter>:<key>\`.
//
// The ceilings are the ones apps/api/wrangler.toml declares, copied here because
// that file is Cloudflare's configuration format and this is the other runtime's.
// They are the same numbers on purpose: abuse behaviour should not change with
// the runtime (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
// "Security and trust").

export const LIMITER_CEILINGS: Record<LimiterName, { limit: number; periodSeconds: number }> = {
  WRITE_RATE_LIMITER: { limit: 300, periodSeconds: 60 },
  EVENTS_RATE_LIMITER: { limit: 120, periodSeconds: 60 },
  AI_RATE_LIMITER: { limit: 20, periodSeconds: 60 },
  SHARE_RATE_LIMITER: { limit: 30, periodSeconds: 60 },
  UNFURL_RATE_LIMITER: { limit: 60, periodSeconds: 60 },
  API_TOKEN_READ_RATE_LIMITER: { limit: 120, periodSeconds: 60 },
  DRIVE_TOKEN_RATE_LIMITER: { limit: 10, periodSeconds: 60 },
  HOME_RATE_LIMITER: { limit: 60, periodSeconds: 60 },
  COMMUNITY_RATE_LIMITER: { limit: 30, periodSeconds: 60 },
  WORKBENCH_TICKET_RATE_LIMITER: { limit: 30, periodSeconds: 60 },
};

export type MemoryLimiters = Limiters & {
  /** Forget expired windows; the process calls this on a timer. */
  sweep(): void;
};

export function memoryLimiters(now: () => number = Date.now): MemoryLimiters {
  const windows = new Map<string, { count: number; resetAt: number }>();

  const limiterFor = (name: LimiterName): Limiter => {
    const { limit, periodSeconds } = LIMITER_CEILINGS[name];
    const periodMs = periodSeconds * 1000;
    return {
      limit: async ({ key }) => {
        const at = now();
        const id = `${name}:${key}`;
        const window = windows.get(id);
        if (!window || window.resetAt <= at) {
          windows.set(id, { count: 1, resetAt: at + periodMs });
          return { success: true };
        }
        window.count += 1;
        return { success: window.count <= limit };
      },
    };
  };

  const limiters: MemoryLimiters = {
    sweep: () => {
      const at = now();
      for (const [id, window] of windows) if (window.resetAt <= at) windows.delete(id);
    },
  };
  for (const name of Object.keys(LIMITER_CEILINGS) as LimiterName[]) {
    limiters[name] = limiterFor(name);
  }
  return limiters;
}
