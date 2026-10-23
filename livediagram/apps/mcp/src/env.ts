// Worker bindings (wrangler.toml), in their own module so tools / api / render
// can import the type without cycling through the Hono entrypoint.
export type Env = {
  // Service binding to livediagram-api — tools forward to /api/* through it,
  // carrying the caller's Bearer lwt_ token.
  API: Fetcher;
  // OAuth 2.1 state: client registrations, authorize sessions, codes.
  OAUTH_KV: KVNamespace;
  // Base URL of the app that hosts the OAuth consent page (apps/editor). The
  // authorize endpoint redirects the signed-in user there. Defaults to the
  // hosted app; self-hosters point it at their own live origin.
  CONSENT_BASE_URL?: string;
  // The liveworkspace telemetry service (liveworkspace/docs/telemetry.md). Unset means production's,
  // https://liveworkspace.app/api/telemetry; staging and local development name their own.
  TELEMETRY_URL?: string;
  // livediagram's secret on that service, sent as X-Telemetry-Key (the same value as the api
  // worker's TELEMETRY_KEY). A secret; unset means this worker sends no telemetry, which is also
  // what a self-hosted deployment gets with no configuration.
  TELEMETRY_KEY?: string;
};
