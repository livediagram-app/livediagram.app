// Blocked By links between cards (docs/specs/026-plan/item-types.md "Blocked By"): a Card field with its Blocks
// switch on (`blocks: true`) holds the cards that block the card. A card is blocked while one of its live blockers
// (present, not trashed or archived) is outside the plan-wide done columns. One lookup, made once per items change,
// answers every card's blockers, the cards it blocks and its open count, so a card face reads a Map rather than
// scanning the plan. A write may never close a loop (A blocks B blocks A): blockingCycleOf checks only the links a
// write adds, walking each one's upstream once. Pure.
import type { Item } from './item';
import { itemStatus, itemTitle } from './item';
import { isArchived, isTrashed } from './board';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { typeIn } from './type-catalogue';
import { linkedCardIds } from './several-values';

// Whether a status counts as done (calculated-fields.ts IsDoneStatus, restated so this module stays a leaf).
type IsDone = (status: string | undefined) => boolean;

export const isBlocksField = (field: Pick<CustomFieldDef, 'kind' | 'blocks'>): boolean =>
  field.kind === 'card' && field.blocks === true;

// The Blocks fields a type offers, in its field order: a field taken off the type blocks nothing.
export function blocksFieldsOf(type: ItemTypeDef): CustomFieldDef[] {
  const out: CustomFieldDef[] = [];
  for (const id of type.fields) {
    const f = type.custom?.find((c) => c.id === id);
    if (f && isBlocksField(f)) out.push(f);
  }
  return out;
}

// Whether any type in the catalogue offers a Blocks field: a plan without one pays for no index.
export const hasBlocksFields = (types: readonly ItemTypeDef[]): boolean =>
  types.some((t) => blocksFieldsOf(t).length > 0);

// Every card id a card's Blocks fields hold, each once, in field then list order, never the card itself.
export function blockerIdsOf(item: Pick<Item, 'id' | 'fields'>, type: ItemTypeDef): string[] {
  const out: string[] = [];
  for (const f of blocksFieldsOf(type))
    for (const id of linkedCardIds(item, f)) if (id !== item.id && !out.includes(id)) out.push(id);
  return out;
}

// The first Blocks field, of either card's type, whose stored value a write changes (by JSON): what the api's
// Editor gate asks. A create (no `before`) changes every Blocks field it gives a value. Null when none.
export function blocksValueChanged(
  types: readonly ItemTypeDef[],
  before: Pick<Item, 'type' | 'fields'> | undefined,
  next: Pick<Item, 'type' | 'fields'>,
): string | null {
  const fields = [
    ...blocksFieldsOf(typeIn(types, next.type)),
    ...(before ? blocksFieldsOf(typeIn(types, before.type)) : []),
  ];
  for (const f of fields) {
    const was = before ? JSON.stringify(before.fields[f.id] ?? null) : 'null';
    if (JSON.stringify(next.fields[f.id] ?? null) !== was) return f.id;
  }
  return null;
}

// One pass over the plan's cards: each card's live blockers, the live cards it blocks, and how many of its blockers
// are open (not done).
export interface BlockingIndex {
  blockers: ReadonlyMap<string, readonly Item[]>;
  blocks: ReadonlyMap<string, readonly Item[]>;
  open: ReadonlyMap<string, number>;
}

const live = (it: Item | undefined): it is Item => !!it && !isTrashed(it) && !isArchived(it);

export function blockingIndexOf(
  items: Iterable<Item>,
  types: readonly ItemTypeDef[],
  isDone: IsDone,
): BlockingIndex {
  const blockers = new Map<string, Item[]>();
  const blocks = new Map<string, Item[]>();
  const open = new Map<string, number>();
  if (!hasBlocksFields(types)) return { blockers, blocks, open };
  const list = [...items];
  const byId = new Map(list.map((i) => [i.id, i]));
  // Each type's Blocks fields, worked out once.
  const fieldsOf = new Map<string, CustomFieldDef[]>();
  for (const it of list) {
    if (isTrashed(it)) continue;
    let fields = fieldsOf.get(it.type);
    if (!fields) {
      fields = blocksFieldsOf(typeIn(types, it.type));
      fieldsOf.set(it.type, fields);
    }
    if (fields.length === 0) continue;
    const mine: Item[] = [];
    let count = 0;
    for (const f of fields)
      for (const id of linkedCardIds(it, f)) {
        const b = byId.get(id);
        if (id === it.id || !live(b) || mine.includes(b)) continue;
        mine.push(b);
        if (!isDone(itemStatus(b))) count += 1;
        if (!isArchived(it)) {
          const theirs = blocks.get(b.id);
          if (theirs) theirs.push(it);
          else blocks.set(b.id, [it]);
        }
      }
    if (mine.length) blockers.set(it.id, mine);
    if (count) open.set(it.id, count);
  }
  for (const l of blocks.values()) l.sort((a, b) => a.key - b.key);
  return { blockers, blocks, open };
}

