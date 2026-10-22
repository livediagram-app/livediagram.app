// The participant content rule (docs/specs/013-workspace/share-roles.md "What a Participant changes"; blueprint
// "Behaviour and state"). A Participant edits text only: it changes the words of elements already on the tab, and
// nothing else about them. It never adds, removes, moves, resizes, restyles, locks or reorders an element. The
// server applies each of a Participant's element ops to the STORED tab through this one pure function, so a stale
// screen can never write an old copy of the tab back: a text field lands, every other field stays as stored, and an
// add, a remove or a reorder is refused with the op that puts the sender's screen back.

import { diffToElementOps, type ElementOp, type RoomElementOp } from './element-ops';
import type { Element, Tab } from './index';
import { isLayerLocked, resolveLayerId, tabLayers } from './layers';
import { participantArticlesChange } from './participant-article';
import { isValidElement } from './validate';

type TextFieldsByKind = {
  readonly [K in Element['type']]?: readonly (keyof Extract<Element, { type: K }> & string)[];
};

// The fields a Participant may change, by element kind: its words. An allow-list, so a field or a kind nobody
// listed here is refused: a new field is an Editor's until someone decides it is text. A table's `cells` change
// words only (its rows and columns stay as stored, see sameCellShape).
export const PARTICIPANT_TEXT_FIELDS = {
  shape: ['label', 'richText', 'code', 'pageTitle', 'pageSubtitle'],
  text: ['label', 'richText'],
  sticky: ['label', 'richText'],
  table: ['label', 'cells'],
  image: ['label', 'alt'],
  freehand: ['label'],
  'link-card': ['label'],
  video: ['label'],
  arrow: ['label'],
} as const satisfies TextFieldsByKind;

export type ParticipantRefusal =
  | 'tab-locked'
  | 'not-addable'
  | 'not-removable'
  | 'missing'
  | 'type-changed'
  | 'locked'
  | 'reorder'
  | 'invalid';

export type ParticipantOpResult =
  // `op` is what actually happened to the stored tab (the fields it changed, as a patch); `changed` is false when
  // the stored tab already said it, so nothing needs writing or relaying.
  | { result: 'applied'; tab: Tab; op: RoomElementOp; changed: boolean }
  // `correction` is the op that turns the sender's screen back into the stored tab; null when the stored tab has
  // nothing to restore (the element is already gone, or the id was someone else's).
  | { result: 'refused'; correction: ElementOp | null; reason: ParticipantRefusal };

type Bag = Record<string, unknown>;

/** The text fields a Participant may change on an element of this kind; none for a kind not listed. */
export function participantTextFields(type: string): readonly string[] {
  return (PARTICIPANT_TEXT_FIELDS as Record<string, readonly string[] | undefined>)[type] ?? [];
}

const isPositive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

// An element on a locked layer behaves as if it were locked itself (docs/specs/006-document/layers.md).
function isHeld(tab: Tab, el: Element): boolean {
  if ((el as Bag).locked === true) return true;
  const layers = tabLayers(tab.layers);
  const layer = layers.find((l) => l.id === resolveLayerId(el.layerId, layers));
  return layer !== undefined && isLayerLocked(layer);
}

// A table's cells may change words, never shape: same row count, every row the same length, every cell a string.
function sameCellShape(stored: unknown, incoming: unknown): boolean {
  if (!Array.isArray(stored) || !Array.isArray(incoming)) return false;
  if (stored.length !== incoming.length) return false;
  return stored.every(
    (row, i) =>
      Array.isArray(row) &&
      Array.isArray(incoming[i]) &&
      (incoming[i] as unknown[]).length === row.length &&
      (incoming[i] as unknown[]).every((cell) => typeof cell === 'string'),
  );
}

// Copy one field from incoming onto the merge, an absent incoming value removing it.
function copyField(target: Bag, incoming: Bag, field: string): void {
  if (incoming[field] !== undefined) target[field] = incoming[field];
  else delete target[field];
}

