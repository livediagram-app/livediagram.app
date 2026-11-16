// A suggestion on a canvas (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md): one person's proposed
// change to one tab's elements, kept beside the canvas until an Editor accepts it (it becomes the canvas, as one
// changeset) or rejects it (it goes). Generic over a product's element union: every product binds `E` to its own
// `Element`. Read defensively: whatever is stored or sent is parsed and bounded here.

/** The least an element needs here: an id, and a type a change never alters. */
export type SuggestionElement = { id: string; type: string };

/** One proposed change to one element: put in (at its z-order place), changed (whole, by id) or taken out. */
export type SuggestionOp<E extends SuggestionElement = SuggestionElement> =
  | { kind: 'add'; element: E; at: number }
  | { kind: 'update'; element: E }
  | { kind: 'remove'; id: string };

/** Who made a suggestion: the person's collab key, and the name and colour their cursor shows. */
export type SuggestionAuthor = { key: string; name: string; color: string };

export type CanvasSuggestion<E extends SuggestionElement = SuggestionElement> = {
  // `sg_` and 10 base32 characters, minted by the api.
  id: string;
  tabId: string;
  author: SuggestionAuthor;
  // Epoch ms.
  createdAt: number;
  ops: SuggestionOp<E>[];
  // Each element the ops target, as the suggestion found it: its fingerprint, or null when it was not there (an
  // add). Accepting compares the canvas against these, so a stale suggestion is never applied silently.
  base: Record<string, string | null>;
  // The elements found changed since, at the last Accept that refused it: the suggestion is flagged, not applied.
  conflict?: string[];
};

// Limits (blueprint "Constants and configuration").
// One gesture's change: a paste of a large selection fits; a runaway loop does not.
export const SUGGESTION_MAX_OPS = 200;
// Suggestions waiting on one tab: a busy review fits; a flood is refused.
export const SUGGESTIONS_MAX_PER_TAB = 100;
// One suggestion as stored (its ops are whole elements): under the room's 256 KiB frame cap.
export const SUGGESTION_MAX_BYTES = 192 * 1024;
// An author's name and an id, as the room and the index mint them.
export const SUGGESTION_MAX_NAME = 80;
export const SUGGESTION_MAX_KEY = 64;
// How long the editor gathers one gesture's changes (a drag landing, a burst of nudges) into one suggestion.
export const SUGGEST_GATHER_MS = 500;

const ID_PATTERN = /^sg_[a-z2-7]{10}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;
const FALLBACK_COLOR = '#0ea5e9';

/** A suggestion id: `sg_` and 10 base32 characters. */
export function mintSuggestionId(random: (n: number) => Uint8Array = randomBytes): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const bytes = random(10);
  let out = 'sg_';
  for (let i = 0; i < 10; i += 1) out += alphabet[bytes[i]! % 32];
  return out;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export const isSuggestionId = (v: unknown): v is string =>
  typeof v === 'string' && ID_PATTERN.test(v);

const isKey = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= SUGGESTION_MAX_KEY;

/** An author read defensively: a missing or bad colour reads as the fallback, a name is trimmed and cut. */
export function parseAuthor(v: unknown): SuggestionAuthor | null {
  const a = v as Record<string, unknown> | null;
  if (!a || typeof a !== 'object' || !isKey(a.key)) return null;
  const name = typeof a.name === 'string' ? a.name.trim().slice(0, SUGGESTION_MAX_NAME) : '';
  const color =
    typeof a.color === 'string' && COLOR_PATTERN.test(a.color) ? a.color : FALLBACK_COLOR;
  return { key: a.key, name, color };
}

/** Why a sent change is refused, by name (blueprint "Interfaces and contracts"). */
export type OpsRefusal = 'no_ops' | 'too_many_ops' | 'bad_op' | 'bad_element' | 'repeated_target';

/**
 * The ops of a sent suggestion, parsed: each an add, an update or a removal, the elements checked by the product's
 * own validator (`parseElement`), each element targeted at most once. A refusal names what was wrong.
 */
