// Diagrams and Plans at the apps' side (liveworkspace/docs/specs/004-index/diagrams-and-plans.md "The doors"): the index
// calls, with the app's key,
//
//   POST /api/internal/items/:id/plan-diagram   liveplanner: PlanDiagramDoorCall, the person's grant in X-Index-Grant
//   POST /api/internal/items/plan-diagram       livediagram: PlanDiagramDraw, a new diagram or a tab redrawn
//
// liveplanner's door checks the grant itself before anything is read or written: for this item, of the person the
// call names, out of the Trash, and an Editor's on the whole item for a make or an edit. Anything less is a 403. A
// throw is a failure, never a 500.

import {
  ITEM_GRANT_HEADER,
  readPlanDiagramDoorCall,
  readPlanDiagramDraw,
  readSentFrom,
  type GrantClaims,
  type PlanDiagramDoorCall,
  type PlanDiagramDraw,
} from '@liveworkspace/index-client';
import { grantWrites, type AutomationDoorGrants } from './automation-step-door';
import { USER_ID, badRequest, bodyOf, json } from './internal-doors';

export type PlanDiagramHandler = (
  itemId: string,
  call: PlanDiagramDoorCall,
  claims: GrantClaims,
) => Promise<Record<string, unknown>>;

export type PlanDiagramDrawResult =
  | { status: 'ok'; id: string; tabId: string }
  | { status: 'not_found' }
  | { status: 'invalid_graph' }
  | { status: 'too_large' };

export type PlanDiagramDrawHandler = (draw: PlanDiagramDraw) => Promise<PlanDiagramDrawResult>;

/** Whether the grant lets its person read the item: theirs, any level, out of the Trash. */
export const grantReads = (
  claims: GrantClaims | null,
  person: string,
  itemId: string,
): claims is GrantClaims =>
  !!claims && claims.sub === person && claims.item === itemId && !claims.trashed;

export async function planDiagramDoor(
  request: Request,
  itemId: string,
  grants: AutomationDoorGrants,
  run: PlanDiagramHandler,
): Promise<Response> {
  const call = readPlanDiagramDoorCall(await bodyOf(request), readSentFrom);
  if (!call) return badRequest('invalid plan diagram call');
  const claims = await grants(request.headers.get(ITEM_GRANT_HEADER), itemId);
  const writes = call.op === 'make' || call.op === 'edit';
  const allowed = writes
    ? grantWrites(claims, call.person, itemId)
    : grantReads(claims, call.person, itemId);
  if (!allowed || !claims) return json({ error: 'grant_refused' }, 403);
  try {
    return json(await run(itemId, call, claims));
  } catch (err) {
    console.warn('[internal] plan diagram failed', { op: call.op, error: String(err) });
    return json({ ok: false, code: 'failed', reason: '' });
  }
}

export async function planDiagramDrawDoor(
  request: Request,
  run: PlanDiagramDrawHandler,
): Promise<Response> {
  const draw = readPlanDiagramDraw(await bodyOf(request));
  if (!draw) return badRequest('body must be {owner, name, graph, caption, link}');
  if (!USER_ID.test(draw.owner)) return badRequest('owner must be an account id');
  let result: PlanDiagramDrawResult;
  try {
    result = await run(draw);
  } catch (err) {
    console.error('[internal] plan diagram draw failed', { error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
  if (result.status !== 'ok') {
    console.warn('[internal] plan diagram draw refused', { status: result.status });
    const status = result.status === 'not_found' ? 404 : result.status === 'too_large' ? 413 : 422;
    return json({ error: result.status }, status);
  }
  console.info('[internal] plan diagram drawn', {
    into: draw.itemId ? 'redraw' : 'new',
    cards: draw.graph.nodes.length,
    links: draw.graph.edges.length,
  });
  return json({ id: result.id, tabId: result.tabId }, draw.itemId ? 200 : 201);
}
