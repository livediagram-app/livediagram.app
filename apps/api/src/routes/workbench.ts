// /api/workbench/* (docs/specs/013-workspace/blueprints/workbench-embeds.md "Routes"): tickets, sessions,
// pairing requests and pairings, each in its own module.

import { methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from './context';
import {
  answerPairing,
  isPairingCode,
  listPairings,
  openPairing,
  pollPairing,
  readPairing,
  unpair,
} from './workbench-pairing-routes';
import { endCurrentWorkbenchSession, redeemWorkbenchTicket } from './workbench-session-routes';
import { mintWorkbenchTicket } from './workbench-ticket-route';

const only = (method: string, wanted: string, run: () => Promise<Response>) =>
  method === wanted ? run() : Promise.resolve(methodNotAllowed());

function pairingRequestRoute(ctx: RouteContext, method: string): Promise<Response> {
  const [, , , code, verb] = ctx.segments;
  if (code === undefined) return only(method, 'POST', () => openPairing(ctx));
  if (!isPairingCode(code) || ctx.segments.length > 5) return Promise.resolve(notFound());
  if (verb === undefined) return only(method, 'GET', () => readPairing(ctx, code));
  if (verb === 'status') return only(method, 'GET', () => pollPairing(ctx, code));
  if (verb === 'approve' || verb === 'decline')
    return only(method, 'POST', () => answerPairing(ctx, code, verb));
  return Promise.resolve(notFound());
}

export async function handleWorkbench(ctx: RouteContext): Promise<Response> {
  const { segments, request } = ctx;
  const method = request.method;
  switch (segments[2]) {
    case 'tickets':
      if (segments.length !== 3) return notFound();
      return only(method, 'POST', () => mintWorkbenchTicket(ctx));
    case 'sessions':
      if (segments.length === 3) return only(method, 'POST', () => redeemWorkbenchTicket(ctx));
      if (segments.length === 4 && segments[3] === 'current')
        return only(method, 'DELETE', () => endCurrentWorkbenchSession(ctx));
      return notFound();
    case 'pairing-requests':
      return pairingRequestRoute(ctx, method);
    case 'pairings':
      if (segments.length === 3) return only(method, 'GET', () => listPairings(ctx));
      if (segments.length === 4) return only(method, 'DELETE', () => unpair(ctx, segments[3]!));
      return notFound();
    default:
      return notFound();
  }
}