export function parseSuggestionOps<E extends SuggestionElement>(
  raw: unknown,
  parseElement: (v: unknown) => E | null,
): { ok: true; ops: SuggestionOp<E>[] } | { ok: false; refusal: OpsRefusal } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, refusal: 'no_ops' };
  if (raw.length > SUGGESTION_MAX_OPS) return { ok: false, refusal: 'too_many_ops' };
  const ops: SuggestionOp<E>[] = [];
  const seen = new Set<string>();
  for (const item of raw as unknown[]) {
    const op = item as Record<string, unknown> | null;
    if (!op || typeof op !== 'object') return { ok: false, refusal: 'bad_op' };
    let parsed: SuggestionOp<E>;
    if (op.kind === 'remove') {
      if (!isKey(op.id)) return { ok: false, refusal: 'bad_op' };
      parsed = { kind: 'remove', id: op.id };
    } else if (op.kind === 'add' || op.kind === 'update') {
      const element = parseElement(op.element);
      if (!element) return { ok: false, refusal: 'bad_element' };
      if (op.kind === 'add') {
        const at = typeof op.at === 'number' && Number.isInteger(op.at) && op.at >= 0 ? op.at : 0;
        parsed = { kind: 'add', element, at };
      } else parsed = { kind: 'update', element };
    } else return { ok: false, refusal: 'bad_op' };
    const target = targetOf(parsed);
    if (seen.has(target)) return { ok: false, refusal: 'repeated_target' };
    seen.add(target);
    ops.push(parsed);
  }
  return { ok: true, ops };
}

/** The element an op targets. */
export const targetOf = (op: SuggestionOp<SuggestionElement>): string =>
  op.kind === 'remove' ? op.id : op.element.id;

/** A stored suggestion (JSON text), read defensively; null when it is not one. Its elements are trusted as stored:
 *  they were checked by the product's validator when the suggestion was made. */
export function parseStoredSuggestion<E extends SuggestionElement>(
  text: string,
): CanvasSuggestion<E> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const s = raw as Record<string, unknown> | null;
  if (!s || typeof s !== 'object' || !isSuggestionId(s.id) || !isKey(s.tabId)) return null;
  const author = parseAuthor(s.author);
  const ops = parseSuggestionOps<E>(s.ops, (v) =>
    v && typeof v === 'object' && isKey((v as E).id) && typeof (v as E).type === 'string'
      ? (v as E)
      : null,
  );
  if (!author || !ops.ok) return null;
  const base: Record<string, string | null> = {};
  const rawBase = (s.base && typeof s.base === 'object' ? s.base : {}) as Record<string, unknown>;
  for (const op of ops.ops) {
    const id = targetOf(op);
    const fp = rawBase[id];
    base[id] = typeof fp === 'string' ? fp : null;
  }
  const conflict = Array.isArray(s.conflict)
    ? (s.conflict as unknown[]).filter(isKey).slice(0, SUGGESTION_MAX_OPS)
    : [];
  return {
    id: s.id,
    tabId: s.tabId,
    author,
    createdAt: typeof s.createdAt === 'number' && Number.isFinite(s.createdAt) ? s.createdAt : 0,
    ops: ops.ops,
    base,
    ...(conflict.length > 0 ? { conflict } : {}),
  };
}

/** The ids a review request names: `{ ids: [...] }`, or `{ all: true }` for every suggestion on the tab. */
export function parseDecision(v: unknown): { all: true } | { ids: string[] } | null {
  const d = v as Record<string, unknown> | null;
  if (!d || typeof d !== 'object') return null;
  if (d.all === true) return { all: true };
  if (!Array.isArray(d.ids)) return null;
  const ids = [...new Set((d.ids as unknown[]).filter(isSuggestionId))].slice(
    0,
    SUGGESTIONS_MAX_PER_TAB,
  );
  return ids.length > 0 ? { ids } : null;
}
