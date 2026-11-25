// Diagrams and Plans at this plan (liveworkspace/docs/specs/004-index/diagrams-and-plans.md "The doors";
// docs/specs/026-plan/view-as-diagram.md): the index's one call, four ops, the person's grant already checked by the
// internal door (index-app plan-diagram-door.ts: an Editor's on the whole plan for a make or an edit, any read for a
// graph or a watch).
//
//   make   a diagram's shapes made cards (one insert), earlier ones updated (title, Start, Due, labels, Blocked By),
//          the cards it asked for moved to the Trash; written as the person, relayed and in the history as theirs
//   graph  a board drawn as a graph (plan-diagram-graph.ts), its filter read for the person when asked
//   watch  a live diagram remembered (plan-views.ts)
//   edit   a drawn diagram's changes: a Blocked By link, a move to a column, each checked as the card panel checks it
import {
  applyPatch,
  blockerIdsOf,
  blockingCycleOf,
  blockingLoopMessage,
  blocksFieldsOf,
  boardSetupsOfTab,
  FIELD_VALUES_MAX,
  finishedStatuses,
  holdsSeveral,
  ITEMS_MAX,
  itemPlacer,
  isArchived,
  isTrashed,
  itemStatus,
  makeItem,
  newItemId,
  planDiagramGraph,
  planMake,
  resolveBoardFilter,
  SENT_FROM_FIELD,
  sentFromValue,
  TRASH_STATUS,
  TRASHED_FROM_FIELD,
  typeIn,
  typesOf,
  withDefaultStatuses,
  type Item,
  type ItemTypeCatalogue,
  type PlanBoardSetup,
  type PlanGraph,
} from '@liveplanner/items';
import type {
  PlanDiagramDoorCall,
  PlanEdit,
  PlanEditResult,
  PlanGraphDoorAnswer,
  PlanMakeDoorAnswer,
} from '@liveworkspace/index-client';
import { appendItemHistory } from '../db/item-history';
import { getItemStoreHead, insertItems, listItems, updateItemsAtRev } from '../db/items';
import { planTabs } from '../routes/plan-route';
import type { PlanEnv } from '../types';
import { authorPerson, NO_NEW_CARDS } from './automations/cross-app-door';
import { cardUrl } from './automations/automation-plan';
import { automationDeps } from './automations/plan-room-automations';
import { readPlanOutline, setPlanItemTypes } from './plan-content';
import type { PlanRoom } from './plan-room';
import { bindStoredPlan } from './plan-room-content';

type MakeCall = Extract<PlanDiagramDoorCall, { op: 'make' }>;
type GraphCall = Extract<PlanDiagramDoorCall, { op: 'graph' }>;
type EditCall = Extract<PlanDiagramDoorCall, { op: 'edit' }>;

// The days a Due Soon filter looks ahead (the board's own default).
const SOON_DAYS = 7;
const DAY_MS = 86_400_000;

/** A board's set-up, and what reading it needed. */
export async function readBoard(env: PlanEnv, planId: string, boardId: string) {
  const [head, tabs] = await Promise.all([
    readPlanOutline(env, planId),
    planTabs({ env }, planId, null),
  ]);
  for (const tab of tabs)
    for (const b of boardSetupsOfTab(tab.elements))
      if (b.elementId === boardId) return { setup: b.setup, head, title: head.meta?.name ?? '' };
  return null;
}

/** The board drawn for `person`: every card, or the ones its own filter shows them today. */
export function boardGraph(
  env: PlanEnv,
  planId: string,
  board: { setup: PlanBoardSetup; types: ReturnType<typeof typesOf> },
  items: readonly Item[],
  person: string,
  filtered: boolean,
  now = Date.now(),
): PlanGraph {
  const finished = finishedStatuses(board.setup);
  const quick =
    filtered && board.setup.filter
      ? resolveBoardFilter(board.setup.filter, {
          mine: person,
          today: Math.floor(now / DAY_MS),
          soonDays: SOON_DAYS,
          finished,
        })
      : undefined;
  return planDiagramGraph({
    setup: board.setup,
    items: new Map(items.map((i) => [i.id, i])),
    types: board.types,
    ...(quick ? { quick } : {}),
    link: (card) => cardUrl(env, planId, card),
  });
}

