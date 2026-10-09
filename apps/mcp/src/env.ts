// The MCP's platform surface (wrangler.toml), in its own module so tools / api /
// render can import the type without cycling through the Hono entrypoint.
//
// Both runtimes satisfy this type. The Worker gets it from its bindings; the
// self-hosted Node process builds it in apps/mcp/src/node/ (docs/specs/016-platform/self-hosted-runtime.md,
// "MCP process"), where the service binding is an HTTP call, the KV namespace is
// a SQLite table and the secret is an environment variable.

// The slice of `KVNamespace` the OAuth server uses: short-TTL scratch state for
// client registrations, authorize sessions, codes and device records. Narrower
// than the Worker binding on purpose — a Node process has no KV, and nothing
// above needs the rest of the interface.
export type OauthKv = {
  get(key: string): Promise<string | null>;
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type Env = {
  // The api's own surface: tools forward to /api/* through it, carrying the
  // caller's Bearer lvd_ token. A Worker reaches it over a service binding; the
  // Node process over HTTP to the app process.
  API: Fetcher;
  // OAuth 2.1 state: client registrations, authorize sessions, codes.
  OAUTH_KV: OauthKv;
  // Base URL of the app that hosts the OAuth consent page (apps/live). The
  // authorize endpoint redirects the signed-in user there. Defaults to the
  // hosted app; self-hosters point it at their own live origin.
  CONSENT_BASE_URL?: string;
  // Shared secret that marks our telemetry posts as coming from this worker
  // rather than the open internet (docs/specs/017-telemetry/telemetry.md, issue #36). Optional: without it
  // the posts still work, they just share the anonymous per-IP rate-limit
  // bucket, which is what was silently dropping them. Must match the api
  // worker's INTERNAL_EVENTS_KEY.
  INTERNAL_EVENTS_KEY?: string;
};
