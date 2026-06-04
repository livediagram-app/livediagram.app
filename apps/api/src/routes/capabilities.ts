import { json } from '../responses';
import type { RouteContext } from './context';

// GET /api/capabilities — no auth required.
// Returns which optional server-side features are configured so the
// live app can hide UI surfaces for features the operator hasn't
// provisioned. Fail-closed by design: an absent / misconfigured
// binding returns false, never true.
export function handleCapabilities(ctx: RouteContext): Response {
  const { env, request } = ctx;
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, { status: 405 });
  }
  return json({
    aiEnabled: typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.length > 0,
  });
}
