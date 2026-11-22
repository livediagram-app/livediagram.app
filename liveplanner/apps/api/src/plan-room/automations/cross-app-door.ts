// A rule's step from another app on this plan (docs/specs/026-plan/automations.md "Steps in other apps"; liveworkspace
// blueprint cross-app.md "The door"): Create a Card in a Plan, as the rule's author, on the chosen board's column (its
// first when the column named is not there), of the first card type the board takes, assigned to the plan person of
// that name where there is one, due that many days on, its description ending with a link back to where the rule
// lives. Skip if Open: an open card whose description already links back is answered, not added to. The card lands
// as a Create Card's does (automation-writes.ts createCard), its events carrying the step's chain so a rule here that
// hears it never loops back. The internal door has checked the author's grant. The pickers' read is the boards.
import {
  ITEMS_MAX,
  isTrashed,
  itemTitle,
  itemPersonId,
  itemPlacer,
  makeItem,
  newItemId,
  planOutline,
  typesOf,
  withDefaultStatuses,
  type Item,
  type ItemFields,
  type ItemPerson,
} from '@liveplanner/items';
import type {
  AutomationStepAnswer,
  AutomationStepDoorCall,
  AutomationTargetDescription,
  PlanCardStep,
} from '@liveworkspace/index-client';
import { readTargetStep } from '@liveworkspace/automations/room';
import { appendItemHistory } from '../../db/item-history';
import { getItemStoreHead, insertItems, listItems } from '../../db/items';
import { getParticipants } from '../../person/profiles';
import { planTabs } from '../../routes/plan-route';
import { readPlanOutline } from '../plan-content';
import type { PlanRoom } from '../plan-room';
import { bindStoredPlan } from '../plan-room-content';
import { cardUrl, readAutomationPlan } from './automation-plan';
import { automationDeps } from './plan-room-automations';

const DAY_MS = 86_400_000;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The description a card gets: the rule's, then the way back to where the rule lives. */
export function cardDescription(step: PlanCardStep, from: { title: string; url: string }): string {
  const back = step.linkBack && from.url ? `From ${from.title || 'Untitled'}: ${from.url}` : '';
  return [step.description.trim(), back].filter(Boolean).join('\n\n');
}

/** An open card (not in the Trash, not in a done column) that already links back. */
export function openLinkingCard(
  items: readonly Item[],
  url: string,
  isDone: (status: string | undefined) => boolean,
): Item | undefined {
  if (!url) return undefined;
  return items.find((i) => {
    const d = i.fields['description'];
    const status = i.fields['status'];
    return (
      !isTrashed(i) &&
      !isDone(typeof status === 'string' ? status : undefined) &&
      typeof d === 'string' &&
      d.includes(url)
    );
  });
}

async function authorPerson(
  env: Parameters<typeof getParticipants>[0],
  author: string,
): Promise<ItemPerson> {
  const people = await getParticipants(env, [author]).catch(() => null);
  const p = people?.get(author);
  return {
    id: await itemPersonId(author),
    name: p?.name || 'Someone',
    color: p?.color || '#94a3b8',
  };
}

