// The checks every item write passes (blueprint item-store.md "Interfaces and contracts"): a create, patch or move
// read as the api reads its body, and the items it leaves checked against their card types and the size bounds.
// The api reads request bodies with them; an offline project runs the same checks on its own writes, so it never
// holds what a Sync to Cloud would refuse (docs/specs/026-plan/items.md "Offline projects").

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
import { isObj } from './validate';
import type { ItemTypeDef } from './item-types';
import { calculatedFieldsOf } from './calculated-fields';
import { CUSTOM_FIELD_ID_PATTERN, customFieldOf, typeAllowsStatus, typeIn } from './type-catalogue';
import { missingRequiredFields, requiredCleared } from './required-fields';
import type { ItemWrite } from './store';
import { isTimeSpent } from './duration-fields';
import { readTimeOp } from './time-tracking';
import { blockingCycleOf, blockingLoopMessage, type BlockingChange } from './blocked-by';

export function readItemPlace(raw: unknown): ItemPlace | ItemRejection {
  if (raw === undefined) return {};
  if (!isObj(raw)) return 'place_invalid';
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
// the caller's own comments only) and an offline project keeps as it is.
export function readItemCreate(raw: unknown): Omit<ItemCreate, 'comments'> | ItemRejection {
  if (!isObj(raw)) return 'field_value_invalid';
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
// restored to the status it was trashed from, and an undo or redo (`undo`: the body's `undo: true`). Nor is moving
// a card to the Trash: the Trash is a status no type lists (a type's ordered statuses name its board states), so
// without this every card of a type with a list could not be deleted.
export function statusExcluded(
  types: readonly ItemTypeDef[],
  next: Item,
  before: Item,
  undo: boolean,
): boolean {
  const status = itemStatus(next);
  if (undo || !status || itemStatus(before) === status || isTrashed(next)) return false;
  if (isTrashed(before) && before.fields[TRASHED_FROM_FIELD] === status) return false;
  return !typeAllowsStatus(typeIn(types, next.type), status);
}

// A Calculated field given a value (docs/specs/026-plan/item-types.md "Calculated fields"): its id, else null. Only a
// value that is new is refused: clearing an old one, or a change that leaves it as it was, passes.
export function calculatedWritten(
  types: readonly ItemTypeDef[],
  next: Pick<Item, 'type' | 'fields'>,
  before?: Pick<Item, 'fields'>,
): string | null {
  for (const f of calculatedFieldsOf(typeIn(types, next.type))) {
    const v = next.fields[f.id];
    if (v === undefined || v === null || v === '') continue;
    if (!before || JSON.stringify(before.fields[f.id]) !== JSON.stringify(v)) return f.id;
  }
  return null;
}

// A Time Spent field a card write set, cleared or changed (docs/specs/026-plan/item-types.md "Time Spent"): its id,
// else null. Its entries change only through time writes; a card put back (an undo of a delete, a sync) carries them.
export function timeSpentWritten(
  types: readonly ItemTypeDef[],
  next: Pick<Item, 'type' | 'fields'>,
  before?: Pick<Item, 'fields'>,
): string | null {
  const type = typeIn(types, next.type);
  for (const f of type?.custom ?? []) {
    if (!isTimeSpent(f) || !type.fields.includes(f.id)) continue;
    const was = before ? JSON.stringify(before.fields[f.id] ?? null) : 'null';
    if (JSON.stringify(next.fields[f.id] ?? null) !== was) return f.id;
  }
  return null;
}

// Why a time write can't land on `item`: its field is no Time Spent field its card type offers. Null when it can.
export function timeWriteRefusal(
  types: readonly ItemTypeDef[],
  item: Pick<Item, 'type'>,
  field: string,
): 'time_invalid' | null {
  const type = typeIn(types, item.type);
  const def = type ? customFieldOf(type, field) : undefined;
  return def && isTimeSpent(def) && type.fields.includes(field) ? null : 'time_invalid';
}

type ItemWriteRefusal = { error: ItemRejection; id?: string; field?: string; message?: string };

// A new card missing a required custom field (docs/specs/026-plan/item-types.md "Required fields"): the first one,
// or null. A create that restores a card (an undo, a sync or copy: it carries its number, votes or thread) is let
// through, as the card it brings back was made before.
export function createRefusal(
  types: readonly ItemTypeDef[],
  create: Pick<ItemCreate, 'type' | 'fields' | 'key' | 'votes' | 'comments'>,
): { error: 'field_required'; field: string } | null {
  if (create.key !== undefined || create.votes !== undefined || create.comments !== undefined)
    return null;
  const missing = missingRequiredFields(typeIn(types, create.type), create.fields)[0];
  return missing ? { error: 'field_required', field: missing.id } : null;
}

// A change that empties a required field the item had a value for, its field id, or null; an undo or redo is never
// refused.
export function requiredClearedBy(
  types: readonly ItemTypeDef[],
  next: Item,
  before: Item,
  undo: boolean,
): string | null {
  if (undo) return null;
  return requiredCleared(typeIn(types, next.type), before.fields, next.fields)?.id ?? null;
}

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
    case 'time': {
      const op = readTimeOp(write.op);
      if (typeof op === 'string' || !CUSTOM_FIELD_ID_PATTERN.test(write.field))
        return { error: 'time_invalid', id: write.id };
      return { ...write, op };
    }
    default:
      return write;
  }
}

