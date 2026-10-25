// Worker bindings (wrangler.toml), in their own module so tools / api / render
// can import the type without cycling through the Hono entrypoint.
export type Env = {
  // Service binding to livedesign-api — tools forward to /api/* through it,
  // carrying the caller's Bearer lwt_ token.
  API: Fetcher;
  // OAuth 2.1 state: client registrations, authorize sessions, codes.
  OAUTH_KV: KVNamespace;
  // Base URL of the app that hosts the OAuth consent page (apps/live). The
  // authorize endpoint redirects the signed-in user there. Defaults to the
  // hosted app; staging points it at its own live origin.
  CONSENT_BASE_URL?: string;
  // liveworkspace's central telemetry service (liveworkspace/docs/telemetry.md). Unset means
  // production's, TELEMETRY_URL in @liveworkspace/telemetry.
  TELEMETRY_URL?: string;
  // livedesign's Worker key for that service (a secret, the same value as the api worker's), sent as
  // X-Telemetry-Key: it is what lets a post with no Origin speak for livedesign.app. Unset means
  // this worker sends no telemetry.
  TELEMETRY_KEY?: string;
};
