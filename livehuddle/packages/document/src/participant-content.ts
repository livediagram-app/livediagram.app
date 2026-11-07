// The participant content rule (docs/specs/013-workspace/share-roles.md "What a Participant changes"; blueprint
// "Behaviour and state"; "A Participant walks"). A Participant adds, writes, moves and removes nothing: it changes an
// element only through a piece, a Door's swing and its own notes on a Notice Board. The server applies each of
// a Participant's element ops to the STORED tab through this one pure function, so a stale screen can never write
// an old copy of the board back: a permitted field lands, a forbidden field stays as stored, a forbidden add or
// remove is refused with the op that puts the sender's screen back.

import { diffToElementOps, type ElementOp, type RoomElementOp } from './element-ops';
import type { Element, Tab } from './index';
import { isValidElement } from './validate';
import { holdsNotes, mergeNoticeNotes } from './office-social';

export type ParticipantRefusal =
  | 'tab-locked'
  | 'not-addable'
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

// Whether an element was added by the Participant holding this adder key.
export function addedByAdder(el: Element, adderKey: string | null): boolean {
  return adderKey !== null && adderKey !== '' && (el as Bag).addedBy === adderKey;
}

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

// A locked element is held: a participant may not change it.
function isHeld(el: Element): boolean {
  return (el as Bag).locked === true;
}

// Copy one field from incoming onto the merge, an absent incoming value removing it.
function copyField(target: Bag, incoming: Bag, field: string): void {
  if (incoming[field] !== undefined) target[field] = incoming[field];
  else delete target[field];
}

// What a Participant's update turns an element into, whoever added it: the stored element with only a piece's field
// copied from incoming. Its own earlier sticky or text is no different: a Participant no longer edits content.
function mergePieces(stored: Element, incoming: Element, adderKey: string | null): Element {
  const inc = incoming as Bag;
  const next: Bag = { ...(stored as Bag) };
  // A Door's swing (docs/specs/009-elements/room-builder.md "Opening and closing"): a Participant opens and closes
  // any door, and changes nothing else about it.
  if (stored.type === 'shape' && stored.shape === 'door') copyField(next, inc, 'doorClosed');
  // A notice board's notes (docs/specs/009-elements/social-pieces.md "Notice Board"), and a Calendar Wall's
  // (team-pieces.md): a Participant pins notes it signs and unpins those, never anyone else's.
  if (stored.type === 'shape' && holdsNotes(stored.shape)) {
    const notes = mergeNoticeNotes(stored.noticeNotes, inc.noticeNotes, adderKey);
    if (notes) next.noticeNotes = notes;
    else delete next.noticeNotes;
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
  if (op.kind === 'add') return applyAdd(tab, op.element);
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
  // A Participant removes nothing, its own earlier stickies included.
  if (op.kind === 'remove') {
    return refuse(isHeld(stored) ? 'locked' : 'not-own', {
      kind: 'add',
      element: stored,
      at: index,
    });
  }
  const incoming = op.element;
  const restore: ElementOp = { kind: 'update', element: stored };
  if (incoming.type !== stored.type) return refuse('type-changed', restore);
  if (isHeld(stored)) return refuse('locked', restore);
  const merged = mergePieces(stored, incoming, adderKey);
  if (!isValidElement(merged)) return refuse('invalid', restore);
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

// A Participant adds nothing (docs/specs/013-workspace/share-roles.md "A Participant walks"): a refused add takes the
// element back off the sender's screen, unless the id was someone else's.
function applyAdd(tab: Tab, element: Element): ParticipantOpResult {
  const taken = tab.elements.some((e) => e.id === element.id);
  return refuse(
    taken ? 'id-taken' : 'not-addable',
    taken ? null : { kind: 'remove', id: element.id },
  );
}

// The editor's side of the rule (blueprint "Editor state"): whether a Participant's local change from `before` to
// `after` is one the server would take as it is (a piece's change: a Door's swing, its notes on a Notice Board).
// Answers the change, or null when any part of it would be refused or trimmed, so the editor never shows a change
// the room will undo.
// The tab around the elements must not change at all: a Participant never edits a tab's settings.
export function participantTabChange(before: Tab, after: Tab, adderKey: string | null): Tab | null {
  const { elements: _b, ...beforeMeta } = before;
  const { elements: _a, ...afterMeta } = after;
  if (!sameValue(beforeMeta, afterMeta)) return null;
  let tab = before;
  for (const op of diffToElementOps(before.elements, after.elements)) {
    const outcome = applyParticipantOp(tab, op, adderKey);
    if (outcome.result === 'refused') return null;
    if (op.kind === 'update') {
      // The rule took everything the change made, nothing trimmed.
      const merged = outcome.tab.elements.find((e) => e.id === op.element.id);
      if (!merged || !sameValue(merged, op.element)) return null;
    }
    tab = outcome.tab;
  }
  return after;
}