// What a Participant's update turns an element into: the stored element with its text fields copied from incoming.
function mergeText(stored: Element, incoming: Element): Element {
  const s = stored as Bag;
  const inc = incoming as Bag;
  const next: Bag = { ...s };
  for (const field of participantTextFields(stored.type)) {
    if (field === 'cells') {
      if (sameCellShape(s.cells, inc.cells)) next.cells = inc.cells;
      continue;
    }
    if (field in s || field in inc) copyField(next, inc, field);
  }
  // A text box that sizes to its words (`sizing` set) follows them: writing on it resizes it. Its size is the
  // words', never a choice, so this is still writing.
  if (stored.type === 'text' && s.sizing !== undefined) {
    for (const field of ['width', 'height'] as const) {
      if (isPositive(inc[field])) next[field] = inc[field];
    }
  }
  return next as Element;
}

// The fields that turn `from` into `to`, as a patch: what peers apply over their own live copy.
function patchBetween(from: Element, to: Element): RoomElementOp {
  const a = from as Bag;
  const b = to as Bag;
  const set: Bag = {};
  const clear: string[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'id' || key === 'type') continue;
    if (!(key in b) || b[key] === undefined) {
      if (key in a && a[key] !== undefined) clear.push(key);
    } else if (!sameValue(a[key], b[key])) set[key] = b[key];
  }
  return { kind: 'patch', id: to.id, set, ...(clear.length ? { clear } : {}) };
}

function refuse(reason: ParticipantRefusal, correction: ElementOp | null): ParticipantOpResult {
  return { result: 'refused', correction, reason };
}

export function applyParticipantOp(tab: Tab, op: ElementOp): ParticipantOpResult {
  const elements = tab.elements;
  if (op.kind === 'reorder') {
    return refuse('reorder', { kind: 'reorder', ids: elements.map((e) => e.id) });
  }
  if (op.kind === 'add') {
    // Taken back off the sender's screen, unless the id was already someone else's.
    const taken = elements.some((e) => e.id === op.element.id);
    return refuse('not-addable', taken ? null : { kind: 'remove', id: op.element.id });
  }
  const id = op.kind === 'remove' ? op.id : op.element.id;
  const index = elements.findIndex((e) => e.id === id);
  if (index < 0) return refuse('missing', null);
  const stored = elements[index]!;
  if (op.kind === 'remove')
    return refuse('not-removable', { kind: 'add', element: stored, at: index });
  const incoming = op.element;
  const restore: ElementOp = { kind: 'update', element: stored };
  if (tab.locked === true) return refuse('tab-locked', restore);
  if (incoming.type !== stored.type) return refuse('type-changed', restore);
  if (isHeld(tab, stored)) return refuse('locked', restore);
  const merged = mergeText(stored, incoming);
  if (!isValidElement(merged)) return refuse('invalid', restore);
  const changed = !sameValue(merged, stored);
  // Peers get only the fields that changed, never the stored copy whole: theirs may hold an Editor's change the
  // saved tab has not caught up with yet.
  return {
    result: 'applied',
    tab: changed ? { ...tab, elements: elements.map((e, i) => (i === index ? merged : e)) } : tab,
    op: patchBetween(stored, merged),
    changed,
  };
}

// The editor's side of the rule (blueprint "Editor state"): whether a Participant's local change from `before` to
// `after` is one the server would take as it is. Answers `after`, or null when any part of it would be refused or
// trimmed, so the editor never shows a change the room will undo. Around the elements, only the tab's articles may
// change, and only as writing (participant-article.ts): a Participant never edits a tab's settings or pages.
export function participantTabChange(before: Tab, after: Tab): Tab | null {
  const { elements: _b, articles: beforeArticles, ...beforeMeta } = before;
  const { elements: _a, articles: afterArticles, ...afterMeta } = after;
  if (!sameValue(beforeMeta, afterMeta)) return null;
  let tab = before;
  for (const op of diffToElementOps(before.elements, after.elements)) {
    const outcome = applyParticipantOp(tab, op);
    if (outcome.result === 'refused') return null;
    // The rule took everything the change made, nothing trimmed.
    if (op.kind === 'update') {
      const merged = outcome.tab.elements.find((e) => e.id === op.element.id);
      if (!merged || !sameValue(merged, op.element)) return null;
    }
    tab = outcome.tab;
  }
  if (beforeArticles !== afterArticles && !participantArticlesChange(before, after)) return null;
  return after;
}
