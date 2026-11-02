// Many cards moved as one write (docs/specs/026-plan/items.md "Move many"; blueprint item-store.md "Many moves"): a
// group dragged on a board, a selection's Move To. The moves apply in order against one pool, so a move naming an
// earlier one (`after: <its id>`) ranks after it as moved: the group lands together, in its order.
import type { Item, ItemMove, ItemPlace } from './item';
import { itemStatus } from './item';
import { applyMove, byRank, columnItems, inversePatch, placeOf, type WriteContext } from './apply';
import { statusSinceUndo } from './status-since';

export type ItemMoveOf = { id: string; move: ItemMove };

// What a card adds to its own move (a swimlane's field, an Archive board's restore).
type PerCard = (id: string) => Pick<ItemMove, 'set' | 'clear' | 'type'> | undefined;

// The chain a group lands with: the first card at `first` (its status and neighbour), each next one right after the
// one before, in the same status.
export function groupMoves(
  ids: readonly string[],
  first: Pick<ItemMove, 'status' | 'before' | 'after'>,
  perCard?: PerCard,
): ItemMoveOf[] {
  const out: ItemMoveOf[] = [];
  let prev: string | null = null;
  for (const id of ids) {
    const place: ItemMove =
      prev === null
        ? { ...first }
        : { ...(first.status !== undefined ? { status: first.status } : {}), after: prev };
    out.push({ id, move: { ...place, ...perCard?.(id) } });
    prev = id;
  }
  return out;
}

// The moves applied in order against `items`: each moved item's last state (in the order first moved), or the id of
// one that is missing.
export function applyMoves(
  items: Iterable<Item>,
  moves: readonly ItemMoveOf[],
  ctx: WriteContext,
): { ok: true; moved: Map<string, Item> } | { ok: false; missing: string } {
  const pool = new Map<string, Item>();
  for (const it of items) pool.set(it.id, it);
  const moved = new Map<string, Item>();
  for (const { id, move } of moves) {
    const item = pool.get(id);
    if (!item) return { ok: false, missing: id };
    const next = applyMove(item, move, pool.values(), ctx);
    pool.set(id, next);
    moved.set(id, next);
  }
  return { ok: true, moved };
}

// The moves that put each card of `moves` back where it sat in `before`, and the patch clearing the status of a card
// that had none (a move always keeps a status). Each card goes back before the card it sat before; within a column the
// last card is restored first, so its old neighbour is already back when the one above it lands.
export function inverseMoves(
  before: readonly Item[],
  moves: readonly ItemMoveOf[],
): { moves: ItemMoveOf[]; unstatus: { id: string; set: Item['fields'] }[] } | null {
  const byId = new Map(before.map((i) => [i.id, i]));
  // Each card's own changes, as its moves end (a card moved twice is put back once).
  const touched = new Map<
    string,
    { set: Item['fields']; clear: string[]; type?: string; status?: string }
  >();
  for (const { id, move } of moves) {
    if (!byId.has(id)) return null;
    const t = touched.get(id) ?? { set: {}, clear: [] };
    Object.assign(t.set, move.set ?? {});
    t.clear.push(...(move.clear ?? []));
    if (move.type !== undefined) t.type = move.type;
    if (move.status !== undefined) t.status = move.status;
    touched.set(id, t);
  }
  const columnIndex = new Map<string, number>();
  const columns = new Map<string | undefined, Item[]>();
  for (const id of touched.keys()) {
    const status = itemStatus(byId.get(id)!);
    if (!columns.has(status)) columns.set(status, columnItems(before, status));
  }
  for (const col of columns.values()) col.forEach((it, i) => columnIndex.set(it.id, i));
  const order = [...touched.keys()].sort((a, b) => {
    const ia = byId.get(a)!;
    const ib = byId.get(b)!;
    const sa = itemStatus(ia) ?? '';
    const sb = itemStatus(ib) ?? '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return (columnIndex.get(b) ?? 0) - (columnIndex.get(a) ?? 0) || byRank(ib, ia);
  });
  const out: ItemMoveOf[] = [];
  const unstatus: { id: string; set: Item['fields'] }[] = [];
  for (const id of order) {
    const item = byId.get(id)!;
    const t = touched.get(id)!;
    const lane = inversePatch(item, {
      set: t.set,
      clear: t.clear,
      ...(t.type !== undefined ? { type: t.type } : {}),
    });
    const place: ItemPlace = placeOf(item, before);
    const move: ItemMove = { ...place };
    const since = t.status === undefined ? {} : statusSinceUndo(item, t.status);
    if (lane.set || Object.keys(since).length) move.set = { ...lane.set, ...since };
    if (lane.clear) move.clear = lane.clear;
    if (lane.type) move.type = lane.type;
    out.push({ id, move });
    if (itemStatus(item) === undefined && t.status !== undefined) unstatus.push({ id, set: since });
  }
  return { moves: out, unstatus };
}
