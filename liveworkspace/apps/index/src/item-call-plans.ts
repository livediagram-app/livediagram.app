// Send to Plan from a call's Space (liveworkspace/docs/specs/004-index/item-calls.md "After the call"): each card
// carries a line back to the item the call was about, and the meeting keeps the plan its actions went to.

import { ITEM_CALL_APP } from '@liveworkspace/index-client';
import type { Env } from './env';
import { itemLink, tellItemCalls } from './item-call-reads';
import { getItemRow, type ItemRow } from './rows';

export type CallLine = { callId: string; item: ItemRow; spaceId: string; line: string };

/** The line back to the item for a send from `source`, when it is a call's Space whose item is still there. */
export async function callLineOf(
  env: Env,
  source: Pick<ItemRow, 'id' | 'app'>,
): Promise<CallLine | null> {
  if (source.app !== ITEM_CALL_APP) return null;
  const call = await env.INDEX_DB.prepare('SELECT id, item_id FROM item_calls WHERE space_id = ?')
    .bind(source.id)
    .first<{ id: string; item_id: string }>();
  if (!call) return null;
  const item = await getItemRow(env, call.item_id);
  if (!item || item.trashed_at !== null) return null;
  return {
    callId: call.id,
    item,
    spaceId: source.id,
    line: `Discussed on a call about ${item.title || 'Untitled'} (${item.app}): ${itemLink(env, item)}`,
  };
}

/** The meeting keeps the plan its actions last went to, and the item's open editors hear of it. */
export async function keepCallPlan(env: Env, call: CallLine, planId: string): Promise<void> {
  await env.INDEX_DB.prepare('UPDATE item_calls SET plan_id = ?, updated_at = ? WHERE id = ?')
    .bind(planId, Date.now(), call.callId)
    .run();
  await tellItemCalls(env, call.item, call.spaceId);
}