// A card's count of open blockers: 0 when it is not blocked.
export const openBlockersOf = (index: BlockingIndex, id: string): number => index.open.get(id) ?? 0;

// The badge's accessible name: "Blocked by 2 open cards".
export const blockedLabel = (count: number): string =>
  `Blocked by ${count} open ${count === 1 ? 'card' : 'cards'}`;

// The Blocks mirror's heading (docs/specs/026-plan/item-types.md "Blocked By"): "Blocks" for a field named Blocked
// By, else "Blocks (Waiting On)".
export const blocksHeading = (label: string): string =>
  label.trim().toLowerCase() === 'blocked by' ? 'Blocks' : `Blocks (${label})`;

// The upstream walk: from `from`, through each card's blockers (every card, trashed and archived ones too), the path
// to `to` when there is one ([from, ..., to]), else null. Iterative with a visited set, so a loop already in the plan
// ends it, and each card is read once.
function pathUpstream(
  from: string,
  to: string,
  blockersOf: (id: string) => readonly string[],
): string[] | null {
  const cameFrom = new Map<string, string | null>([[from, null]]);
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) {
      const path: string[] = [];
      for (let at: string | null = id; at !== null; at = cameFrom.get(at) ?? null) path.push(at);
      return path.reverse();
    }
    for (const next of blockersOf(id))
      if (!cameFrom.has(next)) {
        cameFrom.set(next, id);
        stack.push(next);
      }
  }
  return null;
}

// Every card's blocker ids, read lazily and kept: the graph a loop check walks.
function blockerGraph(
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
): (id: string) => readonly string[] {
  const seen = new Map<string, readonly string[]>();
  return (id) => {
    let ids = seen.get(id);
    if (!ids) {
      const it = items.get(id);
      ids = it ? blockerIdsOf(it, typeIn(types, it.type)) : [];
      seen.set(id, ids);
    }
    return ids;
  };
}

// The chain a new blocker would close (the blocker first, `itemId` last) when `blockerId` already waits on `itemId`,
// else null: what the card panel asks before a pick adds a card to a Blocked By field.
export function blockingLoop(
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  itemId: string,
  blockerId: string,
): Item[] | null {
  if (blockerId === itemId) return null;
  const path = pathUpstream(blockerId, itemId, blockerGraph(items, types));
  return path ? path.map((id) => items.get(id)!) : null;
}

// A write's change to one card: its state before (none for a create) and after.
export interface BlockingChange {
  before?: Pick<Item, 'id' | 'type' | 'fields'>;
  next: Item;
}

// The first loop a write would close: the card and the chain from its new blocker back to it. Only the links a change
// adds are walked (blockers its next state holds that its before state did not), over the plan as the write leaves
// it (`items` with every change's next state). Null when it closes none.
export function blockingCycleOf(
  items: Iterable<Item>,
  types: readonly ItemTypeDef[],
  changes: readonly BlockingChange[],
): { itemId: string; chain: Item[] } | null {
  if (changes.length === 0 || !hasBlocksFields(types)) return null;
  // The links each change adds, read from the cards alone: a write adding none never reads the plan.
  const added: { item: Item; blocker: string }[] = [];
  for (const c of changes) {
    const had = c.before ? blockerIdsOf(c.before, typeIn(types, c.before.type)) : [];
    for (const b of blockerIdsOf(c.next, typeIn(types, c.next.type)))
      if (!had.includes(b)) added.push({ item: c.next, blocker: b });
  }
  if (added.length === 0) return null;
  const after = new Map<string, Item>();
  for (const it of items) after.set(it.id, it);
  for (const c of changes) after.set(c.next.id, c.next);
  const graph = blockerGraph(after, types);
  for (const { item, blocker } of added) {
    const path = pathUpstream(blocker, item.id, graph);
    if (path) return { itemId: item.id, chain: path.map((id) => after.get(id)!) };
  }
  return null;
}

const named = (it: Item) => `#${it.key} ${itemTitle(it).trim() || 'Untitled'}`;

// What a refused loop says: "#5 Launch already waits on #3 Website, so it can't block it.", naming the cards between
// when the chain is longer ("... waits on #3 Website through #7 Copy, ...").
export function blockingLoopMessage(chain: readonly Item[]): string {
  const blocker = chain[0]!;
  const item = chain[chain.length - 1]!;
  const between = chain.slice(1, -1);
  const through = between.length ? ` through ${between.map(named).join(', ')}` : '';
  return `${named(blocker)} already waits on ${named(item)}${through}, so it can't block it.`;
}