async function graphHere(
  room: PlanRoom,
  planId: string,
  call: GraphCall,
): Promise<PlanGraphDoorAnswer> {
  if (!bindStoredPlan(room, planId)) return { ok: false, code: 'target_gone', reason: '' };
  const env = room.requireEnv();
  const [board, items] = await Promise.all([
    readBoard(env, planId, call.board),
    listItems(env, planId),
  ]);
  if (!board) return { ok: false, code: 'target_gone', reason: 'The board is gone' };
  const graph = boardGraph(
    env,
    planId,
    { setup: board.setup, types: typesOf(board.head.itemTypes) },
    items,
    call.person,
    call.filtered,
  );
  room.planViews.noteDrawn(call, graph);
  console.info('[plan] diagram graph', { cards: graph.nodes.length, links: graph.edges.length });
  return { ok: true, graph, title: board.title };
}

// The catalogue with one type replaced, written at the revision it was read at; null when someone saved first.
async function growType(
  room: PlanRoom,
  env: PlanEnv,
  planId: string,
  catalogue: ItemTypeCatalogue,
  rev: number,
  type: ReturnType<typeof typesOf>[number],
): Promise<boolean> {
  const next: ItemTypeCatalogue = {
    ...catalogue,
    types: catalogue.types.map((t) => (t.id === type.id ? type : t)),
  };
  const itemTypesRev = await setPlanItemTypes(env, planId, next, rev);
  if (itemTypesRev === null) return false;
  room.broadcastOrderedSystemOp({ kind: 'item-types', itemTypes: next, itemTypesRev });
  return true;
}

