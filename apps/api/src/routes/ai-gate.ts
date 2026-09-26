import {
  forbidden,
  json,
  methodNotAllowed,
  missingAuth,
  rateLimited,
  signInRequired,
} from '../responses';
import { clientIp } from '../client-ip';
import { resolveAiProvider } from '../ai-provider';
import type { RouteContext } from './context';

// May this caller use the model at all? (docs/specs/007-editor/ai-assistance.md.)
//
// Lifted out of `handleAi` verbatim when a SECOND model route arrived (the
// event-storming photo reader, docs/specs/021-event-storming/event-storming.md Phase 8). One answer to "who may spend
// the operator's model budget", not two that drift — and the order matters as
// much as the checks: the origin allow-list runs BEFORE auth so a third-party
// site cannot even probe the endpoint for state, and the rate limiter runs
// last so a refused caller never consumes anyone's budget.
//
// Returns the Response to send, or null when the caller is admitted.
export async function aiGate(ctx: RouteContext): Promise<Response | null> {
  const { request, env } = ctx;

  // No usable provider — no key, or more than one, or a half-configured
  // generic (ai-provider.ts logs which). Same answer either way: this
  // deployment does not do AI.
  if (!resolveAiProvider(env)) return json({ error: 'ai_not_configured' }, { status: 503 });

  // Origin allow-list (docs/specs/007-editor/ai-assistance.md). Optional: unset accepts any Origin, matching
  // the historical OSS self-host story. When set, the request's Origin must
  // match one of the comma-separated entries exactly — case-sensitive against
  // the raw header, because every modern browser sends a canonical lower-case
  // scheme + host and we want a strict deny default.
  if (env.AI_ALLOWED_ORIGINS && env.AI_ALLOWED_ORIGINS.length > 0) {
    const allowed = env.AI_ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const origin = request.headers.get('Origin');
    if (!origin || !allowed.includes(origin)) {
      return forbidden('origin_not_allowed');
    }
  }

  // Clerk-only gate (docs/specs/007-editor/ai-assistance.md). When AI_REQUIRE_CLERK="true", reject the legacy
  // X-Owner-Id guest path so an attacker can't mint fresh per-request UUIDs to
  // drain the operator's model budget. Opt-in, so an OSS self-host that runs no
  // Clerk at all keeps the feature usable.
  if (env.AI_REQUIRE_CLERK === 'true' && ctx.clerkUserId == null) {
    return signInRequired();
  }

  if (!ctx.resolveOwner()) return missingAuth();

  if (request.method !== 'POST') return methodNotAllowed();

  if (env.AI_RATE_LIMITER) {
    const ip = clientIp(request, 'unknown');
    const { success } = await env.AI_RATE_LIMITER.limit({ key: ip });
    if (!success) return rateLimited();
  }

  return null;
}
