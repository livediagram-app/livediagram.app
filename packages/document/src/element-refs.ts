// Refs, slug ids and kind words (docs/specs/024-agents/document-views.md "Refs"): how views, edit
// operations and the lint name elements alike. Element ids are opaque strings; nothing here reads
// them as UUIDs.
import { eventStormingKindOf } from './event-storming';
import type { Element } from './index';
import { ELEMENT_TYPES, SHAPE_KINDS } from './validate';

export const SLUG_ID_PATTERN = /^[a-z][a-z0-9_-]{0,23}$/;
export const SLUG_ID_MAX_LENGTH = 24;
export const REF_MIN_LENGTH = 4;
export const REF_NEAREST_MAX = 5;
// What a kind word slugs to when it holds nothing a slug can (an unknown kind's `?`).
const SLUG_FALLBACK_BASE = 'element';
const SAFE_REF_PATTERN = /^[A-Za-z0-9_-]+$/;
const ID_REF_PREFIX = 'id:';

export function isSlugId(id: string): boolean {
  return SLUG_ID_PATTERN.test(id);
}

export type RefTable = {
  // Every id the table was built from, in its given order.
  readonly ids: readonly string[];
  readonly refOf: (id: string) => string;
};

export type RefResolution =
  | { kind: 'found'; id: string }
  | { kind: 'ambiguous'; input: string; candidates: string[]; stale: boolean }
  | { kind: 'not-found'; input: string; nearest: string[] };

function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function printedRef(id: string, longestShared: number): string {
  if (isSlugId(id)) return id;
  const prefix = id.slice(0, Math.min(id.length, Math.max(REF_MIN_LENGTH, longestShared + 1)));
  return SAFE_REF_PATTERN.test(prefix) ? prefix : `${ID_REF_PREFIX}${JSON.stringify(id)}`;
}

// The ref of every id: a slug id is its own ref, else the shortest prefix unique among `ids`, at least
// REF_MIN_LENGTH characters. Sorting by UTF-16 code units puts an id's longest shared prefix beside it.
export function computeRefs(ids: readonly string[]): RefTable {
  const sorted = [...ids].sort(compareCodeUnits);
  const refs = new Map<string, string>();
  sorted.forEach((id, i) => {
    const before = i > 0 ? commonPrefixLength(id, sorted[i - 1]!) : 0;
    const after = i < sorted.length - 1 ? commonPrefixLength(id, sorted[i + 1]!) : 0;
    refs.set(id, printedRef(id, Math.max(before, after)));
  });
  return { ids, refOf: (id) => refs.get(id) ?? id };
}

function unquotedIdRef(input: string): string | null {
  if (!input.startsWith(ID_REF_PREFIX)) return input;
  try {
    const parsed: unknown = JSON.parse(input.slice(ID_REF_PREFIX.length));
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function nearestRefs(input: string, table: RefTable): string[] {
  return table.ids
    .map((id) => ({ ref: table.refOf(id), shared: commonPrefixLength(input, id) }))
    .filter((c) => c.shared > 0)
    .sort((a, b) => b.shared - a.shared || compareCodeUnits(a.ref, b.ref))
    .slice(0, REF_NEAREST_MAX)
    .map((c) => c.ref);
}

// Input to one element, or a named refusal. Case-sensitive; reads ids only, never labels. An exact id
// wins; otherwise a prefix must be unique. A printed-length prefix matching several now is `stale`.
export function resolveRef(input: string, table: RefTable): RefResolution {
  const wanted = unquotedIdRef(input);
  if (wanted === null || wanted === '') return { kind: 'not-found', input, nearest: [] };
  if (table.ids.includes(wanted)) return { kind: 'found', id: wanted };
  const candidates = [...new Set(table.ids.filter((id) => id.startsWith(wanted)))];
  if (candidates.length === 1) return { kind: 'found', id: candidates[0]! };
  if (candidates.length > 1) {
    return { kind: 'ambiguous', input, candidates, stale: wanted.length >= REF_MIN_LENGTH };
  }
  return { kind: 'not-found', input, nearest: nearestRefs(wanted, table) };
}

function slugText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cutSlug(base: string, max: number): string {
  return base.slice(0, max).replace(/-+$/, '');
}

// The id an element an agent adds takes when it names none: a slug of its label, `-2`, `-3` … on a
// clash with `takenIds`. Always satisfies `isSlugId`.
export function slugIdFor(label: string, kindWord: string, takenIds: ReadonlySet<string>): string {
  const kind = slugText(kindWord);
  const kindBase = /^[a-z]/.test(kind) ? kind : SLUG_FALLBACK_BASE;
  const text = slugText(label);
  const base = cutSlug(
    text === '' ? kindBase : /^[0-9]/.test(text) ? `${kindBase}-${text}` : text,
    SLUG_ID_MAX_LENGTH,
  );
  if (!takenIds.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${cutSlug(base, SLUG_ID_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!takenIds.has(candidate)) return candidate;
  }
}

const UNKNOWN_KIND_MARK = '?';
const BARE_KIND_NAME = /^[A-Za-z0-9_.:-]+$/;

function unknownKindWord(name: unknown, fallback: string): string {
  const text = typeof name === 'string' && name !== '' ? name : fallback;
  return `${UNKNOWN_KIND_MARK} ${BARE_KIND_NAME.test(text) ? text : JSON.stringify(text)}`;
}

// Whether the document model knows this element's type, and its shape kind for a shape.
export function isKnownElement(el: Element): boolean {
  if (!ELEMENT_TYPES.has(el.type)) return false;
  return el.type !== 'shape' || SHAPE_KINDS.has(el.shape);
}

// The first word of an element's line: an event-storming note's notation (`es:actor` for the actor
// notation, so it never reads as the actor shape), a shape's kind, else the element type. An unknown
// type or shape kind prints `? <name>`.
export function kindWordOf(el: Element): string {
  if (!ELEMENT_TYPES.has(el.type)) return unknownKindWord(el.type, 'element');
  const notation = eventStormingKindOf(el);
  if (notation) return notation === 'actor' ? 'es:actor' : notation;
  if (el.type !== 'shape') return el.type;
  return SHAPE_KINDS.has(el.shape) ? el.shape : unknownKindWord(el.shape, 'shape');
}