async function makeHere(
  room: PlanRoom,
  planId: string,
  call: MakeCall,
): Promise<PlanMakeDoorAnswer> {
  if (!bindStoredPlan(room, planId)) return { ok: false, code: 'target_gone', reason: '' };
  const deps = automationDeps(room);
  if (!deps) return { ok: false, code: 'failed', reason: '' };
  const { env } = deps;
  const [board, items, storeHead] = await Promise.all([
    readBoard(env, planId, call.board),
    listItems(env, planId),
    getItemStoreHead(env, planId),
  ]);
  if (!board) return { ok: false, code: 'target_gone', reason: 'The board is gone' };
  if (board.setup.allCards || board.setup.archive)
    return { ok: false, code: 'invalid', reason: NO_NEW_CARDS };
  const catalogue = board.head.itemTypes;
  const types = typesOf(catalogue);
  const type = board.setup.addTypes?.[0] ?? types[0]?.id;
  if (!type) return { ok: false, code: 'invalid', reason: 'The board takes no card type' };
  const byId = new Map(items.map((i) => [i.id, i]));
  // An update names a live card; one gone since the index read its sends is made again.
  const live = (id: string | undefined) => {
    const it = id ? byId.get(id) : undefined;
    return !!it && !isTrashed(it) && !isArchived(it);
  };
  const fresh = call.cards.filter((c) => !live(c.cardId)).length;
  if (storeHead.count + fresh > ITEMS_MAX)
    return { ok: false, code: 'full', reason: 'The plan holds as many cards as it may' };

  const plan = planMake({
    items: byId,
    types,
    columns: board.setup.columns.map((c) => ({ status: c.status, name: c.name })),
    column: call.column,
    type,
    cards: call.cards.map((c) => {
      const made = !live(c.cardId);
      const sentFrom = sentFromValue(c.sentFrom);
      return {
        element: c.element,
        id: made ? newItemId() : c.cardId!,
        made,
        title: c.title,
        description: c.description,
        ...(c.column ? { column: c.column } : {}),
        ...(c.labels ? { labels: c.labels } : {}),
        ...(c.start ? { start: c.start } : {}),
        ...(c.due ? { due: c.due } : {}),
        ...(c.blockedBy ? { blockedBy: c.blockedBy } : {}),
        ...(made && sentFrom ? { extra: { [SENT_FROM_FIELD]: sentFrom } } : {}),
      };
    }),
  });
  // The board type gains its Blocked By field before any card holds a value for it.
  if (plan.type && catalogue) {
    const grown = await growType(room, env, planId, catalogue, board.head.itemTypesRev, plan.type);
    if (!grown) return { ok: false, code: 'failed', reason: 'The card types changed. Try again.' };
  }
  const by = await authorPerson(env, call.person);
  const now = Date.now();
  const allTypes = plan.type ? types.map((t) => (t.id === plan.type!.id ? plan.type! : t)) : types;

  // New cards, one insert.
  const creates = withDefaultStatuses(
    plan.cards
      .filter((c) => c.made)
      .map((c) => ({
        type,
        fields: c.fields,
        ...(c.status ? { place: { status: c.status } } : {}),
      })),
    allTypes,
  );
  const madeOut = plan.cards.filter((c) => c.made);
  const keys = new Set(items.map((i) => i.key));
  let key = storeHead.nextKey;
  const place = itemPlacer(items);
  const made = creates.map((create, i) => {
    while (keys.has(key)) key += 1;
    keys.add(key);
    const item = makeItem(create, { id: madeOut[i]!.id, key, now, by, items: place });
    place.add(item);
    return item;
  });
  let rev = made.length > 0 ? await insertItems(env, planId, made) : 0;

  // Updated and trashed cards, guarded at the revision read.
  const writes: { before: Item; next: Item }[] = [];
  for (const c of plan.cards) {
    if (c.made) continue;
    const before = byId.get(c.id)!;
    if (JSON.stringify(before.fields) === JSON.stringify(c.fields)) continue;
    writes.push({ before, next: applyPatch(before, { set: c.fields }, { now, by }) });
  }
  let trashed = 0;
  for (const id of call.trash) {
    const before = byId.get(id);
    if (!before || isTrashed(before)) continue;
    const status = itemStatus(before);
    writes.push({
      before,
      next: applyPatch(
        before,
        { set: { status: TRASH_STATUS, ...(status ? { [TRASHED_FROM_FIELD]: status } : {}) } },
        { now, by },
      ),
    });
    trashed += 1;
  }
  let landed = new Set<string>();
  if (writes.length > 0) {
    const result = await updateItemsAtRev(
      env,
      planId,
      writes.map((w) => ({ next: w.next, expectedRev: w.before.rev })),
    );
    rev = result.rev;
    landed = result.landed;
  }
  const changed = writes.filter((w) => landed.has(w.next.id));
  const relayed = [...made, ...changed.map((w) => w.next)];
  if (relayed.length > 0) deps.relay(relayed, rev);
  await appendItemHistory(env, planId, [
    ...made.map((after) => ({ before: null, after })),
    ...changed.map((w) => ({ before: w.before, after: w.next })),
  ]);
  console.info('[plan] make plan cards', {
    made: made.length,
    updated: changed.length - trashed,
    trashed,
    skipped: plan.skipped,
  });
  const columnName = new Map(board.setup.columns.map((c) => [c.status, c.name]));
  const doneStatus = new Set(finishedStatuses(board.setup));
  const finalOf = new Map<string, Item>([
    ...made.map((m) => [m.id, m] as const),
    ...changed.map((w) => [w.next.id, w.next] as const),
  ]);
  return {
    ok: true,
    cards: plan.cards.map((c) => {
      const it = finalOf.get(c.id) ?? byId.get(c.id);
      const status = it ? itemStatus(it) : undefined;
      return {
        element: c.element,
        id: c.id,
        title: typeof c.fields['title'] === 'string' ? c.fields['title'] : '',
        column: (status && columnName.get(status)) ?? '',
        done: !!status && doneStatus.has(status),
        made: c.made,
      };
    }),
    trashed,
    skipped: plan.skipped,
  };
}

const refuse = (reason: string): PlanEditResult => ({ status: 'refused', reason });

