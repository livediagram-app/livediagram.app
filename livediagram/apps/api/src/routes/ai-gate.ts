import {
  forbidden,
  json,
  methodNotAllowed,
  missingAuth,
  rateLimited,
  signInRequired,
} from '../responses';
import { clientRateKey } from '@liveworkspace/api-kit/client-ip';
import { resolveAiProvider } from '../ai-provider';
import { spendAiDailyBudget } from '../ai-daily-cap';
import type { RouteContext } from './context';

// May this caller use the model at all? (docs/specs/021-event-storming/note-reader.md.)
//
// The one answer to "who may spend the operator's model budget" for the
// sticky-note photo reader — and the order matters as much as the checks: the origin allow-list runs BEFORE auth so a third-party
// site cannot even probe the endpoint for state, the rate limiter runs after
// the rest so a refused caller never consumes anyone's budget, and the
// deployment's daily cap counts last, so only a caller every other check
// admitted spends one of the day's requests.
//
// Returns the Response to send, or null when the caller is admitted.
export async function aiGate(ctx: RouteContext): Promise<Response | null> {
  const { request, env } = ctx;

  // No usable provider: no key, or a half-configured generic
  // (ai-provider.ts logs which). Same answer either way: this deployment does
  // not do AI.
  if (!resolveAiProvider(env)) return json({ error: 'ai_not_configured' }, { status: 503 });

  // Origin allow-list. Optional: unset accepts any Origin, matching
  // the historical open default. When set, the request's Origin must
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

  // Sign-in-only gate. When AI_REQUIRE_SIGN_IN="true", reject guests, whose
  // identities cost a visitor nothing to make, so they can't be used to
  // drain the operator's model budget. Opt-in.
  if (env.AI_REQUIRE_SIGN_IN === 'true' && ctx.accountUserId == null) {
    return signInRequired();
  }

  if (!ctx.resolveOwner()) return missingAuth();

  if (request.method !== 'POST') return methodNotAllowed();

  if (env.AI_RATE_LIMITER) {
    const ip = clientRateKey(request, 'unknown');
    const { success } = await env.AI_RATE_LIMITER.limit({ key: ip });
    if (!success) return rateLimited();
  }

  // The whole deployment's daily cap (ai-daily-cap.ts). Spent, it answers as a provider out of quota does, so the
  // editor reads the rest on the device and says AI is resting for today.
  if (!(await spendAiDailyBudget(env))) return json({ error: 'ai_quota' }, { status: 429 });

  return null;
}
