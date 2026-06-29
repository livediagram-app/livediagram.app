import { emailEnabled } from '../email/client';
import { json, methodNotAllowed } from '../responses';
import type { RouteContext } from './context';

// GET /api/capabilities — no auth required.
// Returns which optional server-side features are configured so the
// live app can hide UI surfaces for features the operator hasn't
// provisioned. Fail-closed by design: an absent / misconfigured
// binding returns false, never true.
export function handleCapabilities(ctx: RouteContext): Response {
  const { env, request } = ctx;
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }
  return json({
    aiEnabled: typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.length > 0,
    // spec/65: the live app hides the email-notification toggles when
    // Resend isn't configured (they'd do nothing). Same gate spec/64 uses.
    emailEnabled: emailEnabled(env),
  });
}
