import type { TelemetryApp } from '@liveworkspace/telemetry';

type RateLimiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> };

export interface Env {
  // 'production', 'staging' or 'development'. Development also takes events from localhost pages.
  ENVIRONMENT: string;
  // Only the literal "true" stores or serves anything, so a fresh deployment is off until it opts in.
  TELEMETRY_ENABLED?: string;
  TELEMETRY_DB: D1Database;
  // Per-network cap on browser batches. Optional: absent allows every batch.
  EVENTS_RATE_LIMITER?: RateLimiter;
  // Each app's Worker secret (wrangler secret put), proving a batch with no Origin came from that
  // app's own Workers. Unset means that app's Workers can't send.
  TELEMETRY_KEY_LIVEDIAGRAM?: string;
  TELEMETRY_KEY_LIVEPLANNER?: string;
}

export function appKey(env: Env, app: TelemetryApp): string | undefined {
  return app === 'livediagram.app' ? env.TELEMETRY_KEY_LIVEDIAGRAM : env.TELEMETRY_KEY_LIVEPLANNER;
}
