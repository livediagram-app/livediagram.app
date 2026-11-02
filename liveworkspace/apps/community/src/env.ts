import type { CommunityApp } from '@liveworkspace/community';

type RateLimiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> };

export interface Env {
  // 'production', 'staging' or 'development'. Development also answers localhost pages and skips the
  // edge cache, so a like shows at once.
  ENVIRONMENT: string;
  // The service's off switch: "false", "0" or "off" answers every route as missing. Unset is on.
  COMMUNITY_ENABLED?: string;
  COMMUNITY_DB: D1Database;
  // Per-network budget for likes and reports, whose callers are anonymous. Optional: absent allows all.
  COMMUNITY_RATE_LIMITER?: RateLimiter;
  // Each app's Worker secret (wrangler secret put), proving an app route's caller is that app's own
  // Worker. Unset means that app can't publish, sync or read My Shares.
  COMMUNITY_KEY_LIVEDIAGRAM?: string;
  COMMUNITY_KEY_LIVEPLANNER?: string;
  COMMUNITY_KEY_LIVEDOCUMENTS?: string;
  COMMUNITY_KEY_LIVEDESIGN?: string;
}

// Each app's key by name, exhaustive over the apps, so a new app can never fall through to another's key.
const APP_KEY = {
  'livediagram.app': 'COMMUNITY_KEY_LIVEDIAGRAM',
  'liveplanner.app': 'COMMUNITY_KEY_LIVEPLANNER',
  'livedocuments.app': 'COMMUNITY_KEY_LIVEDOCUMENTS',
  'livedesign.app': 'COMMUNITY_KEY_LIVEDESIGN',
} as const satisfies Record<CommunityApp, keyof Env>;

export function appKey(env: Env, app: CommunityApp): string | undefined {
  return env[APP_KEY[app]];
}

const OFF = new Set(['false', '0', 'off']);

export function communityEnabled(env: Pick<Env, 'COMMUNITY_ENABLED'>): boolean {
  return !OFF.has(env.COMMUNITY_ENABLED?.trim().toLowerCase() ?? '');
}
