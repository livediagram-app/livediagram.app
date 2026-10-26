// Every product's MCP Worker bindings (its apps/mcp/wrangler.toml), in their own module so tools / api / render
// can import the type without cycling through the Hono entrypoint.
export type Env = {
  // Service binding to the product's api Worker (<product>-api): tools forward to /api/* through it,
  // carrying the caller's Bearer lwt_ token.
  API: Fetcher;
  // OAuth 2.1 state: client registrations, authorize sessions, codes.
  OAUTH_KV: KVNamespace;
  // Base URL of the app that hosts the OAuth consent page (the product's editor). The
  // authorize endpoint redirects the signed-in user there. Defaults to the
  // hosted app; other deployments point it at their own editor origin.
  CONSENT_BASE_URL?: string;
  // The liveworkspace telemetry service (liveworkspace/docs/specs/008-telemetry/telemetry.md). Unset means production's,
  // TELEMETRY_URL in @liveworkspace/telemetry; staging and local development name their own.
  TELEMETRY_URL?: string;
  // The product's secret on that service, sent as X-Telemetry-Key (the same value as its api
  // worker's TELEMETRY_KEY): it is what lets a post with no Origin speak for the product's site. A secret;
  // unset means this worker sends no telemetry, which is also what a deployment gets with no configuration.
  TELEMETRY_KEY?: string;
};
