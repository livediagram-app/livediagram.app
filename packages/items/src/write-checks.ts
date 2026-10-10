// The checks every item write passes (blueprint item-store.md "Interfaces and contracts"): a create, patch or move
// read as the api reads its body, and the items it leaves checked against their card types and the size bounds.
// The api reads request bodies with them; an offline document runs the same checks on its own writes, so it never
// holds what a Sync to Cloud would refuse (docs/specs/026-plan/items.md "Offline documents").

import type { Item, ItemCreate, ItemMove, ItemPatch, ItemPlace } from './item';
import { isMoveSettable, itemStatus } from './item';
import { TRASHED_FROM_FIELD, isTrashed } from './board';
import {
  fieldsWithinBounds,
  isValidItemId,
  isValidItemType,
  validateClear,
  validateFields,
  validateVotes,
  type ItemRejection,
} from './fields';
import { ITEM_STATUS_MAX } from './limits';
import type { ItemTypeDef } from './item-types';
import { typeAllowsStatus, typeIn } from './type-catalogue';
import type { ItemWrite } from './store';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function readItemPlace(raw: unknown): ItemPlace | ItemRejection {
  if (raw === undefined) return {};
  if (!isRecord(raw)) return 'place_invalid';
  const place: ItemPlace = {};
  if (raw.status !== undefined) {
    if (typeof raw.status !== 'string' || !raw.status.trim() || raw.status.length > ITEM_STATUS_MAX)
      return 'place_invalid';
    place.status = raw.status.trim();
  }
  for (const side of ['after', 'before'] as const) {
    const v = raw[side];
    if (v === undefined) continue;
    if (v !== null && !isValidItemId(v)) return 'place_invalid';
    place[side] = v;
  }
  return place;
}

// A create as the api reads it, but for its comment thread, which the api checks itself (it keeps author ids on
// the caller's own comments only) and an offline document keeps as it is.
export function readItemCreate(raw: unknown): Omit<ItemCreate, 'comments'> | ItemRejection {
  if (!isRecord(raw)) return 'field_value_invalid';
  if (!isValidItemType(raw.type)) return 'type_invalid';
  if (raw.id !== undefined && !isValidItemId(raw.id)) return 'id_invalid';
  const fields = validateFields(raw.fields, 'create');
  if (!fields.ok) return fields.error;
  const place = readItemPlace(raw.place);
  if (typeof place === 'string') return place;
  const bound = fieldsWithinBounds(fields.fields);
  if (bound) return bound;
  const votes = validateVotes(raw.votes);
  if (!votes) return 'field_value_invalid';
  const key = raw.key;
  return {
    type: raw.type,
    fields: fields.fields,
    place,
    ...(Object.keys(votes).length ? { votes } : {}),
    ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
    ...(typeof key === 'number' && Number.isInteger(key) && key > 0 ? { key } : {}),
  };
}

export function readItemPatch(body: Record<string, unknown>): ItemPatch | ItemRejection {
  const patch: ItemPatch = {};
  if (body.set !== undefined) {
    const set = validateFields(body.set, 'patch');
    if (!set.ok) return set.error;
    patch.set = set.fields;
  }
  const clear = validateClear(body.clear);
  if (!clear.ok) return clear.error;
  if (clear.keys.length) patch.clear = clear.keys;
  if (body.type !== undefined) {
    if (!isValidItemType(body.type)) return 'type_invalid';
    patch.type = body.type;
  }
  return patch;
}

// A move: a place, and only the fields a move may set or clear (isMoveSettable).
export function readItemMove(body: Record<string, unknown>): ItemMove | ItemRejection {
  const place = readItemPlace(body);
  if (typeof place === 'string') return place;
  const move: ItemMove = place;
  const lane = readItemPatch(body);
  if (typeof lane === 'string') return lane;
  const touched = [...Object.keys(lane.set ?? {}), ...(lane.clear ?? [])];
  if (touched.some((k) => !isMoveSettable(k))) return 'place_invalid';
  if (lane.set) move.set = lane.set;
  if (lane.clear) move.clear = lane.clear;
  if (lane.type) move.type = lane.type;
  return move;
}

// An item moved into a status its card type leaves out (docs/specs/026-plan/item-types.md "An item type"). Only a
// change of status into such a one is refused: making a card in any status is allowed (a type that leaves every
// status out can still be made, it just never moves), a card already in one is never moved out by this, and a type
// change that keeps its status is let through. Putting a change back is never refused either: a trashed card
// restored to the status it was trashed from, and an undo or redo (`undo`: the body's `undo: true`).
export function statusExcluded(
  types: readonly ItemTypeDef[],
  next: Item,
  before: Item,
  undo: boolean,
): boolean {
  const status = itemStatus(next);
  if (undo || !status || itemStatus(before) === status) return false;
  if (isTrashed(before) && before.fields[TRASHED_FROM_FIELD] === status) return false;
  return !typeAllowsStatus(typeIn(types, next.type), status);
}

export type ItemWriteRefusal = { error: ItemRejection; id?: string };

// `write` read as the api reads the request it is sent as: the write with its fields normalised as the api stores
// them, or the refusal the api would answer.
export function readItemWrite(write: ItemWrite): ItemWrite | ItemWriteRefusal {
  switch (write.kind) {
    case 'create': {
      const creates: ItemCreate[] = [];
      for (const c of write.creates) {
        const read = readItemCreate(c);
        if (typeof read === 'string') return { error: read, ...(c.id ? { id: c.id } : {}) };
        creates.push(c.comments === undefined ? read : { ...read, comments: c.comments });
      }
      return { kind: 'create', creates };
    }
    case 'patch': {
      const patch = readItemPatch(write.patch as Record<string, unknown>);
      return typeof patch === 'string' ? { error: patch, id: write.id } : { ...write, patch };
    }
    case 'patches': {
      const patches: { id: string; patch: ItemPatch }[] = [];
      for (const p of write.patches) {
        const patch = readItemPatch(p.patch as Record<string, unknown>);
        if (typeof patch === 'string') return { error: patch, id: p.id };
        patches.push({ id: p.id, patch });
      }
      return { ...write, patches };
    }
    case 'move': {
      const move = readItemMove(write.move as Record<string, unknown>);
      return typeof move === 'string' ? { error: move, id: write.id } : { ...write, move };
    }
    default:
      return write;
  }
}

// The items a patch, patches or move left, checked as the api checks them before it writes: a status the card's
// type leaves out (statusExcluded), and the fields' size. Null when every one passes.
export function writtenItemsRefusal(
  write: ItemWrite,
  before: readonly Item[],
  upserts: readonly Item[],
  types: readonly ItemTypeDef[],
): ItemWriteRefusal | null {
  if (write.kind !== 'patch' && write.kind !== 'patches' && write.kind !== 'move') return null;
  const had = new Map(before.map((i) => [i.id, i]));
  for (const next of upserts) {
    const was = had.get(next.id);
    if (was && statusExcluded(types, next, was, write.undo === true))
      return { error: 'status_excluded', id: next.id };
    const bound = fieldsWithinBounds(next.fields);
    if (bound) return { error: bound, id: next.id };
  }
  return null;
}
