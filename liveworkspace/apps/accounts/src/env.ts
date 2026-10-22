export interface Env {
  ENVIRONMENT: 'production' | 'staging' | 'development';
  // This Worker's own origin, e.g. https://accounts.liveworkspace.app
  BASE_URL: string;
  // An address on a domain onboarded to Cloudflare Email Sending.
  EMAIL_FROM: string;
  TURNSTILE_SITE_KEY: string;

  BETTER_AUTH_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  ADMIN_TOKEN: string;

  AUTH_DB: D1Database;
  EMAIL: SendEmail;
  CODE_IP_LIMITER: RateLimit;
  CODE_EMAIL_LIMITER: RateLimit;
}
