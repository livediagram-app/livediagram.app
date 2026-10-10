// The participant content rule (docs/specs/013-workspace/share-roles.md "What a Participant changes"; blueprint
// "Behaviour and state"). A Participant changes a board's content, never its shape: it adds stickies, text, images
// and mind-map branches, writes on any element but a Behaviour, moves and recolours stickies, re-lays a mind map,
// swaps an image's picture, and removes only what it added. The server applies each of
// a Participant's element ops to the STORED tab through this one pure function, so a stale screen can never write
// an old copy of the board back: a permitted field lands, a forbidden field stays as stored, a forbidden add or
// remove is refused with the op that puts the sender's screen back.

import { isBehaviourShape } from './behaviour-shapes';
import { LIVE_ELEMENT_FIELDS } from './comments';
import { diffToElementOps, type ElementOp, type RoomElementOp } from './element-ops';
import type { Element, Tab } from './index';
import { isLayerLocked, resolveLayerId, tabLayers } from './layers';
import { isMindNode } from './mind-map';
import { isValidElement } from './validate';

// The element types a Participant may add. A `shape` only as a mind node grown from another, an `arrow` only as
// the connector between two mind nodes (`addableOn`).
export const PARTICIPANT_ADDABLE_TYPES = ['sticky', 'text', 'image', 'shape', 'arrow'] as const;
// The fields a Participant may change on an element someone else added: its words.
export const PARTICIPANT_TEXT_FIELDS = ['label', 'richText'] as const;
// What else a Participant may change on anyone's sticky: where it sits and its colour.
export const PARTICIPANT_STICKY_FIELDS = [
  'fillColor',
  'strokeColor',
  'textColor',
  'penTextColour',
] as const;
// The elements a Participant may place on anyone's behalf: move and resize, since they are the content itself. A
// text box is not one: it often labels the board's structure, so it stays where its author put it.
export const PARTICIPANT_PLACE_TYPES = ['sticky', 'image'] as const;
export const PARTICIPANT_PLACE_FIELDS = ['x', 'y', 'width', 'height'] as const;
// What a Participant may change on anyone's mind node: where it sits, so growing a map re-lays it tidily.
export const PARTICIPANT_MIND_FIELDS = ['x', 'y'] as const;
// What a Participant may change on anyone's image: the picture it shows.
export const PARTICIPANT_IMAGE_FIELDS = [
  'imageId',
  'naturalWidth',
  'naturalHeight',
  'alt',
  'credit',
] as const;

export type ParticipantRefusal =
  | 'tab-locked'
  | 'not-addable'
  | 'not-holdable'
  | 'no-adder'
  | 'id-taken'
  | 'missing'
  | 'type-changed'
  | 'locked'
  | 'not-own'
  | 'reorder'
  | 'invalid';

export type ParticipantOpResult =
  // `op` is what actually happened to the stored tab (the merge, for an update); `changed` is false when the
  // stored tab already said it, so nothing needs writing or relaying.
  | { result: 'applied'; tab: Tab; op: RoomElementOp; changed: boolean }
  // `correction` is the op that turns the sender's screen back into the stored tab; null when the stored tab has
  // nothing to restore (the element is already gone).
  | { result: 'refused'; correction: ElementOp | null; reason: ParticipantRefusal };

type Bag = Record<string, unknown>;

// Whether a Participant may write on an element someone else added. A Behaviour's words (a poll's question, a
// timer's or mode button's caption) are how the facilitator runs the session, so they stay an Editor's.
export function participantWritesOn(el: Element): boolean {
  return !(el.type === 'shape' && isBehaviourShape(el.shape));
}

export function isParticipantAddable(type: string): boolean {
  return (PARTICIPANT_ADDABLE_TYPES as readonly string[]).includes(type);
}

// Whether a Participant may move and resize this element whoever added it (PARTICIPANT_PLACE_TYPES).
export function isParticipantPlaceable(el: Element): boolean {
  return (PARTICIPANT_PLACE_TYPES as readonly string[]).includes(el.type);
}

type Endpoint = { kind: string; elementId?: string; anchor?: unknown };

function mindNodeOn(tab: Tab, id: unknown): boolean {
  return tab.elements.some((e) => e.id === id && isMindNode(e));
}

// A connector pinned at both ends to mind nodes on the tab: how a mind map's branches are drawn.
function isMindConnectorOn(tab: Tab, el: Element): boolean {
  if (el.type !== 'arrow') return false;
  const from = (el as { from: Endpoint }).from;
  const to = (el as { to: Endpoint }).to;
  return (
    from.kind === 'pinned' &&
    to.kind === 'pinned' &&
    mindNodeOn(tab, from.elementId) &&
    mindNodeOn(tab, to.elementId)
  );
}

