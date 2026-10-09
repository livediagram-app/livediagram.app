// The named rate limiters, keyed by the binding name they replace so a
// migration of a call site reads as `runtime.limiters.WRITE_RATE_LIMITER`
// against today's `env.WRITE_RATE_LIMITER`.
//
// Every limiter is optional: the bindings are declared in
// apps/api/wrangler.toml, and an unprovisioned binding has always meant
// "allow" (a self-host without the paid Cloudflare feature still works). The
// helper that reads them keeps that semantics.

export type LimiterResult = { success: boolean };

export type Limiter = {
  limit(input: { key: string }): Promise<LimiterResult>;
};

export type LimiterName =
  | 'WRITE_RATE_LIMITER'
  | 'EVENTS_RATE_LIMITER'
  | 'AI_RATE_LIMITER'
  | 'SHARE_RATE_LIMITER'
  | 'UNFURL_RATE_LIMITER'
  | 'API_TOKEN_READ_RATE_LIMITER'
  | 'DRIVE_TOKEN_RATE_LIMITER'
  | 'HOME_RATE_LIMITER'
  | 'COMMUNITY_RATE_LIMITER'
  | 'WORKBENCH_TICKET_RATE_LIMITER';

export type Limiters = Partial<Record<LimiterName, Limiter>>;
