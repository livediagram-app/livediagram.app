// The index's grant on the plan a request is about (liveworkspace/docs/one-explorer-contracts.md "Grants"), as the
// worker settles it before the request goes to the plan's Durable Object.
//
//   - The editor sends the grant it fetched itself (`POST /api/index/items/:id/grant`) as X-Index-Grant
//     (INDEX_GRANT_HEADER): checked offline against the index's keys, no call.
//   - Anything else (an API token, a workbench session, a browser that sent none) gets one fetched here
//     (index-service.ts `requestGrant`, cached until a minute before it lapses): as that account with this app's
//     key, or with the browser's own bearer and share headers.
//
// A refusal that the caller can act on (the plan's password) comes back as the index's answer; any other miss
// leaves the request without a grant, and the plan's gates answer it as they answer no access.

import { INDEX_GRANT_HEADER } from '@liveplanner/api-schema';
import { planGrantOf, requestGrant, verifyPlanGrant, type PlanGrant } from '../index-service';
import { json } from '../responses';
import { grantCallerOf, shareAccessOf, shareCodeOf, type RouteContext } from './context';

const PASSWORD_REFUSALS = new Set(['password_required', 'password_invalid']);

export async function resolvePlanGrant(
  ctx: RouteContext,
  planId: string,
): Promise<PlanGrant | null | Response> {
  const { env, request } = ctx;
  const sent = request.headers.get(INDEX_GRANT_HEADER);
  if (sent) {
    const claims = await verifyPlanGrant(env, sent, planId);
    if (claims) return planGrantOf(claims, shareCodeOf(request), sent);
  }
  const caller = grantCallerOf(ctx);
  const share = shareAccessOf(request);
  // Nobody to ask for: no identity and no link.
  if (caller.kind === 'bearer' && !caller.token && !share) return null;
  if (caller.kind === 'delegate' && !caller.personId) return null;
  const outcome = await requestGrant(env, caller, planId, share);
  if (!outcome.ok) {
    if (PASSWORD_REFUSALS.has(outcome.error))
      return json({ error: outcome.error }, { status: outcome.status });
    return null;
  }
  const claims = await verifyPlanGrant(env, outcome.grant.grant, planId);
  return claims ? planGrantOf(claims, share?.code ?? null, outcome.grant.grant) : null;
}