// One edit, checked as the card panel checks it, against the cards as the earlier edits left them.
function planEdit(
  edit: PlanEdit,
  byId: Map<string, Item>,
  types: ReturnType<typeof typesOf>,
  boards: readonly PlanBoardSetup[],
): { next: Item; before: Item } | PlanEditResult {
  const card = byId.get(edit.card);
  if (!card || isTrashed(card) || isArchived(card)) return refuse('That card is gone');
  if (edit.kind === 'move') {
    // Only a column of a board the card is on (view-as-diagram.md "Changes from the diagram"): a column of the same
    // name on another board would move it off the board it was drawn from, and an All Cards or Archive board's one
    // column names no status at all.
    const status = itemStatus(card);
    const wanted = edit.column.trim().toLowerCase();
    let column: PlanBoardSetup['columns'][number] | undefined;
    for (const b of boards) {
      if (b.allCards || b.archive || !b.columns.some((c) => c.status === status)) continue;
      column = b.columns.find((c) => c.name.trim().toLowerCase() === wanted);
      if (column) break;
    }
    if (!column) return refuse(`The board has no column called ${edit.column}`);
    if (itemStatus(card) === column.status) return { status: 'applied' };
    return { before: card, next: { ...card, fields: { ...card.fields, status: column.status } } };
  }
  const blocker = byId.get(edit.blocker);
  if (!blocker || isTrashed(blocker) || isArchived(blocker)) return refuse('That card is gone');
  const type = typeIn(types, card.type);
  const field = blocksFieldsOf(type)[0];
  if (!field) return refuse(`${type.label} cards have no Blocked By field`);
  const holds = blockerIdsOf(card, type);
  if (holds.includes(blocker.id)) return { status: 'applied' };
  // A Blocked By field stored holding one card (from before Holds Several) keeps that one (item-types.md "Blocked
  // By"): a second written beside it would read as nothing.
  if (holds.length >= (holdsSeveral(field) ? FIELD_VALUES_MAX : 1))
    return refuse('That card waits on as many cards as it may');
  const next = { ...card, fields: { ...card.fields, [field.id]: [...holds, blocker.id] } };
  const loop = blockingCycleOf(byId.values(), types, [{ before: card, next }]);
  if (loop) return refuse(blockingLoopMessage(loop.chain, types));
  return { before: card, next };
}

async function editHere(room: PlanRoom, planId: string, call: EditCall) {
  if (!bindStoredPlan(room, planId))
    return { results: call.edits.map(() => refuse('The plan is gone')) };
  const deps = automationDeps(room);
  if (!deps)
    return { results: call.edits.map(() => refuse('The plan could not be changed just now')) };
  const { env } = deps;
  const [head, tabs, items] = await Promise.all([
    readPlanOutline(env, planId),
    planTabs({ env }, planId, null),
    listItems(env, planId),
  ]);
  const types = typesOf(head.itemTypes);
  const boards = tabs.flatMap((t) => boardSetupsOfTab(t.elements).map((b) => b.setup));
  const byId = new Map(items.map((i) => [i.id, i]));
  const by = await authorPerson(env, call.person);
  const now = Date.now();
  const results: PlanEditResult[] = [];
  const writes = new Map<string, { before: Item; next: Item }>();
  for (const edit of call.edits) {
    const out = planEdit(edit, byId, types, boards);
    if ('status' in out) {
      results.push(out);
      continue;
    }
    const original = writes.get(out.before.id)?.before ?? out.before;
    byId.set(out.next.id, out.next);
    writes.set(out.next.id, { before: original, next: out.next });
    results.push({ status: 'applied' });
  }
  if (writes.size > 0) {
    const all = [...writes.values()].map((w) => ({
      before: w.before,
      next: applyPatch(w.before, { set: w.next.fields }, { now, by }),
    }));
    const result = await updateItemsAtRev(
      env,
      planId,
      all.map((w) => ({ next: w.next, expectedRev: w.before.rev })),
    );
    const landed = all.filter((w) => result.landed.has(w.next.id));
    if (landed.length > 0)
      deps.relay(
        landed.map((w) => w.next),
        result.rev,
      );
    await appendItemHistory(
      env,
      planId,
      landed.map((w) => ({ before: w.before, after: w.next })),
    );
    // A card someone changed since it was read: its edits are refused, to be offered again.
    call.edits.forEach((e, i) => {
      if (results[i]?.status === 'applied' && writes.has(e.card) && !result.landed.has(e.card))
        results[i] = refuse('Someone changed that card just now. Try again.');
    });
  }
  console.info('[plan] diagram edits', {
    applied: results.filter((r) => r.status === 'applied').length,
    refused: results.filter((r) => r.status === 'refused').length,
  });
  return { results };
}

export async function planDiagramHere(
  room: PlanRoom,
  planId: string,
  call: PlanDiagramDoorCall,
): Promise<Record<string, unknown>> {
  switch (call.op) {
    case 'make':
      return makeHere(room, planId, call);
    case 'graph':
      return graphHere(room, planId, call);
    case 'watch':
      if (!bindStoredPlan(room, planId)) return { ok: false };
      room.planViews.watch({
        diagramId: call.diagramId,
        tabId: call.tabId,
        board: call.board,
        filtered: call.filtered,
        person: call.person,
      });
      return { ok: true };
    case 'edit':
      return editHere(room, planId, call);
  }
}
