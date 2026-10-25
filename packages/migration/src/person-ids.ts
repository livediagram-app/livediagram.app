// Card and sheet people across the move (docs/migration.md, step 3). The old site stored a person on an item (its
// `createdBy`, `updatedBy`, an assignee or any person field) and on a sheet (`updatedBy`) as `{ id, name, color }`,
// with `id` a one-way hash of their owner id: the first 12 bytes of SHA-256("livediagram-item-person:" + owner id), in
// hex. liveplanner keys people the same way under its own prefix ("liveplanner-item-person:"), and the owner map may
// give someone a new owner id, so every person a liveplanner part carries is recomputed: old hash -> owner id (from the
// people the input names) -> owner map -> liveplanner's hash. A hash nobody in the list matches can't be reversed, so
// it is kept as it is (the name and colour still show; only "is this me" stops matching) and counted in the notes.
import type { MigrationPlanData } from './contract';
import { sha256HexPrefix } from './sha256';

export const OLD_ITEM_PERSON_PREFIX = 'livediagram-item-person:';
export const PLANNER_ITEM_PERSON_PREFIX = 'liveplanner-item-person:';

/** The old site's public id of a person on items. */
export function oldItemPersonId(oldOwnerId: string): string {
  return sha256HexPrefix(OLD_ITEM_PERSON_PREFIX + oldOwnerId, 12);
}

/** liveplanner's public id of a person on items (its `itemPersonId`, made synchronous). */
export function plannerItemPersonId(newOwnerId: string): string {
  return sha256HexPrefix(PLANNER_ITEM_PERSON_PREFIX + newOwnerId, 12);
}

/** Old person id -> new person id, for every old owner id given. */
export function personIdMap(
  oldOwnerIds: Iterable<string>,
  ownerOf: (oldOwnerId: string) => string,
  newPersonId: (newOwnerId: string) => string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const old of oldOwnerIds) {
    if (!old) continue;
    const hash = oldItemPersonId(old);
    if (!map.has(hash)) map.set(hash, newPersonId(ownerOf(old)));
  }
  return map;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPerson = (v: unknown): v is Rec & { id: string } =>
  isRec(v) && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.color === 'string';

type Tally = { unmatched: Set<string> };

// A field value with its people renamed; the same value back when nothing changed. Votes and similar are arrays of
// bare person ids, so a string in an array that is a known old id is renamed too. Bounded depth: fields are shallow.
function remapValue(
  value: unknown,
  map: Map<string, string>,
  tally: Tally,
  depth: number,
): unknown {
  if (depth > 4) return value;
  if (isPerson(value)) {
    const next = map.get(value.id);
    if (next === undefined) {
      if (value.id) tally.unmatched.add(value.id);
      return value;
    }
    return next === value.id ? value : { ...value, id: next };
  }
  if (Array.isArray(value)) {
    let out: unknown[] | null = null;
    for (let i = 0; i < value.length; i++) {
      const v: unknown = value[i];
      const n = typeof v === 'string' ? (map.get(v) ?? v) : remapValue(v, map, tally, depth + 1);
      if (n !== v) {
        out ??= value.slice();
        out[i] = n;
      }
    }
    return out ?? value;
  }
  if (isRec(value)) {
    let out: Rec | null = null;
    for (const k in value) {
      const v = value[k];
      const n = remapValue(v, map, tally, depth + 1);
      if (n !== v) {
        out ??= { ...value };
        out[k] = n;
      }
    }
    return out ?? value;
  }
  return value;
}

// A stored JSON column with its people renamed: the same text back when nothing changed or it doesn't parse.
function remapJson(text: string | null, map: Map<string, string>, tally: Tally): string | null {
  if (text === null || text === '') return text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  const next = remapValue(parsed, map, tally, 0);
  return next === parsed ? text : JSON.stringify(next);
}

/** The plan with every person it carries renamed for liveplanner, and how many distinct old ids matched nobody. */
export function remapPlanPeople(
  plan: MigrationPlanData,
  map: Map<string, string>,
): { plan: MigrationPlanData; unmatched: number } {
  const tally: Tally = { unmatched: new Set() };
  const items = plan.items.map((item) => ({
    ...item,
    fields: remapJson(item.fields, map, tally) ?? item.fields,
    createdBy: remapJson(item.createdBy, map, tally),
    updatedBy: remapJson(item.updatedBy, map, tally),
  }));
  const sheets = plan.sheets.map((sheet) => ({
    ...sheet,
    updatedBy: remapJson(sheet.updatedBy, map, tally),
  }));
  return { plan: { ...plan, items, sheets }, unmatched: tally.unmatched.size };
}
