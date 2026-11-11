// /api/account/workbench/* (liveworkspace/docs/specs/011-workbench/workbench.md "Addresses"): every app's workbench pairing, tickets
// and sessions. Each app's address keeps `/api/workbench/*` and forwards it here with its name, so the requests and
// answers are the app's own (apps.ts holds its words).
//
//   POST   tickets                          an API token: a ticket, or 428 pairing_required with the pairing URL
//   POST   sessions                         the ticket is the credential: a session
//   DELETE sessions/current                 a session ends itself
//   POST   pairing-requests                 an API token asks to pair (or is paired already)
//   GET    pairing-requests/:code/status    the token that asked waits
//   GET    pairing-requests/:code           the token's owner, signed in: the pairing page's question
//   POST   pairing-requests/:code/approve   …and its answer, once
//   POST   pairing-requests/:code/decline
//   GET    pairings                         the owner, signed in: Settings > API tokens
//   DELETE pairings/:id                     …and Unpair
//
// "Signed in" is liveworkspace.app's session cookie (same-origin writes only) or an account's access token for one of
// the apps. A token, a session or a guest never answers a pairing or unpairs.
import { WORKBENCH_CODE_PATTERN } from './store.ts';
import { type WorkbenchContext, fail, notFound } from './route-kit.ts';
import { endCurrentSession, mintTicket, redeemTicket } from './ticket-routes.ts';
import {
  answerPairing,
  listPairings,
  openPairing,
  pollPairing,
  readPairing,
  unpair,
} from './pairing-routes.ts';

export {
  WORKBENCH_NAME_MAX_LENGTH,
  WORKBENCH_ORIGIN_MAX_LENGTH,
  WORKBENCH_POLL_INTERVAL_S,
  WORKBENCH_SESSION_TTL_MS,
  WORKBENCH_TICKETS_PER_MINUTE,
  WORKBENCH_TICKET_TTL_MS,
  capLevel,
  normaliseWorkbenchName,
  parseWorkbenchOrigin,
} from './route-kit.ts';
export type { WorkbenchContext } from './route-kit.ts';

// ---------- Routing ---------------------------------------------------------------------------------------------

export async function handleWorkbench(ctx: WorkbenchContext, parts: string[]): Promise<Response> {
  if (!ctx.env.WORKBENCH) return fail(503, 'workbench_unavailable');
  const method = ctx.request.method;
  const [section, code, action] = parts;
  const wrong = () => fail(405, 'method_not_allowed');

  if (section === 'tickets' && parts.length === 1)
    return method === 'POST' ? mintTicket(ctx) : wrong();
  if (section === 'sessions' && parts.length === 1)
    return method === 'POST' ? redeemTicket(ctx) : wrong();
  if (section === 'sessions' && code === 'current' && parts.length === 2)
    return method === 'DELETE' ? endCurrentSession(ctx) : wrong();

  if (section === 'pairing-requests') {
    if (parts.length === 1) return method === 'POST' ? openPairing(ctx) : wrong();
    if (!code || !WORKBENCH_CODE_PATTERN.test(code)) return notFound();
    if (parts.length === 2) return method === 'GET' ? readPairing(ctx, code) : wrong();
    if (parts.length === 3 && action === 'status')
      return method === 'GET' ? pollPairing(ctx, code) : wrong();
    if (parts.length === 3 && (action === 'approve' || action === 'decline'))
      return method === 'POST' ? answerPairing(ctx, code, action) : wrong();
  }

  if (section === 'pairings' && parts.length === 1)
    return method === 'GET' ? listPairings(ctx) : wrong();
  if (section === 'pairings' && code && parts.length === 2)
    return method === 'DELETE' ? unpair(ctx, code) : wrong();
  return notFound();
}
