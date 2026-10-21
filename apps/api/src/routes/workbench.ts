// /api/workbench/* (docs/specs/013-workspace/blueprints/workbench-embeds.md "Routes"): tickets, sessions,
// pairing requests and pairings, each in its own module. Matched by literal segment index and method, as
// every route module is, so the OpenAPI drift test can probe it.

import { methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from './context';
import {
  answerPairing,
  listPairings,
  openPairing,
  pollPairing,
  readPairing,
  unpair,
} from './workbench-pairing-routes';
import { endCurrentWorkbenchSession, redeemWorkbenchTicket } from './workbench-session-routes';
import { mintWorkbenchTicket } from './workbench-ticket-route';

export async function handleWorkbench(ctx: RouteContext): Promise<Response> {
  const { segments, request } = ctx;
  const method = request.method;

  if (segments.length === 3 && segments[2] === 'tickets') {
    return method === 'POST' ? mintWorkbenchTicket(ctx) : methodNotAllowed();
  }
  if (segments.length === 3 && segments[2] === 'sessions') {
    return method === 'POST' ? redeemWorkbenchTicket(ctx) : methodNotAllowed();
  }
  if (segments.length === 4 && segments[2] === 'sessions' && segments[3] === 'current') {
    return method === 'DELETE' ? endCurrentWorkbenchSession(ctx) : methodNotAllowed();
  }

  if (segments.length === 3 && segments[2] === 'pairing-requests') {
    return method === 'POST' ? openPairing(ctx) : methodNotAllowed();
  }
  if (segments.length === 4 && segments[2] === 'pairing-requests') {
    return method === 'GET' ? readPairing(ctx, segments[3]!) : methodNotAllowed();
  }
  if (segments.length === 5 && segments[2] === 'pairing-requests' && segments[4] === 'status') {
    return method === 'GET' ? pollPairing(ctx, segments[3]!) : methodNotAllowed();
  }
  if (segments.length === 5 && segments[2] === 'pairing-requests' && segments[4] === 'approve') {
    return method === 'POST' ? answerPairing(ctx, segments[3]!, 'approve') : methodNotAllowed();
  }
  if (segments.length === 5 && segments[2] === 'pairing-requests' && segments[4] === 'decline') {
    return method === 'POST' ? answerPairing(ctx, segments[3]!, 'decline') : methodNotAllowed();
  }

  if (segments.length === 3 && segments[2] === 'pairings') {
    return method === 'GET' ? listPairings(ctx) : methodNotAllowed();
  }
  if (segments.length === 4 && segments[2] === 'pairings') {
    return method === 'DELETE' ? unpair(ctx, segments[3]!) : methodNotAllowed();
  }
  return notFound();
}
