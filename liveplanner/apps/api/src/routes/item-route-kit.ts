// The item routes' shared parts (item-routes.ts, item-patches-route.ts, item-comment-routes.ts): who the caller is
// and what they reach, the refusals, the writer's signature and the room relay. A body is read by @liveplanner/items'
// write checks (write-checks.ts), which an offline project runs too.
import { isSafeColourValue, itemForRoom, itemForViewer } from '@liveplanner/project';
import {
  isArchived,
  isTrashed,
  itemIdsShownOnTab,
  tabShowsEveryCard,
  itemPersonId,
  calculatedWritten,
  requiredClearedBy,
  statusExcluded,
  typesOf,
  type Item,
  type ItemPerson,
  type ItemRejection,
} from '@liveplanner/items';
import { getProject, getTab, listItems } from '../db';
import { getParticipant } from '../person/profiles';
import { forbidden, json, notFound } from '../responses';
import { relayItems } from '../room-client';
import {
  deniedOnTab,
  gateEdit,
  gateGrant,
  gateParticipate,
  gateRead,
  missingProject,
  requireOwner,
  type PlanRouteContext,
} from './context';

type Level = 'read' | 'participate' | 'edit';

export type ItemCaller = {
  projectId: string;
  owner: string;
  // The project, for the gates a comment delete checks (item-comment-routes.ts); absent on a new project's
  // seed, which writes no comments.
  doc?: NonNullable<Awaited<ReturnType<typeof getProject>>>;
  // The item ids the caller may touch, when their grant is confined to one tab.
  scope: Set<string> | null;
  // Whether that tab shows every card (a board or plan view on it), so a card the caller makes stays in scope.
  scopeTakesNew?: boolean;
  // The store as read to work out that scope, so a list does not read it twice.
  items?: Item[];
  // Whether the caller holds edit, once a write has had to ask (isItemEditor).
  editor?: boolean;
};

const GATES = { read: gateRead, participate: gateParticipate, edit: gateEdit } as const;

export function rejected(error: ItemRejection, field?: string): Response {
  console.info('[items] items.rejected', { error, field });
  return json({ error, ...(field ? { field } : {}) }, { status: 400 });
}

export const itemNotFound = () => json({ error: 'item_not_found' }, { status: 404 });

// An item moved into a status its card type leaves out: statusExcluded against the project's types.
export function excludedStatus(
  caller: ItemCaller,
  next: Item,
  before: Item,
  undo: boolean,
): boolean {
  return statusExcluded(typesOf(caller.doc?.itemTypes), next, before, undo);
}
// A Calculated field given a value (docs/specs/026-plan/item-types.md "Calculated fields"): calculatedWritten
// against the project's types, its id or null. An undo never is: it puts back what was there.
export function calculatedSet(
  caller: ItemCaller,
  next: Pick<Item, 'type' | 'fields'>,
  before?: Item,
  undo = false,
): string | null {
  return undo ? null : calculatedWritten(typesOf(caller.doc?.itemTypes), next, before);
}

// A required custom field the change empties (docs/specs/026-plan/item-types.md "Required fields"): its id, or null.
export function clearedRequired(
  caller: ItemCaller,
  next: Item,
  before: Item,
  undo: boolean,
): string | null {
  return requiredClearedBy(typesOf(caller.doc?.itemTypes), next, before, undo);
}
// A Participant works with cards but never deletes one (docs/specs/013-workspace/share-roles.md "What a
// Participant changes"): moving a card into or out of the Trash or the Archive, and restoring one whole (its votes,
// thread and key, an Editor's undo), needs an Editor. Asked only when a write does that, so an ordinary card edit
// pays for no second gate.
export function retiresItem(before: Item, next: Item): boolean {
  return isTrashed(before) !== isTrashed(next) || isArchived(before) !== isArchived(next);
}

export async function isItemEditor(ctx: PlanRouteContext, caller: ItemCaller): Promise<boolean> {
  if (caller.editor !== undefined) return caller.editor;
  const doc = caller.doc;
  const tabId = ctx.url.searchParams.get('tabId') ?? undefined;
  caller.editor =
    !!doc &&
    ((await gateEdit(ctx, caller.projectId, doc.ownerId, doc.teamId)) ||
      (!!tabId && (await gateEdit(ctx, caller.projectId, doc.ownerId, doc.teamId, tabId))));
  if (!caller.editor) console.info('[items] items.retire.refused', { projectId: caller.projectId });
  return caller.editor;
}

// The pause before a write's next attempt after a racing write took its key or rev: short and jittered, growing with
// the attempt, so a burst of writes spreads out rather than colliding again on every round (docs/specs/026-plan/
// items.md "Changing items").
export const ITEM_RETRY_PAUSE_MS = 15;
export const itemRetryPause = (attempt: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ITEM_RETRY_PAUSE_MS * attempt * Math.random()));

export const itemBusy = () => {
  console.warn('[items] items.write.busy');
  return json(
    { error: 'item_busy', message: 'the item kept changing; try again' },
    { status: 409 },
  );
};

// The caller and their reach: the whole project, or (a tab-scoped grant) the items one tab shows.
export async function itemCaller(
  ctx: PlanRouteContext,
  projectId: string,
  level: Level,
): Promise<ItemCaller | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getProject(ctx.env, projectId);
  if (!doc) return missingProject(ctx, projectId);
  const gate = GATES[level];
  if (await gate(ctx, projectId, doc.ownerId, doc.teamId))
    return { projectId, owner, doc, scope: null };
  const tabId = ctx.url.searchParams.get('tabId');
  if (!tabId) {
    // A whole-project grant that falls short of the level (a view link writing) is refused
    // outright; a grant confined to one tab must name it.
    const grant = await gateGrant(ctx, projectId, doc.ownerId, doc.teamId);
    return grant && grant.tabScope === null ? forbidden() : deniedOnTab(ctx, doc);
  }
  if (!(await gate(ctx, projectId, doc.ownerId, doc.teamId, tabId))) return deniedOnTab(ctx, doc);
  const tab = await getTab(ctx.env, projectId, tabId);
  if (!tab) return notFound();
  const items = await listItems(ctx.env, projectId);
  return {
    projectId,
    owner,
    doc,
    scope: itemIdsShownOnTab(tab.elements, items),
    scopeTakesNew: tabShowsEveryCard(tab.elements),
    items,
  };
}

export async function writer(ctx: PlanRouteContext, owner: string): Promise<ItemPerson> {
  const p = await getParticipant(ctx.env, owner);
  return {
    id: await itemPersonId(owner),
    name: p?.name ?? 'Someone',
    color: p?.color && isSafeColourValue(p.color) ? p.color : '#94a3b8',
  };
}

export function relay(
  ctx: PlanRouteContext,
  projectId: string,
  upserts: Item[],
  removed: string[],
  rev: number,
) {
  ctx.waitUntil?.(
    relayItems(ctx.env, projectId, {
      kind: 'items',
      upserts: upserts.map(itemForRoom),
      removed,
      rev,
    }),
  );
}

// What a caller is answered with: their own comment author ids, nobody else's.
export const forCaller = (caller: ItemCaller, items: Item[]) =>
  items.map((i) => itemForViewer(i, caller.owner));
