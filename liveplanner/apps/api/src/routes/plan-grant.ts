// The index's grant on the plan a request is about (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as the
// worker settles it before the request goes to the plan's Durable Object: @liveworkspace/index-app's
// resolveItemGrant, with this api's caller and responses. See it for the order (the sent X-Index-Grant first,
// then one fetched for the caller) and what a refusal answers.

import { resolveItemGrant } from '@liveworkspace/index-app';
import { indexService, type PlanGrant } from '../index-service';
import { json } from '../responses';
import { grantCallerOf, type RouteContext } from './context';

export function resolvePlanGrant(
  ctx: RouteContext,
  planId: string,
): Promise<PlanGrant | null | Response> {
  return resolveItemGrant(
    indexService,
    ctx.env,
    ctx.request,
    grantCallerOf(ctx),
    planId,
    (body, status) => json(body, { status }),
  );
}
