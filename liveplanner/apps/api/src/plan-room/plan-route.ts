// An API request about one plan, answered inside the plan's Durable Object (docs/specs/015-api/api.md
// "Storage"). The worker resolves who is calling (accounts or guest token, API token, workbench session) and the
// index's grant on the plan (routes/plan-grant.ts), runs the cross-cutting gates (rate limits, read-only tokens,
// workbench confinement, body caps), then hands the request and that identity to the plan's room (`route` RPC).
// The room rebuilds the RouteContext and runs the handlers against its own SQLite; every access check (gateRead / gateEdit / gateParticipate) reads the grant.

import type { PlanRouteContext, RouteContext, WorkbenchContext } from '../routes/context';
import { handleForms } from '../routes/forms';
import { handlePlanRequest } from '../routes/projects';
import type { TeamClaim } from '@liveworkspace/auth-client';
import type { PlanGrant } from '../index-service';
import type { PlanEnv } from '../types';

// The caller as the worker resolved it: plain data, so it crosses the RPC boundary.
export type RouteIdentity = {
  accountUserId: string | null;
  verifiedUserId: string | null;
  accountEmail: string | null;
  // resolveOwner()'s answer.
  owner: string | null;
  token: { id: string; readOnly?: boolean } | null;
  workbench: WorkbenchContext | null;
  teams: TeamClaim[] | null;
  bearer: string | null;
  // The index's grant on this plan, checked by the worker (routes/plan-grant.ts).
  grant: PlanGrant | null;
};

export function identityOf(ctx: RouteContext): RouteIdentity {
  return {
    accountUserId: ctx.accountUserId,
    verifiedUserId: ctx.verifiedUserId,
    accountEmail: ctx.accountEmail,
    owner: ctx.resolveOwner(),
    token: ctx.token ?? null,
    workbench: ctx.workbench ?? null,
    teams: ctx.teams ?? null,
    bearer: ctx.bearer ?? null,
    grant: ctx.grant ?? null,
  };
}

// The room's side: the request answered as the worker would have answered it.
export async function answerPlanRequest(
  env: PlanEnv,
  request: Request,
  identity: RouteIdentity,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const url = new URL(request.url);
  const ctx: PlanRouteContext = {
    request,
    env,
    url,
    segments: url.pathname.replace(/^\//, '').split('/'),
    accountUserId: identity.accountUserId,
    verifiedUserId: identity.verifiedUserId,
    accountEmail: identity.accountEmail,
    resolveOwner: () => identity.owner,
    token: identity.token,
    workbench: identity.workbench,
    teams: identity.teams,
    bearer: identity.bearer,
    grant: identity.grant,
    waitUntil,
  };
  // A throw crosses back to the worker, which logs it and answers 500 as for any route (index.ts).
  return ctx.segments[1] === 'forms' ? handleForms(ctx) : handlePlanRequest(ctx);
}
