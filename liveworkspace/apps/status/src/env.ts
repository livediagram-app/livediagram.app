type RateLimiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> };

export interface Env {
  // 'production', 'staging' or 'development', which decides each app's address (@liveworkspace/status).
  ENVIRONMENT: string;
  // liveworkspace.app's origin, where its own services are checked.
  PLATFORM_ORIGIN: string;
  STATUS_DB: D1Database;
  // A secret: the signed `lw_guest` cookie of the guest the signed-in Explorer check mints its tokens for
  // (liveworkspace/docs/specs/009-status/status.md "The signed-in check"). Unset, that check is skipped, never red.
  STATUS_GUEST_COOKIE?: string;
  // Per-network cap on reads the edge cache missed. Optional: absent allows every read.
  READ_RATE_LIMITER?: RateLimiter;
}
