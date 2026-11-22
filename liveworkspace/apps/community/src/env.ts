import type { CommunityApp } from '@liveworkspace/community';

type RateLimiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> };

/** The Workers AI binding as the Forum's check calls it (community.md "The Forum", "The check"). */
export type ForumAi = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

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
  COMMUNITY_KEY_LIVEHUDDLE?: string;
  COMMUNITY_KEY_LIVEKNOWLEDGE?: string;
  // Where each app answers the sweep's door (`<origin>/api/internal/items/community-states`), called with that app's
  // key above. Unset, that app is not swept (community.md "The sweep").
  APP_ORIGIN_LIVEDIAGRAM?: string;
  APP_ORIGIN_LIVEPLANNER?: string;
  APP_ORIGIN_LIVEDOCUMENTS?: string;
  APP_ORIGIN_LIVEDESIGN?: string;
  APP_ORIGIN_LIVEHUDDLE?: string;
  APP_ORIGIN_LIVEKNOWLEDGE?: string;
  // The Forum's account check (community.md "Forum routes"): access tokens are checked offline against
  // `${ACCOUNTS_URL}/api/auth`'s keys, addressed to any app API in INDEX_AUDIENCES (comma separated), as the index and
  // the Drive service check them. Without the audiences every Forum write answers 401.
  ACCOUNTS_URL?: string;
  INDEX_AUDIENCES?: string;
  // Accounts, which the key set is fetched through: a Worker's fetch to another Worker's route on its own zone can
  // stall. Without it the public route is used.
  ACCOUNTS?: { fetch: (input: string, init?: RequestInit) => Promise<Response> };
  // Workers AI, the Forum's check. Optional: without it every new Forum post waits as Pending.
  AI?: ForumAi;
  // Development only: a local run never spends real Workers AI checks, so its Forum posts list as if the check passed;
  // `ai` asks the real check instead (a logged-in `wrangler dev` reaches Workers AI). Read only when ENVIRONMENT is
  // `development`.
  FORUM_CHECK_LOCAL?: string;
}

// Each app's key by name, exhaustive over the apps, so a new app can never fall through to another's key.
const APP_KEY = {
  'livediagram.app': 'COMMUNITY_KEY_LIVEDIAGRAM',
  'liveplanner.app': 'COMMUNITY_KEY_LIVEPLANNER',
  'livedocuments.app': 'COMMUNITY_KEY_LIVEDOCUMENTS',
  'livedesign.app': 'COMMUNITY_KEY_LIVEDESIGN',
  'livehuddle.app': 'COMMUNITY_KEY_LIVEHUDDLE',
  'liveknowledge.app': 'COMMUNITY_KEY_LIVEKNOWLEDGE',
} as const satisfies Record<CommunityApp, keyof Env>;

export function appKey(env: Env, app: CommunityApp): string | undefined {
  return env[APP_KEY[app]];
}

const APP_ORIGIN = {
  'livediagram.app': 'APP_ORIGIN_LIVEDIAGRAM',
  'liveplanner.app': 'APP_ORIGIN_LIVEPLANNER',
  'livedocuments.app': 'APP_ORIGIN_LIVEDOCUMENTS',
  'livedesign.app': 'APP_ORIGIN_LIVEDESIGN',
  'livehuddle.app': 'APP_ORIGIN_LIVEHUDDLE',
  'liveknowledge.app': 'APP_ORIGIN_LIVEKNOWLEDGE',
} as const satisfies Record<CommunityApp, keyof Env>;

// Where the app answers the sweep's door, without a trailing slash, or undefined when it is not set.
export function appOrigin(env: Env, app: CommunityApp): string | undefined {
  const raw = env[APP_ORIGIN[app]]?.trim() ?? '';
  // A backwards scan rather than /\/+$/, which backtracks on a long run of slashes.
  let end = raw.length;
  while (end > 0 && raw[end - 1] === '/') end--;
  const origin = raw.slice(0, end);
  return origin ? origin : undefined;
}

const OFF = new Set(['false', '0', 'off']);

export function communityEnabled(env: Pick<Env, 'COMMUNITY_ENABLED'>): boolean {
  return !OFF.has(env.COMMUNITY_ENABLED?.trim().toLowerCase() ?? '');
}

const DEFAULT_ACCOUNTS_URL = 'https://www.liveworkspace.app';

/** Where access tokens are issued, without a trailing slash. */
export function accountsUrl(env: Pick<Env, 'ACCOUNTS_URL'>): string {
  const raw = env.ACCOUNTS_URL?.trim() || DEFAULT_ACCOUNTS_URL;
  let end = raw.length;
  while (end > 0 && raw[end - 1] === '/') end--;
  return raw.slice(0, end);
}

/** The app API audiences an access token may be addressed to. */
export function audiences(env: Pick<Env, 'INDEX_AUDIENCES'>): string[] {
  return (env.INDEX_AUDIENCES ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

/** Whether a local run lists Forum posts without asking the check: always in development, unless `ai` asks for it. */
export function forumCheckSkippedLocally(
  env: Pick<Env, 'ENVIRONMENT' | 'FORUM_CHECK_LOCAL'>,
): boolean {
  return env.ENVIRONMENT === 'development' && env.FORUM_CHECK_LOCAL?.trim() !== 'ai';
}
