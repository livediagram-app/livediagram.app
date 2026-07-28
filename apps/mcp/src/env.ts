// Worker bindings (wrangler.toml), in their own module so tools / api / render
// can import the type without cycling through the Hono entrypoint.
export type Env = {
  // Service binding to livediagram-api — tools forward to /api/* through it,
  // carrying the caller's Bearer lvd_ token.
  API: Fetcher;
  // OAuth 2.1 state: client registrations, authorize sessions, codes.
  OAUTH_KV: KVNamespace;
  // Base URL of the app that hosts the OAuth consent page (apps/live). The
  // authorize endpoint redirects the signed-in user there. Defaults to the
  // hosted app; self-hosters point it at their own live origin.
  CONSENT_BASE_URL?: string;
  // Shared secret that marks our telemetry posts as coming from this worker
  // rather than the open internet (spec/22, issue #36). Optional: without it
  // the posts still work, they just share the anonymous per-IP rate-limit
  // bucket, which is what was silently dropping them. Must match the api
  // worker's INTERNAL_EVENTS_KEY.
  INTERNAL_EVENTS_KEY?: string;
};
