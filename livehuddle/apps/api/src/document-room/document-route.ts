// An API request about one canvas, answered inside the canvas's Durable Object (docs/specs/015-api/api.md
// "Storage"). The worker resolves who is calling (accounts or guest token, API token, workbench session) and the
// index's grant on the canvas (routes/document-grant.ts), runs the cross-cutting gates (rate limits, read-only
// tokens, workbench confinement, body caps), then hands the request and that identity to the canvas's room
// (`route` RPC). The room rebuilds the RouteContext and runs the handlers against its own SQLite; every access
// check (gateRead / gateEdit / gateParticipate) reads the grant.

import type { TeamClaim } from '@liveworkspace/auth-client';
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
  token: { id: string; readOnly?: boolean; name?: string | null; expiresAt?: number } | null;
  workbench: WorkbenchContext | null;
  bearer: string | null;
  teams: TeamClaim[] | null;
  // The index's grant on this canvas, checked by the worker (routes/document-grant.ts).
  grant: ItemGrant | null;
};

export function identityOf(ctx: RouteContext): RouteIdentity {
  return {
    accountUserId: ctx.accountUserId,
    verifiedUserId: ctx.verifiedUserId,
    accountEmail: ctx.accountEmail,
    owner: ctx.resolveOwner(),
    token: ctx.token ?? null,
    workbench: ctx.workbench ?? null,
    bearer: ctx.bearer ?? null,
    teams: ctx.teams ?? null,
    grant: ctx.grant ?? null,
  };
}

// A canvas's create (`POST /api/documents`, a re-commit of its own id too) is its making, not an edit: whether making
// it is a use is the create's `markUsed` (docs/specs/015-api/api.md "Marking a document used"), so the room records no
// editor for it, which would count a use day for every document of a bulk import.
export function isDocumentCreate(request: Request): boolean {
  return request.method === 'POST' && new URL(request.url).pathname === '/api/documents';
}

// The room's side: the request answered as the worker would have answered it. `community` is the canvas's
// Community post's link, as the room holds it (routes/context.ts grantOn).
export async function answerDocumentRequest(
  env: DocumentEnv,
  request: Request,
  identity: RouteIdentity,
  waitUntil: (promise: Promise<unknown>) => void,
  community: { code: string; open: boolean } | null = null,
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
    community,
    waitUntil,
  };
  // A throw crosses back to the worker, which logs it and answers 500 as for any route (index.ts).
  return handleDocumentRequest(ctx);
}