async function createCardHere(
  room: PlanRoom,
  call: AutomationStepDoorCall,
  step: PlanCardStep,
): Promise<AutomationStepAnswer> {
  const deps = automationDeps(room);
  if (!deps) return { ok: false, code: 'no_access', reason: '' };
  const { env, planId } = deps;
  const [head, tabs, plan] = await Promise.all([
    readPlanOutline(env, planId),
    planTabs({ env }, planId, null),
    readAutomationPlan(env, planId),
  ]);
  const board = planOutline(tabs, head.itemTypes).boards.find((b) => b.elementId === step.board);
  if (!board) return { ok: false, code: 'target_gone', reason: 'The board is gone' };
  const column = board.columns.find((c) => sameName(c.name, step.column)) ?? board.columns[0];
  const types = typesOf(head.itemTypes);
  const type = board.types?.[0] ?? types[0]?.id;
  if (!type) return { ok: false, code: 'failed', reason: 'The board takes no card type' };
  const items = await listItems(env, planId);
  const description = cardDescription(step, call.from);
  if (step.skipIfOpen) {
    const open = openLinkingCard(items, call.from.url, plan.isDone);
    if (open)
      return {
        ok: true,
        text: `Skipped: an open card already links back (“${itemTitle(open)}”)`,
        link: cardUrl(env, planId, open.id),
      };
  }
  const fields: ItemFields = { title: step.title, ...(description ? { description } : {}) };
  const named = step.assignee
    ? plan.outline.people.find((p) => sameName(p.name, step.assignee!))
    : undefined;
  if (named) fields['assignee'] = named;
  if (step.dueDays !== undefined)
    fields['due'] = new Date(Date.now() + step.dueDays * DAY_MS).toISOString().slice(0, 10);
  const [create] = withDefaultStatuses(
    [{ type, fields, ...(column ? { place: { status: column.status } } : {}) }],
    types,
  );
  const storeHead = await getItemStoreHead(env, planId);
  if (storeHead.count >= ITEMS_MAX)
    return { ok: false, code: 'failed', reason: 'The plan holds as many cards as it may' };
  const keys = new Set(items.map((i) => i.key));
  let key = storeHead.nextKey;
  while (keys.has(key)) key += 1;
  const made = makeItem(create!, {
    id: newItemId(),
    key,
    now: Date.now(),
    by: await authorPerson(env, call.author),
    items: itemPlacer(items),
  });
  const rev = await insertItems(env, planId, [made]);
  deps.relay([made], rev);
  // The card is the author's, made by their rule elsewhere: its events carry the chain.
  await appendItemHistory(env, planId, [{ before: null, after: made }], 'automation', {
    role: 'automation',
    cross: call.chain,
  });
  const assigned = step.assignee && !named ? ` (nobody here is named ${step.assignee})` : '';
  return {
    ok: true,
    text: `Created “${step.title}” in ${board.title.trim() || 'Board'}${assigned}`,
    link: cardUrl(env, planId, made.id),
  };
}

export async function planAutomationStep(
  room: PlanRoom,
  planId: string,
  call: AutomationStepDoorCall,
): Promise<AutomationStepAnswer> {
  // An id nothing has written takes none.
  if (!bindStoredPlan(room, planId)) return { ok: false, code: 'no_access', reason: '' };
  const step = readTargetStep(call.step);
  if (typeof step === 'string') return { ok: false, code: 'invalid', reason: step };
  if (step.kind !== 'plan_card')
    return { ok: false, code: 'invalid', reason: "This app doesn't take that step" };
  const answer = await createCardHere(room, call, step);
  console.info('[automations] step from another app', { kind: step.kind, ok: answer.ok });
  return answer;
}

export async function planAutomationTarget(
  room: PlanRoom,
  planId: string,
): Promise<Pick<AutomationTargetDescription, 'boards'>> {
  if (!bindStoredPlan(room, planId)) return { boards: [] };
  const deps = automationDeps(room);
  if (!deps) return { boards: [] };
  const [head, tabs] = await Promise.all([
    readPlanOutline(deps.env, deps.planId),
    planTabs({ env: deps.env }, deps.planId, null),
  ]);
  return {
    boards: planOutline(tabs, head.itemTypes).boards.map((b) => ({
      id: b.elementId,
      name: b.title.trim() || 'Board',
      columns: b.columns.map((c) => c.name),
    })),
  };
}

// The room's doors' shapes, so each of its methods stays a line or two (plan-room.ts stays under 800 lines).
export type StepCall = AutomationStepDoorCall;
export type StepAnswer = AutomationStepAnswer;
export type TargetHere = Omit<AutomationTargetDescription, 'app' | 'title'>;
