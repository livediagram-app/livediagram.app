// Shape libraries (docs/specs/013-workspace/shape-libraries.md): the wire types, the limits, and the
// rules both sides apply (the api enforces them; the client checks before it sends). Pure.

import {
  isRecord,
  isValidElement,
  migrateIncomingElements,
  type Element,
} from '@livediagram/document';

/** How many shape libraries one owner can create. */
export const MAX_SHAPE_LIBRARIES_PER_OWNER = 100;
/** How many items one library holds; an import keeps the first ones. */
export const MAX_SHAPE_LIBRARY_ITEMS = 1000;
/** A library's name, trimmed. */
export const MAX_SHAPE_LIBRARY_NAME_CHARS = 120;
/** An item's title. */
export const MAX_SHAPE_LIBRARY_TITLE_CHARS = 200;
/** An item's id; the client mints UUIDs (36). */
export const MAX_SHAPE_LIBRARY_ITEM_ID_CHARS = 64;
/** An item's width and height, in px. */
export const MAX_SHAPE_LIBRARY_ITEM_SIDE = 100_000;

/** Where a library came from; one value today. */
export type ShapeLibrarySource = 'drawio';
export const SHAPE_LIBRARY_SOURCES: readonly ShapeLibrarySource[] = ['drawio'];

/** One reusable shape: its elements placed from its top-left corner at (0, 0). */
export type ShapeLibraryItem = {
  id: string;
  title: string;
  width: number;
  height: number;
  elements: Element[];
};

export type ShapeLibrary = {
  id: string;
  ownerId: string;
  name: string;
  source: ShapeLibrarySource;
  items: ShapeLibraryItem[];
  createdAt: number;
  updatedAt: number;
};

const key = (name: string) => name.trim().toLowerCase();

/** A name trimmed; null when empty, too long, or not a string. */
export function normaliseLibraryName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed && trimmed.length <= MAX_SHAPE_LIBRARY_NAME_CHARS ? trimmed : null;
}

/**
 * `name` when the owner does not use it yet (trimmed, case-insensitive), else `"<name> (n)"` for the
 * smallest free n from 2, the name shortened so the whole fits `MAX_SHAPE_LIBRARY_NAME_CHARS`.
 */
export function uniqueLibraryName(name: string, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, key));
  const base = name.trim();
  if (!used.has(key(base))) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate =
      base.slice(0, MAX_SHAPE_LIBRARY_NAME_CHARS - suffix.length).trimEnd() + suffix;
    if (!used.has(key(candidate))) return candidate;
  }
}

export type ShapeLibraryItemsRejection =
  'not-a-list' | 'too-many-items' | 'invalid-item' | 'duplicate-item-id' | 'invalid-element';

const side = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_SHAPE_LIBRARY_ITEM_SIDE;

/**
 * Untrusted items checked as the tab endpoints check elements: each element migrated, then
 * `isValidElement`. Returns the migrated items, or the first rule broken.
 */
export function validateShapeLibraryItems(
  items: unknown,
): { ok: true; items: ShapeLibraryItem[] } | { ok: false; reason: ShapeLibraryItemsRejection } {
  if (!Array.isArray(items)) return { ok: false, reason: 'not-a-list' };
  if (items.length > MAX_SHAPE_LIBRARY_ITEMS) return { ok: false, reason: 'too-many-items' };
  const ids = new Set<string>();
  const out: ShapeLibraryItem[] = [];
  for (const raw of items) {
    if (
      !isRecord(raw) ||
      typeof raw.id !== 'string' ||
      raw.id === '' ||
      raw.id.length > MAX_SHAPE_LIBRARY_ITEM_ID_CHARS ||
      typeof raw.title !== 'string' ||
      raw.title.length > MAX_SHAPE_LIBRARY_TITLE_CHARS ||
      !side(raw.width) ||
      !side(raw.height) ||
      !Array.isArray(raw.elements)
    ) {
      return { ok: false, reason: 'invalid-item' };
    }
    if (ids.has(raw.id)) return { ok: false, reason: 'duplicate-item-id' };
    ids.add(raw.id);
    if (!raw.elements.every(isRecord)) return { ok: false, reason: 'invalid-element' };
    const elements = migrateIncomingElements(raw.elements);
    if (!elements.every((el) => isValidElement(el)))
      return { ok: false, reason: 'invalid-element' };
    out.push({
      id: raw.id,
      title: raw.title,
      width: raw.width as number,
      height: raw.height as number,
      elements,
    });
  }
  return { ok: true, items: out };
}

/** The bytes the items take in their row: their UTF-8 JSON (the budget is `MAX_TAB_BYTES`). */
export function shapeLibraryItemsBytes(items: readonly ShapeLibraryItem[]): number {
  return new TextEncoder().encode(JSON.stringify(items)).length;
}
