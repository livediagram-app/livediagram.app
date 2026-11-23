import type { KeysFetcher } from '@liveworkspace/auth-client';
import { proEnabled, type SubscriptionApp } from '@liveworkspace/subscription';

type RateLimiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> };

export interface Env {
  // 'production', 'staging' or 'development'. Development also answers localhost pages; development and staging
  // take the `?currency=` override on the prices.
  ENVIRONMENT: string;
  // Development only: JSON lowering Free's limits so one can be met by hand (src/dev-limits.ts). Ignored elsewhere.
  DEV_FREE_LIMITS?: string;
  // The one switch Pro sits behind (subscription.md "The flag"): `true`, `1` or `on`. Anything else, or unset, and
  // every route answers 404.
  PRO_ENABLED?: string;
  SUBSCRIPTION_DB: D1Database;
  // Which billing provider checkout and the portal go through: `stripe`, or `mock` (never in production). Anything
  // else, unset, or a provider without what it needs, and both answer 503 (src/billing/provider.ts, subscription.md
  // "Billing").
  BILLING_PROVIDER?: string;
  // The Stripe provider (subscription.md "Stripe"). Secrets (wrangler secret put): a restricted key with write access
  // to Checkout Sessions, Customer Portal sessions and Subscriptions and read access to Invoices, and the webhook
  // endpoint's signing secret. Vars: the two monthly Prices' ids, and optionally the portal configuration (bpc_...)
  // to open, else the account's default.
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_TEAM?: string;
  STRIPE_PORTAL_CONFIGURATION?: string;
  // Where liveworkspace.app's pages live, without a trailing slash: the mock checkout and portal pages are the
  // site's. Unset means production's.
  SITE_ORIGIN?: string;
  // Each app's Worker secret (wrangler secret put), proving an internal route's caller is that app's own Worker.
  // Unset means that app can ask nothing. LIVEWORKSPACE is the platform Workers' (media and the rest).
  SUBSCRIPTION_KEY_LIVEDIAGRAM?: string;
  SUBSCRIPTION_KEY_LIVEPLANNER?: string;
  SUBSCRIPTION_KEY_LIVEDOCUMENTS?: string;
  SUBSCRIPTION_KEY_LIVEDESIGN?: string;
  SUBSCRIPTION_KEY_LIVEHUDDLE?: string;
  SUBSCRIPTION_KEY_LIVEKNOWLEDGE?: string;
  SUBSCRIPTION_KEY_LIVEWORKSPACE?: string;
  // The browser routes' account check: access tokens are checked offline against `${ACCOUNTS_URL}/api/auth`'s keys,
  // addressed to any app API in INDEX_AUDIENCES (comma separated), as the index, Drive and the Forum check them.
  // Without the audiences every signed-in route answers 401.
  ACCOUNTS_URL?: string;
  INDEX_AUDIENCES?: string;
  // Accounts, which the key set and a team's members are fetched through: a Worker's fetch to another Worker's route
  // on its own zone can stall. Without it the public route is used.
  ACCOUNTS?: KeysFetcher;
  // An OAuth client at accounts, for a team's joined members (its seats) and for who its admins are now. Without
  // them a team's seats are the minimum, or whatever its subscription last held, and a team's checkout, portal and
  // billing changes are refused (`accounts_unavailable`): a team's billing never rests on a token's claim alone.
  ACCOUNTS_CLIENT_ID?: string;
  ACCOUNTS_CLIENT_SECRET?: string;
  // Media, asked what each owner holds (Image Storage, Walkthroughs Stored) when a person reads their usage
  // (src/media-usage.ts), with the key the two already share (SUBSCRIPTION_KEY_LIVEWORKSPACE, media's
  // SUBSCRIPTION_KEY). MEDIA is the service binding; without it MEDIA_URL (`<SITE_ORIGIN>/api/media` when unset) is
  // fetched. When media cannot answer, those two figures are left out, never guessed.
  MEDIA?: { fetch: (input: string, init?: RequestInit) => Promise<Response> };
  MEDIA_URL?: string;
  // The budget for the mock provider's pages and for starting a checkout or opening the portal. Optional: absent
  // allows all.
  SUBSCRIPTION_RATE_LIMITER?: RateLimiter;
}

// Each app's key by name, exhaustive over the apps, so a new app can never fall through to another's key.
const APP_KEY = {
  'livediagram.app': 'SUBSCRIPTION_KEY_LIVEDIAGRAM',
  'liveplanner.app': 'SUBSCRIPTION_KEY_LIVEPLANNER',
  'livedocuments.app': 'SUBSCRIPTION_KEY_LIVEDOCUMENTS',
  'livedesign.app': 'SUBSCRIPTION_KEY_LIVEDESIGN',
  'livehuddle.app': 'SUBSCRIPTION_KEY_LIVEHUDDLE',
  'liveknowledge.app': 'SUBSCRIPTION_KEY_LIVEKNOWLEDGE',
  'liveworkspace.app': 'SUBSCRIPTION_KEY_LIVEWORKSPACE',
} as const satisfies Record<SubscriptionApp, keyof Env>;

export function appKey(env: Env, app: SubscriptionApp): string | undefined {
  return env[APP_KEY[app]]?.trim() || undefined;
}

export function subscriptionEnabled(env: Pick<Env, 'PRO_ENABLED'>): boolean {
  return proEnabled(env.PRO_ENABLED);
}

export type Environment = 'production' | 'staging' | 'development';

/** Which deployment this is. Anything unrecognised is production, the strictest. */
export function environmentOf(env: Pick<Env, 'ENVIRONMENT'>): Environment {
  return env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'staging'
    ? env.ENVIRONMENT
    : 'production';
}

// A backwards scan rather than /\/+$/, which backtracks on a long run of slashes.
function withoutTrailingSlashes(raw: string): string {
  let end = raw.length;
  while (end > 0 && raw[end - 1] === '/') end--;
  return raw.slice(0, end);
}

const DEFAULT_SITE_ORIGIN = 'https://www.liveworkspace.app';

/** Where access tokens are issued, without a trailing slash. */
export function accountsUrl(env: Pick<Env, 'ACCOUNTS_URL'>): string {
  return withoutTrailingSlashes(env.ACCOUNTS_URL?.trim() || DEFAULT_SITE_ORIGIN);
}

/** Where the site's pages live, without a trailing slash. */
export function siteOrigin(env: Pick<Env, 'SITE_ORIGIN'>): string {
  return withoutTrailingSlashes(env.SITE_ORIGIN?.trim() || DEFAULT_SITE_ORIGIN);
}

/** Where media's API lives, without a trailing slash. */
export function mediaUrl(env: Pick<Env, 'MEDIA_URL' | 'SITE_ORIGIN'>): string {
  return withoutTrailingSlashes(env.MEDIA_URL?.trim() || `${siteOrigin(env)}/api/media`);
}

/** The app API audiences an access token may be addressed to. */
export function audiences(env: Pick<Env, 'INDEX_AUDIENCES'>): string[] {
  return (env.INDEX_AUDIENCES ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}
