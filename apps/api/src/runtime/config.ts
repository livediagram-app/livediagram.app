import type { Runtime } from '../types';
import type { Runtime as SeamRuntime } from '@livediagram/runtime';

// Which `Env` members are configuration rather than platform bindings.
//
// The list is derived from `Env` itself (apps/api/src/types.ts) and lives here,
// beside the type it mirrors, because this is the module that owns the answer to
// "what does the application read?". The self-hosted runtime fills exactly these
// from its own environment, so a new `env.SOMETHING` read is either added here
// (and becomes settable on a self-host) or is a binding (and belongs to the seam).
//
// A unit test asserts the two stay in step: a key added to `Env` but not here
// fails, rather than silently reading `undefined` on a self-hosted deployment.

/** Everything in `Env` that is not a platform binding. */
export type RuntimeConfig = Omit<Runtime, keyof SeamRuntime>;

export const RUNTIME_CONFIG_KEYS = [
  'BUILD_ID',
  'CLERK_JWKS_URL',
  'OAUTH_ISSUER',
  'CLI_MIN_VERSION',
  'CLERK_ISSUER',
  'CLERK_AUDIENCE',
  'GUEST_ID_HMAC_SECRET',
  'GUEST_SIG_ENFORCE_AFTER',
  'GUEST_SIGNING_LIVE_AT',
  'COMMUNITY_ENABLED',
  'TELEMETRY_ENABLED',
  'INTERNAL_EVENTS_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'APP_BASE_URL',
  'GOOGLE_AI_STUDIO_API_KEY',
  'OPENAI_API_KEY',
  'AI_API_KEY',
  'AI_BASE_URL',
  'AI_MODEL',
  'AI_VISION_MODEL',
  'AI_ALLOWED_ORIGINS',
  'AI_REQUIRE_CLERK',
  'IMAGE_MAX_PER_OWNER',
  'IMAGE_MAX_BYTES_PER_OWNER',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'DRIVE_TOKEN_KEY',
  'GOOGLE_OAUTH_BASE_URL',
] as const satisfies readonly (keyof RuntimeConfig)[];

/**
 * Read the configuration out of a plain key/value source — `process.env` on a
 * self-host, the Worker bindings on Cloudflare. Unset keys are omitted rather
 * than set to undefined, so `'X' in env` keeps meaning what it means today.
 */
export function runtimeConfigFrom(vars: Record<string, string | undefined>): RuntimeConfig {
  const config: Record<string, string> = {};
  for (const key of RUNTIME_CONFIG_KEYS) {
    const value = vars[key];
    if (typeof value === 'string') config[key] = value;
  }
  return config as RuntimeConfig;
}