// The items a write left, checked as the api checks them before it writes: a new card missing a required field
// (createRefusal) or giving a Calculated field a value (calculatedWritten); for a patch, patches or move a status the
// card's type leaves out (statusExcluded), a Calculated field given a value, a required field emptied
// (requiredClearedBy), and the fields' size. Null when every one passes.
export function writtenItemsRefusal(
  write: ItemWrite,
  before: readonly Item[],
  upserts: readonly Item[],
  types: readonly ItemTypeDef[],
): ItemWriteRefusal | null {
  if (write.kind === 'create') {
    for (const c of write.creates) {
      const refused = createRefusal(types, c);
      if (refused) return { ...refused, ...(c.id ? { id: c.id } : {}) };
      // A card put back (a restore or sync carries its number, votes or thread) holds only what it held.
      if (c.key !== undefined || c.votes !== undefined || c.comments !== undefined) continue;
      const field = calculatedWritten(types, c);
      if (field) return { error: 'field_calculated', field, ...(c.id ? { id: c.id } : {}) };
      const timed = timeSpentWritten(types, c);
      if (timed)
        return { error: 'field_time_tracked', field: timed, ...(c.id ? { id: c.id } : {}) };
    }
    return loopRefusal(before, upserts, types, new Map());
  }
  if (write.kind === 'time') {
    const next = upserts[0];
    if (!next) return null;
    if (timeWriteRefusal(types, next, write.field))
      return { error: 'time_invalid', id: next.id, field: write.field };
    const bound = fieldsWithinBounds(next.fields);
    return bound ? { error: bound, id: next.id } : null;
  }
  if (write.kind !== 'patch' && write.kind !== 'patches' && write.kind !== 'move') return null;
  const had = new Map(before.map((i) => [i.id, i]));
  for (const next of upserts) {
    const was = had.get(next.id);
    if (was && statusExcluded(types, next, was, write.undo === true))
      return { error: 'status_excluded', id: next.id };
    const field = write.undo === true ? null : calculatedWritten(types, next, was);
    if (field) return { error: 'field_calculated', id: next.id, field };
    const timed = timeSpentWritten(types, next, was);
    if (timed) return { error: 'field_time_tracked', id: next.id, field: timed };
    const cleared = was && requiredClearedBy(types, next, was, write.undo === true);
    if (cleared) return { error: 'field_required', id: next.id, field: cleared };
    const bound = fieldsWithinBounds(next.fields);
    if (bound) return { error: bound, id: next.id };
  }
  return loopRefusal(before, upserts, types, had);
}

// A write that closes a Blocked By loop (docs/specs/026-plan/item-types.md "Blocked By"): the card, and the sentence
// naming the chain. Every write is checked, an undo's too, as the api checks it.
function loopRefusal(
  before: readonly Item[],
  upserts: readonly Item[],
  types: readonly ItemTypeDef[],
  had: ReadonlyMap<string, Item>,
): ItemWriteRefusal | null {
  const changes: BlockingChange[] = upserts.map((next) => {
    const was = had.get(next.id);
    return was ? { before: was, next } : { next };
  });
  const loop = blockingCycleOf(before, types, changes);
  return loop
    ? { error: 'blocks_cycle', id: loop.itemId, message: blockingLoopMessage(loop.chain) }
    : null;
}
