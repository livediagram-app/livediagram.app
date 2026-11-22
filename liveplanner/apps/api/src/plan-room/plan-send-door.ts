// Send to Plan at this plan (docs/specs/026-plan/items.md "Sent From"; liveworkspace send-to-plan.md "The card"):
// cards made from words in another app, as the person who sent them, on the chosen board's column (its first when the
// column named is not there), of the first card type the board takes, assigned to the plan person of that name where
// there is one, due on the day written, with the checklist given and the Sent From the index filled in. The internal
// door has checked the person's Editor grant on the whole plan. The cards land as a person's own adds do: relayed to
// the open editors and written to the history, so the plan's own rules hear them.
import {
  ITEMS_MAX,
  itemPlacer,
  makeItem,
  newItemId,
  planOutline,
  SENT_FROM_FIELD,
  sentFromValue,
  typesOf,
  withDefaultStatuses,
  type ItemFields,
} from '@liveplanner/items';
import type { PlanSendDoorAnswer, PlanSendDoorCall } from '@liveworkspace/index-client';
import { appendItemHistory } from '../db/item-history';
import { getItemStoreHead, insertItems, listItems } from '../db/items';
import { planTabs } from '../routes/plan-route';
import { authorPerson } from './automations/cross-app-door';
import { readAutomationPlan } from './automations/automation-plan';
import { automationDeps } from './automations/plan-room-automations';
import { readPlanOutline } from './plan-content';
import type { PlanRoom } from './plan-room';
import { bindStoredPlan } from './plan-room-content';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function planSendHere(
  room: PlanRoom,
  planId: string,
  call: PlanSendDoorCall,
): Promise<PlanSendDoorAnswer> {
  // An id nothing has written takes none.
  if (!bindStoredPlan(room, planId)) return { ok: false, code: 'target_gone', reason: '' };
  const deps = automationDeps(room);
  if (!deps) return { ok: false, code: 'failed', reason: '' };
  const { env } = deps;
  const [head, tabs, plan] = await Promise.all([
    readPlanOutline(env, planId),
    planTabs({ env }, planId, null),
    readAutomationPlan(env, planId),
  ]);
  const board = planOutline(tabs, head.itemTypes).boards.find((b) => b.elementId === call.board);
  if (!board) return { ok: false, code: 'target_gone', reason: 'The board is gone' };
  const column = board.columns.find((c) => sameName(c.name, call.column)) ?? board.columns[0];
  const types = typesOf(head.itemTypes);
  const type = board.types?.[0] ?? types[0]?.id;
  if (!type) return { ok: false, code: 'invalid', reason: 'The board takes no card type' };
  const items = await listItems(env, planId);
  const storeHead = await getItemStoreHead(env, planId);
  if (storeHead.count + call.cards.length > ITEMS_MAX)
    return { ok: false, code: 'full', reason: 'The plan holds as many cards as it may' };
  const creates = withDefaultStatuses(
    call.cards.map((card) => {
      const fields: ItemFields = { title: card.title };
      if (card.description) fields['description'] = card.description;
      const named = card.assignee
        ? plan.outline.people.find((p) => sameName(p.name, card.assignee!))
        : undefined;
      if (named) fields['assignee'] = named;
      if (card.due) fields['due'] = card.due;
      if (card.checklist?.length)
        fields['checklist'] = card.checklist.map((text) => ({ text, done: false }));
      const sentFrom = sentFromValue(card.sentFrom);
      if (sentFrom) fields[SENT_FROM_FIELD] = sentFrom;
      return { type, fields, ...(column ? { place: { status: column.status } } : {}) };
    }),
    types,
  );
  const by = await authorPerson(env, call.person);
  const keys = new Set(items.map((i) => i.key));
  let key = storeHead.nextKey;
  const place = itemPlacer(items);
  const now = Date.now();
  const made = creates.map((create) => {
    while (keys.has(key)) key += 1;
    keys.add(key);
    const item = makeItem(create, { id: newItemId(), key, now, by, items: place });
    place.add(item);
    return item;
  });
  const rev = await insertItems(env, planId, made);
  deps.relay(made, rev);
  await appendItemHistory(
    env,
    planId,
    made.map((after) => ({ before: null, after })),
  );
  console.info('[plan] send to plan', { cards: made.length });
  return {
    ok: true,
    cards: made.map((m) => ({
      id: m.id,
      title: typeof m.fields['title'] === 'string' ? m.fields['title'] : '',
      column: column?.name ?? '',
      done: plan.isDone(typeof m.fields['status'] === 'string' ? m.fields['status'] : undefined),
    })),
  };
}
