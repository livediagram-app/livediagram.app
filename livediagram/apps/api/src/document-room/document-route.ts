// An API request about one document, answered inside the document's Durable Object (docs/specs/015-api/api.md
// "Storage"). The worker resolves who is calling (accounts token, API token, workbench session, guest header),
// runs the cross-cutting gates (rate limits, read-only tokens, workbench confinement, body caps), then hands the
// request and that identity to the document's room (`route` RPC). The room rebuilds the RouteContext and runs the same
// handlers as before, against its own SQLite for content and D1 for everything else, so every per-route access
// check (gateRead / gateEdit / gateParticipate and the owner guards) is unchanged.

import type { DocumentRouteContext, RouteContext, WorkbenchContext } from '../routes/context';
import { handleDocumentRequest } from '../routes/documents';
import type { DocumentEnv } from '../types';
import type { ItemGrant } from '../index-service';

// The caller as the worker resolved it: plain data, so it crosses the RPC boundary.
export type RouteIdentity = {
  accountUserId: string | null;
  verifiedUserId: string | null;
  accountEmail: string | null;
  // resolveOwner()'s answer.
  owner: string | null;
  token: { id: string; readOnly?: boolean } | null;
  workbench: WorkbenchContext | null;
  bearer: string | null;
  teams: readonly string[];
  // The index's grant on this document, as the worker settled it.
  grant: ItemGrant | null;
};

export function identityOf(ctx: RouteContext, grant: ItemGrant | null = null): RouteIdentity {
  return {
    accountUserId: ctx.accountUserId,
    verifiedUserId: ctx.verifiedUserId,
    accountEmail: ctx.accountEmail,
    owner: ctx.resolveOwner(),
    token: ctx.token ?? null,
    workbench: ctx.workbench ?? null,
    bearer: ctx.bearer ?? null,
    teams: ctx.teams ?? [],
    grant,
  };
}

// The room's side: the request answered as the worker would have answered it.
export async function answerDocumentRequest(
  env: DocumentEnv,
  request: Request,
  identity: RouteIdentity,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const url = new URL(request.url);
  const ctx: DocumentRouteContext = {
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
    bearer: identity.bearer,
    teams: identity.teams,
    grant: identity.grant,
    waitUntil,
  };
  // A throw crosses back to the worker, which logs it and answers 500 as for any route (index.ts).
  return handleDocumentRequest(ctx);
}