// Whether a Participant may add this element to the tab, or hold it there as its own after a change: a sticky,
// text or image anywhere; a mind node only as a branch of one already on the tab; an arrow only between two.
export function addableOn(tab: Tab, el: Element): boolean {
  if (!isParticipantAddable(el.type)) return false;
  if (el.type === 'shape') return isMindNode(el) && mindNodeOn(tab, (el as Bag).mindParentId);
  if (el.type === 'arrow') return isMindConnectorOn(tab, el);
  return true;
}

// Whether an element was added by the Participant holding this adder key.
export function addedByAdder(el: Element, adderKey: string | null): boolean {
  return adderKey !== null && adderKey !== '' && (el as Bag).addedBy === adderKey;
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

// A table's cells may change words, never shape: same row count, every row the same length.
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

// Live fields (answers, threads, rounds) travel as deltas, never through an update: always the stored copy's.
function keepLiveFields(target: Bag, stored: Bag): void {
  for (const field of LIVE_ELEMENT_FIELDS) {
    if (field in stored) target[field] = stored[field];
    else delete target[field];
  }
}

// What a Participant's update turns another person's element into: the stored element with the permitted fields
// copied from incoming.
function mergeOthers(tab: Tab, stored: Element, incoming: Element): Element {
  const s = stored as Bag;
  const inc = incoming as Bag;
  const next: Bag = { ...s };
  if (participantWritesOn(stored)) {
    for (const field of PARTICIPANT_TEXT_FIELDS) {
      if (field in s || field in inc) copyField(next, inc, field);
    }
  }
  if (stored.type === 'table' && sameCellShape(s.cells, inc.cells)) next.cells = inc.cells;
  // A text box that sizes to its text (`sizing` set) follows its words: writing on it resizes it.
  if (stored.type === 'text' && s.sizing !== undefined) {
    for (const field of ['width', 'height'] as const) {
      if (isPositive(inc[field])) next[field] = inc[field];
    }
  }
  if (isParticipantPlaceable(stored)) {
    // A malformed place or size keeps the stored one.
    for (const field of PARTICIPANT_PLACE_FIELDS) {
      const v = inc[field];
      const ok = field === 'x' || field === 'y' ? Number.isFinite(v) : isPositive(v);
      if (ok && typeof v === 'number') next[field] = v;
    }
  }
  if (stored.type === 'sticky') {
    for (const field of PARTICIPANT_STICKY_FIELDS) copyField(next, inc, field);
  }
  if (isMindNode(stored)) {
    for (const field of PARTICIPANT_MIND_FIELDS) {
      if (typeof inc[field] === 'number' && Number.isFinite(inc[field])) next[field] = inc[field];
    }
  }
  if (stored.type === 'image') {
    for (const field of PARTICIPANT_IMAGE_FIELDS) copyField(next, inc, field);
  }
  // A re-laid map turns its connectors to face the way it now grows: the faces move, never the ends.
  if (isMindConnectorOn(tab, stored)) {
    for (const end of ['from', 'to'] as const) {
      const was = s[end] as Endpoint;
      const now = inc[end] as Endpoint | undefined;
      if (now?.kind === 'pinned' && now.elementId === was.elementId) {
        next[end] = { ...was, anchor: now.anchor };
      }
    }
  }
  return next as Element;
}

// What a Participant's update turns its own element into: everything it sent, with identity, adder, lock and live
// fields kept from stored (a Participant cannot lock what it added, any more than it can add it locked).
function mergeOwn(stored: Element, incoming: Element): Element {
  const next: Bag = { ...(incoming as Bag) };
  next.id = stored.id;
  next.type = stored.type;
  next.addedBy = (stored as Bag).addedBy;
  copyField(next, stored as Bag, 'locked');
  keepLiveFields(next, stored as Bag);
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

function withElements(tab: Tab, elements: Element[]): Tab {
  return { ...tab, elements };
}

function refuse(reason: ParticipantRefusal, correction: ElementOp | null): ParticipantOpResult {
  return { result: 'refused', correction, reason };
}

export function applyParticipantOp(
  tab: Tab,
  op: ElementOp,
  adderKey: string | null,
): ParticipantOpResult {
  const elements = tab.elements;
  if (op.kind === 'reorder') {
    return refuse('reorder', { kind: 'reorder', ids: elements.map((e) => e.id) });
  }
  if (op.kind === 'add') return applyAdd(tab, op.element, op.at, adderKey);
  const id = op.kind === 'remove' ? op.id : op.element.id;
  const index = elements.findIndex((e) => e.id === id);
  if (index < 0) return refuse('missing', null);
  const stored = elements[index]!;
  if (tab.locked === true) {
    return refuse(
      'tab-locked',
      op.kind === 'remove'
        ? { kind: 'add', element: stored, at: index }
        : { kind: 'update', element: stored },
    );
  }
  if (op.kind === 'remove') {
    if (isHeld(tab, stored)) return refuse('locked', { kind: 'add', element: stored, at: index });
    if (!addedByAdder(stored, adderKey))
      return refuse('not-own', { kind: 'add', element: stored, at: index });
    return {
      result: 'applied',
      tab: withElements(
        tab,
        elements.filter((_, i) => i !== index),
      ),
      op,
      changed: true,
    };
  }
  const incoming = op.element;
  const restore: ElementOp = { kind: 'update', element: stored };
  if (incoming.type !== stored.type) return refuse('type-changed', restore);
  if (isHeld(tab, stored)) return refuse('locked', restore);
  const own = addedByAdder(stored, adderKey);
  const merged = own ? mergeOwn(stored, incoming) : mergeOthers(tab, stored, incoming);
  if (!isValidElement(merged)) return refuse('invalid', restore);
  // What it added stays something it could add: its connector keeps joining two mind nodes, its node stays one.
  if (own && !addableOn(tab, merged)) return refuse('not-holdable', restore);
  // Its own element moved onto a locked layer would be one it could never touch again.
  if (isHeld(tab, merged)) return refuse('locked', restore);
  const changed = !sameValue(merged, stored);
  // Peers get only the fields that changed, never the stored copy whole: theirs may hold an Editor's change the
  // saved tab has not caught up with yet.
  return {
    result: 'applied',
    tab: changed
      ? withElements(
          tab,
          elements.map((e, i) => (i === index ? merged : e)),
        )
      : tab,
    op: patchBetween(stored, merged),
    changed,
  };
}

function applyAdd(
  tab: Tab,
  element: Element,
  at: number,
  adderKey: string | null,
): ParticipantOpResult {
  const elements = tab.elements;
  const taken = elements.some((e) => e.id === element.id);
  // A refused add takes the element back off the sender's screen, unless the id was someone else's.
  const undo: ElementOp | null = taken ? null : { kind: 'remove', id: element.id };
  if (taken) return refuse('id-taken', undo);
  if (tab.locked === true) return refuse('tab-locked', undo);
  if (!addableOn(tab, element)) return refuse('not-addable', undo);
  if (adderKey === null || adderKey === '') return refuse('no-adder', undo);
  const stamped: Bag = { ...(element as Bag), addedBy: adderKey };
  // A new element carries no answers or threads of its own yet, and a Participant cannot lock what it adds.
  for (const field of LIVE_ELEMENT_FIELDS) delete stamped[field];
  delete stamped.locked;
  const added = stamped as Element;
  if (isHeld(tab, added)) return refuse('locked', undo);
  if (!isValidElement(added)) return refuse('invalid', undo);
  const index = Number.isInteger(at) ? Math.max(0, Math.min(at, elements.length)) : elements.length;
  return {
    result: 'applied',
    tab: withElements(tab, [...elements.slice(0, index), added, ...elements.slice(index)]),
    op: { kind: 'add', element: added, at: index },
    changed: true,
  };
}

// The editor's side of the rule (blueprint "Editor state"): whether a Participant's local change from `before` to
// `after` is one the server would take as it is. Answers the change with the adder stamped on what it adds, or
// null when any part of it would be refused or trimmed, so the editor never shows a change the room will undo.
// The tab around the elements must not change at all: a Participant never edits a tab's settings.
export function participantTabChange(before: Tab, after: Tab, adderKey: string | null): Tab | null {
  const { elements: _b, ...beforeMeta } = before;
  const { elements: _a, ...afterMeta } = after;
  if (!sameValue(beforeMeta, afterMeta)) return null;
  let tab = before;
  let elements = after.elements;
  for (const op of diffToElementOps(before.elements, after.elements)) {
    const outcome = applyParticipantOp(tab, op, adderKey);
    if (outcome.result === 'refused') return null;
    if (op.kind === 'add') {
      // The stamp is the only difference the rule may make to an add.
      const stamped = (outcome.op as { element: Element }).element;
      if (!sameValue({ ...(op.element as Bag), addedBy: adderKey }, stamped)) return null;
      elements = elements.map((e) => (e.id === stamped.id ? stamped : e));
    } else if (op.kind === 'update') {
      // The rule took everything the change made, nothing trimmed.
      const merged = outcome.tab.elements.find((e) => e.id === op.element.id);
      if (!merged || !sameValue(merged, op.element)) return null;
    }
    tab = outcome.tab;
  }
  return elements === after.elements ? after : { ...after, elements };
}
