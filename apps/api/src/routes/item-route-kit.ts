// The item routes' shared parts (item-routes.ts, item-patches-route.ts, item-comment-routes.ts): who the caller is
// and what they reach, the refusals, the writer's signature and the room relay. A body is read by @livediagram/items'
// write checks (write-checks.ts), which an offline document runs too.
import { itemForRoom, itemForViewer } from '@livediagram/document';
import {
  isArchived,
  isTrashed,
  itemIdsShownOnTab,
  itemPersonId,
  statusExcluded,
  typesOf,
  type Item,
  type ItemPerson,
  type ItemRejection,
  type TabItemElement,
} from '@livediagram/items';
import { getDocument, getParticipant, getTab, listItems } from '../db';
import { forbidden, json, notFound } from '../responses';
import { relayItems } from '../room-client';
import {
  deniedOnTab,
  gateEdit,
  gateGrant,
  gateParticipate,
  gateRead,
  missingDocument,
  requireOwner,
  type RouteContext,
} from './context';

type Level = 'read' | 'participate' | 'edit';

export type ItemCaller = {
  documentId: string;
  owner: string;
  // The document, for the gates a comment delete checks (item-comment-routes.ts); absent on a new document's
  // seed, which writes no comments.
  doc?: NonNullable<Awaited<ReturnType<typeof getDocument>>>;
  // The item ids the caller may touch, when their grant is confined to one tab.
  scope: Set<string> | null;
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

// An item moved into a status its card type leaves out: statusExcluded against the document's types.
export function excludedStatus(
  caller: ItemCaller,
  next: Item,
  before: Item,
  undo: boolean,
): boolean {
  return statusExcluded(typesOf(caller.doc?.itemTypes), next, before, undo);
}
// A Participant works with cards but never deletes one (docs/specs/013-workspace/share-roles.md "What a
// Participant changes"): moving a card into or out of the Trash or the Archive, and restoring one whole (its votes,
// thread and key, an Editor's undo), needs an Editor. Asked only when a write does that, so an ordinary card edit
// pays for no second gate.
export function retiresItem(before: Item, next: Item): boolean {
  return isTrashed(before) !== isTrashed(next) || isArchived(before) !== isArchived(next);
}

export async function isItemEditor(ctx: RouteContext, caller: ItemCaller): Promise<boolean> {
  if (caller.editor !== undefined) return caller.editor;
  const doc = caller.doc;
  const tabId = ctx.url.searchParams.get('tabId') ?? undefined;
  caller.editor =
    !!doc &&
    ((await gateEdit(ctx, caller.documentId, doc.ownerId, doc.teamId)) ||
      (!!tabId && (await gateEdit(ctx, caller.documentId, doc.ownerId, doc.teamId, tabId))));
  if (!caller.editor)
    console.info('[items] items.retire.refused', { documentId: caller.documentId });
  return caller.editor;
}

export const itemBusy = () => {
  console.warn('[items] items.write.busy');
  return json(
    { error: 'item_busy', message: 'the item kept changing; try again' },
    { status: 409 },
  );
};

// The caller and their reach: the whole document, or (a tab-scoped grant) the items one tab shows.
export async function itemCaller(
  ctx: RouteContext,
  documentId: string,
  level: Level,
): Promise<ItemCaller | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getDocument(ctx.env, documentId);
  if (!doc) return missingDocument(ctx, documentId);
  const gate = GATES[level];
  if (await gate(ctx, documentId, doc.ownerId, doc.teamId))
    return { documentId, owner, doc, scope: null };
  const tabId = ctx.url.searchParams.get('tabId');
  if (!tabId) {
    // A whole-document grant that falls short of the level (a view link writing) is refused
    // outright; a grant confined to one tab must name it.
    const grant = await gateGrant(ctx, documentId, doc.ownerId, doc.teamId);
    return grant && grant.tabScope === null ? forbidden() : deniedOnTab(ctx, doc);
  }
  if (!(await gate(ctx, documentId, doc.ownerId, doc.teamId, tabId))) return deniedOnTab(ctx, doc);
  const tab = await getTab(ctx.env, documentId, tabId);
  if (!tab) return notFound();
  const items = await listItems(ctx.env, documentId);
  return {
    documentId,
    owner,
    doc,
    scope: itemIdsShownOnTab(tab.elements as unknown as TabItemElement[], items),
    items,
  };
}

export async function writer(ctx: RouteContext, owner: string): Promise<ItemPerson> {
  const p = await getParticipant(ctx.env, owner);
  return {
    id: await itemPersonId(owner),
    name: p?.name ?? 'Someone',
    color: p?.color ?? '#94a3b8',
  };
}

export function relay(
  ctx: RouteContext,
  documentId: string,
  upserts: Item[],
  removed: string[],
  rev: number,
) {
  ctx.waitUntil?.(
    relayItems(ctx.env, documentId, {
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
