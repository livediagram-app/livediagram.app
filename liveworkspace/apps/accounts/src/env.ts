export interface Env {
  ENVIRONMENT: 'production' | 'staging' | 'development';
  // The origin this Worker answers on, e.g. https://liveworkspace.app (it owns only its own paths there)
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
  // The index service (one-explorer-contracts.md), told when a guest signs in. Either unset skips it.
  INDEX_URL?: string;
  INDEX_MERGE_KEY?: string;
  // The index Worker itself, so the merge reaches it rather than going out and back (wrangler.toml).
  INDEX?: Fetcher;

  AUTH_DB: D1Database;
  CODE_IP_LIMITER: RateLimit;
  CODE_EMAIL_LIMITER: RateLimit;
  GUEST_LIMITER: RateLimit;
  // The doors that need no session: a team join link's preview and an invitation's Decline link.
  // Absent (tests), they are not limited.
  TEAM_LINK_LIMITER?: RateLimit;
}
