// /api/workbench/* (docs/specs/013-workspace/blueprints/workbench-embeds.md "Routes"): tickets, sessions,
// pairing requests and pairings, each in its own module.

import { methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from './context';
import { endCurrentWorkbenchSession, redeemWorkbenchTicket } from './workbench-session-routes';
import { mintWorkbenchTicket } from './workbench-ticket-route';

export async function handleWorkbench(ctx: RouteContext): Promise<Response> {
  const { segments, request } = ctx;
  const method = request.method;
  switch (segments[2]) {
    case 'tickets':
      if (segments.length !== 3) return notFound();
      return method === 'POST' ? mintWorkbenchTicket(ctx) : methodNotAllowed();
    case 'sessions':
      if (segments.length === 3) return method === 'POST' ? redeemWorkbenchTicket(ctx) : methodNotAllowed();
      if (segments.length === 4 && segments[3] === 'current')
        return method === 'DELETE' ? endCurrentWorkbenchSession(ctx) : methodNotAllowed();
      return notFound();
    default:
      return notFound();
  }
}
