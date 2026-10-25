import type { WorkbenchNamespace } from './workbench/store.ts';

export interface Env {
  ENVIRONMENT: 'production' | 'staging' | 'development';
  // The origin this Worker answers on, e.g. https://liveworkspace-gateway.liveworkspace-easing509.workers.dev (it owns only its own paths there)
  BASE_URL: string;
  // The From address, on a domain verified in Resend.
  EMAIL_FROM: string;
  TURNSTILE_SITE_KEY: string;

  BETTER_AUTH_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  ADMIN_TOKEN: string;
  // Resend's API key. Required in staging and production; without it, development logs each email.
  RESEND_API_KEY?: string;
  // Both set turns on "Continue with Google"; either missing leaves email codes only.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Signing in on each app's own address (handoff.ts): "true" sends the sign-in pages to the app's address, which
  // needs every app's router to serve them first. Anything else keeps them on this site.
  SIGN_IN_ON_APP_ORIGINS?: string;
  // "true" once every app origin's /api/workspace/auth/callback/google is an authorised redirect URI of the Google
  // client: Google then runs on the app's address too. Until then the Google button on an app's address goes to this
  // site's sign-in page and signs in there, as before.
  GOOGLE_ON_APP_ORIGINS?: string;
  // The index service (one-explorer-contracts.md), told when a guest signs in (either unset skips it)
  // and when an account closes (either unset leaves the purge waiting in pending_purges).
  INDEX_URL?: string;
  INDEX_MERGE_KEY?: string;
  // The index Worker itself, so the merge reaches it rather than going out and back (wrangler.toml).
  INDEX?: Fetcher;

  // The telemetry service (liveworkspace/docs/telemetry.md), told when an onboarding email goes
  // (src/telemetry.ts): its URL, reached through the TELEMETRY service binding when there is one, and
  // each app's Worker key, the same values the telemetry Worker holds. Unset, nothing is reported.
  TELEMETRY_URL?: string;
  TELEMETRY?: Fetcher;
  TELEMETRY_KEY_LIVEDIAGRAM?: string;
  TELEMETRY_KEY_LIVEPLANNER?: string;
  TELEMETRY_KEY_LIVEDOCUMENTS?: string;
  TELEMETRY_KEY_LIVEDESIGN?: string;

  AUTH_DB: D1Database;
  // Workbench pairings, tickets and sessions (liveworkspace/docs/workbench.md): one store per person, and the limit
  // on a token's mints and pairing requests. Absent (tests that don't need them), the workbench routes answer 503.
  WORKBENCH?: WorkbenchNamespace;
  WORKBENCH_LIMITER?: RateLimit;
  CODE_IP_LIMITER: RateLimit;
  CODE_EMAIL_LIMITER: RateLimit;
  GUEST_LIMITER: RateLimit;
  // The doors that need no session: a team join link's preview and an invitation's Decline link.
  // Absent (tests), they are not limited.
  TEAM_LINK_LIMITER?: RateLimit;
}
