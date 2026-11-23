// Send to Plan at liveplanner's side (liveworkspace/docs/specs/004-index/send-to-plan.md "The card"; blueprint "The
// door"): the index calls, with the app's key and the person's grant (X-Index-Grant),
//
//   POST /api/internal/items/:id/plan-send   PlanSendDoorCall  → 200 PlanSendDoorAnswer
//
// The door checks the grant itself before anything is made: for this item, of the person the call names, an Editor's
// on the whole item, not one in the Trash (automation-step-door.ts grantWrites). Anything less is a 403, which the
// index answers as no access. A throw is a failure, never a 500.

import {
  ITEM_GRANT_HEADER,
  readPlanSendDoorCall,
  type GrantClaims,
  type PlanSendDoorAnswer,
  type PlanSendDoorCall,
} from '@liveworkspace/index-client';
import { grantWrites, type AutomationDoorGrants } from './automation-step-door';
import { badRequest, bodyOf, json } from './internal-doors';

export type PlanSendHandler = (
  itemId: string,
  call: PlanSendDoorCall,
  claims: GrantClaims,
) => Promise<PlanSendDoorAnswer>;

export async function planSendDoor(
  request: Request,
  itemId: string,
  grants: AutomationDoorGrants,
  run: PlanSendHandler,
): Promise<Response> {
  const call = readPlanSendDoorCall(await bodyOf(request));
  if (!call) return badRequest('invalid plan send');
  const claims = await grants(request.headers.get(ITEM_GRANT_HEADER), itemId);
  if (!grantWrites(claims, call.person, itemId)) return json({ error: 'grant_refused' }, 403);
  try {
    return json(await run(itemId, call, claims));
  } catch (err) {
    console.warn('[internal] plan send failed', { error: String(err) });
    return json({ ok: false, code: 'failed', reason: '' } satisfies PlanSendDoorAnswer);
  }
}
