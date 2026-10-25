type RateLimiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> };

export interface Env {
  // 'production', 'staging' or 'development', which decides each app's address (@liveworkspace/status).
  ENVIRONMENT: string;
  // liveworkspace.app's origin, where its own services are checked.
  PLATFORM_ORIGIN: string;
  STATUS_DB: D1Database;
  // The gateway, which liveworkspace.app's own checks go through. Optional: absent (and always in development) they
  // are plain fetches of PLATFORM_ORIGIN.
  PLATFORM?: Fetcher;
  // An app standing in on this account's workers.dev (STAND_INS, @liveworkspace/sites) is reached through its Workers'
  // bindings too, for the same reason: livediagram's router and MCP server until livediagram.app moves. Optional.
  LIVEDIAGRAM_ROUTER?: Fetcher;
  LIVEDIAGRAM_MCP?: Fetcher;
  // Per-network cap on reads the edge cache missed. Optional: absent allows every read.
  READ_RATE_LIMITER?: RateLimiter;
}
