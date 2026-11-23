// An agent's card with a source (docs/specs/026-plan/plan-agents.md "Cards from another app"; liveworkspace
// send-to-plan.md "Agents"): a create naming `sentFrom` (the app, the item, its tab and element, the words) is an
// Editor's on the whole plan. The index fills the Sent From in (the item's title and the link to the exact place) and
// records the send for the source's chip, only where the agent's person can read the source; where they cannot, the
// card is made without one. The source is never changed.
import {
  newItemId,
  planOutline,
  SENT_FROM_FIELD,
  sentFromValue,
  type ItemCreate,
} from '@liveplanner/items';
import { readAgentSentFrom, type AgentSentFrom } from '@liveworkspace/index-client';
import { indexAppClient } from '../index-service';
import { forbidden } from '../responses';
import type { PlanRouteContext } from './context';
import { isItemEditor, rejected, type ItemCaller } from './item-route-kit';
import { planTabs } from './plan-route';

const sentFromOf = (raw: unknown): unknown =>
  raw && typeof raw === 'object' ? (raw as { sentFrom?: unknown }).sentFrom : undefined;

/** Fills each create's Sent From where its raw body names one; a refusal, or null when all is well. */
export async function withAgentSentFrom(
  ctx: PlanRouteContext,
  caller: ItemCaller,
  raws: readonly unknown[],
  creates: ItemCreate[],
): Promise<Response | null> {
  const asked: { at: number; from: AgentSentFrom }[] = [];
  for (let at = 0; at < raws.length; at += 1) {
    const raw = sentFromOf(raws[at]);
    if (raw === undefined) continue;
    const from = readAgentSentFrom(raw);
    if (!from) return rejected('field_value_invalid', 'sentFrom');
    asked.push({ at, from });
  }
  if (asked.length === 0) return null;
  if (caller.scope || !(await isItemEditor(ctx, caller))) return forbidden();
  const client = indexAppClient(ctx.env);
  if (!client) return null;
  const { boards } = planOutline(
    await planTabs(ctx, caller.projectId, null),
    caller.doc?.itemTypes,
  );
  const names = new Map<string, string>();
  for (const b of boards)
    for (const c of b.columns) if (!names.has(c.status)) names.set(c.status, c.name);
  const cards = asked.map(({ at, from }) => {
    const create = creates[at]!;
    create.id ??= newItemId();
    const status = create.place?.status;
    const title = typeof create.fields['title'] === 'string' ? create.fields['title'] : '';
    return {
      id: create.id,
      title: title.slice(0, 200),
      column: (status ? (names.get(status) ?? '') : '').slice(0, 120),
      done: false,
      sentFrom: from,
    };
  });
  try {
    const { sentFrom } = await client.recordPlanSends(caller.projectId, caller.owner, cards);
    asked.forEach(({ at }, i) => {
      const value = sentFromValue(sentFrom[i]);
      if (value) creates[at]!.fields = { ...creates[at]!.fields, [SENT_FROM_FIELD]: value };
    });
  } catch (err) {
    // The card is still made, without a Sent From: the index is a convenience here, never a gate.
    console.warn('[items] sent from not recorded', { error: String(err) });
  }
  return null;
}
