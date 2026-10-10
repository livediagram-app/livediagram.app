// Per-element deltas (docs/specs/012-collaboration/collab-race-hardening.md): the fields that many participants write AT
// ONCE travel as the change, not the state.
//
// An element change otherwise leaves a browser as an `el` `update` op that
// replaces the whole element on every receiver (docs/specs/012-collaboration/realtime-conflict-resolution.md). That is fine for an
// author editing a shape, which the selection lock makes a one-writer affair,
// and wrong for a done check the whole room presses in the same second: each
// receiver took the other's copy, and one mark vanished. It is the dot-vote's
// bug (docs/specs/012-collaboration/session-tools.md) on element fields, fixed the same way. A delta names one
// person's answer, one idea, one tick or one comment, so concurrent deltas
// commute and every peer lands on the same element.
//
// Three pieces, all pure:
//   - `applyElementDelta`: the one place a delta changes an element, run by
//     the sender and by every receiver, so they cannot disagree.
//   - `mergeIncomingElement`: a whole-element update keeps the receiver's copy
//     of these fields, because every change to them arrived as a delta. Only a
//     new round (a clear) replaces them.
//   - `elementChangeIsDeltaOnly`: the sender skips the whole-element update
//     when nothing else changed, since the delta already said it.
//
// A LEAF module: runtime imports come only from other leaves, for the same
// module-cycle reason as responses.ts.

import type { Element, ShapeElement } from './index';
import type { Comment, CommentThread } from './comments';
import { threadResolved, threadWithComment, threadWithoutComment } from './comment-thread';
import type { ChecklistItem } from './data-shapes';
import {
  RESPONSES_MAX,
  RESPONSE_VALUE_MAX,
  clearResponse,
  setResponse,
  type ParticipantResponse,
} from './responses';
import { IDEA_MAX_CARDS, IDEA_MAX_TEXT, alignedIdeaCardIds, isIdeaCardId } from './collab-shapes';
import { MENTIONS_MAX } from './comment-mentions';
import { applyPlanBoardPatch, type PlanBoardPatch } from './plan-board-patch';

// Bound on the round id, which is otherwise opaque.
export const COLLAB_ROUND_MAX = 64;
// Bounds on a comment arriving in a delta. Generous: the editor's own limits
// are tighter, this only stops a hand-crafted frame from bloating a peer.
const COMMENT_MAX_TEXT = 5000;
const COMMENTS_MAX = 500;

export type ElementDelta =
  // Cast (value) or withdraw (null) ONE participant's answer (docs/specs/012-collaboration/participant-responses.md).
  | {
      kind: 'response';
      participantId: string;
      value: string | null;
      at: number;
      round?: string;
    }
  // Drop one anonymous idea into the box (docs/specs/012-collaboration/idea-box.md). No author, still: `id`
  // is the card's own random id, which lets its poster take it back after losing the race for the last card.
  | { kind: 'idea'; text: string; round?: string; id?: string }
  // Tick or untick one checklist row (docs/specs/009-elements/checklist.md). Rows have no ids, so the row
  // is named by its index AND its text: a peer who reordered or retitled the
  // rows meanwhile gets the row with that text, or nothing.
  | { kind: 'check'; index: number; text: string; done: boolean }
  // Comment threads (docs/specs/008-canvas/canvas-and-palette.md): append, delete, the server's id replacing the
  // local one, and resolve / unresolve.
  | { kind: 'comment-add'; comment: Comment }
  | { kind: 'comment-remove'; commentId: string }
  | { kind: 'comment-rekey'; from: string; to: string }
  | { kind: 'comment-resolve'; resolved: boolean }
  // A Plan board's set-up change, as only what changed (docs/specs/012-collaboration/collab-race-hardening.md,
  // phase 6): column cogs and the Board flyout edit it without selecting the board, so two people set one
  // board up at once.
  | { kind: 'board'; patch: PlanBoardPatch };

function sameRound(el: ShapeElement, round: string | undefined): boolean {
  return (el.collabRound ?? undefined) === (round ?? undefined);
}

export function isComment(value: unknown): value is Comment {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.text === 'string' &&
    c.text.length <= COMMENT_MAX_TEXT &&
    typeof c.createdAt === 'number' &&
    typeof c.authorName === 'string' &&
    typeof c.authorColor === 'string' &&
    // Mentions (docs/specs/012-collaboration/comment-mentions.md), when present, are a bounded list; their
    // fields are cleaned server-side (sanitizeMentions) before they persist.
    (c.mentions === undefined || (Array.isArray(c.mentions) && c.mentions.length <= MENTIONS_MAX))
  );
}

function withThread(el: Element, thread: CommentThread | undefined): Element {
  const { commentThread: _drop, ...rest } = el as Element & { commentThread?: CommentThread };
  return (thread ? { ...rest, commentThread: thread } : rest) as Element;
}

// Apply one delta. Returns the SAME element when nothing changes (a delta for
// another round, a withdraw of an answer that isn't there, a malformed frame),
// so callers keep identity and the autosave sees no phantom change. Validated
// here because a delta is the one element write that skips `validate.ts`.
export function applyElementDelta(el: Element, delta: ElementDelta): Element {
  switch (delta.kind) {
    case 'response': {
      if (el.type !== 'shape' || !sameRound(el, delta.round)) return el;
      if (typeof delta.participantId !== 'string') return el;
      if (delta.value === null) {
        const had = (el.responses ?? []).some((r) => r.participantId === delta.participantId);
        return had ? { ...el, responses: clearResponse(el.responses, delta.participantId) } : el;
      }
      if (typeof delta.value !== 'string' || delta.value.length > RESPONSE_VALUE_MAX) return el;
      if (typeof delta.at !== 'number' || !Number.isFinite(delta.at)) return el;
      const current = el.responses ?? [];
      const mine = current.find((r) => r.participantId === delta.participantId);
      if (mine && mine.value === delta.value) return el;
      if (!mine && current.length >= RESPONSES_MAX) return el;
      return {
        ...el,
        responses: setResponse(current, delta.participantId, delta.value, delta.at),
      };
    }
    case 'idea': {
      if (el.type !== 'shape' || !sameRound(el, delta.round)) return el;
      if (typeof delta.text !== 'string') return el;
      const text = delta.text.trim();
      if (!text || text.length > IDEA_MAX_TEXT) return el;
      const cards = el.ideaCards ?? [];
      const id = isIdeaCardId(delta.id) ? delta.id : null;
      // A card this box already holds (a replay of its delta) is a no-op.
      if (id && el.ideaCardIds?.includes(id)) return el;
      if (cards.length >= IDEA_MAX_CARDS) return el;
      if (!id && !el.ideaCardIds) return { ...el, ideaCards: [...cards, text] };
      return {
        ...el,
        ideaCards: [...cards, text],
        ideaCardIds: [...alignedIdeaCardIds(el), id ?? ''],
      };
    }
    case 'check': {
      if (el.type !== 'shape' || !el.checklistItems) return el;
      const items = el.checklistItems;
      const at =
        items[delta.index]?.text === delta.text
          ? delta.index
          : items.findIndex((item) => item.text === delta.text);
      if (at === -1 || items[at]!.done === delta.done) return el;
      return {
        ...el,
        checklistItems: items.map((item, i) => (i === at ? { ...item, done: delta.done } : item)),
      };
    }
    case 'comment-add': {
      if (!isComment(delta.comment)) return el;
      const thread = (el as { commentThread?: CommentThread }).commentThread;
      const next = threadWithComment(thread, delta.comment, COMMENTS_MAX);
      return next === thread ? el : withThread(el, next);
    }
    case 'comment-remove': {
      const thread = (el as { commentThread?: CommentThread }).commentThread;
      const next = threadWithoutComment(thread, delta.commentId);
      return next === thread ? el : withThread(el, next);
    }
    case 'comment-rekey': {
      const thread = (el as { commentThread?: CommentThread }).commentThread;
      if (!thread || typeof delta.to !== 'string') return el;
      if (!thread.comments.some((c) => c.id === delta.from)) return el;
      // The server's copy under the new id may have arrived first (the api
      // relays a view-role comment to the room, docs/specs/012-collaboration/collab-race-hardening.md): then the local copy
      // is the duplicate, and goes. The relayed copy carries no author id
      // (that is the author's credential), so ours lends it one: it is how the
      // author keeps their own delete button.
      const local = thread.comments.find((c) => c.id === delta.from)!;
      if (thread.comments.some((c) => c.id === delta.to)) {
        return withThread(el, {
          ...thread,
          comments: thread.comments
            .filter((c) => c.id !== delta.from)
            .map((c) =>
              c.id === delta.to && !c.authorId && local.authorId
                ? { ...c, authorId: local.authorId }
                : c,
            ),
        });
      }
      return withThread(el, {
        ...thread,
        comments: thread.comments.map((c) => (c.id === delta.from ? { ...c, id: delta.to } : c)),
      });
    }
    case 'comment-resolve': {
      const thread = (el as { commentThread?: CommentThread }).commentThread;
      const next = threadResolved(thread, delta.resolved);
      return next === thread ? el : withThread(el, next);
    }
    case 'board': {
      if (el.type !== 'shape' || !el.planBoard) return el;
      const planBoard = applyPlanBoardPatch(el.planBoard, delta.patch);
      return planBoard === el.planBoard ? el : { ...el, planBoard };
    }
    default:
      return el;
  }
}

// The box without the card of this id (both lists), or the same element when it holds no such card.
export function withoutIdeaCard(el: Element, id: string): Element {
  if (el.type !== 'shape' || !id || !el.ideaCardIds) return el;
  const ids = alignedIdeaCardIds(el);
  const at = ids.indexOf(id);
  if (at === -1) return el;
  return {
    ...el,
    ideaCards: (el.ideaCards ?? []).filter((_, i) => i !== at),
    ideaCardIds: ids.filter((_, i) => i !== at),
  };
}

// A peer's delta, applied by a browser that may have its own idea posts to this box still waiting for the
// room's answer (docs/specs/012-collaboration/idea-box.md "Racing for the last card"). A peer's card that
// reaches a FULL box while one of `pending` (this browser's own unanswered card ids, oldest first) is in it was
// numbered by the room before that post: so the newest such card comes out and the peer's goes in, and the box
// ends as every other copy has it. Anything else applies as `applyElementDelta` does, `yielded` null.
export function yieldIdeaToPeer(
  el: Element,
  delta: ElementDelta,
  pending: readonly string[],
): { el: Element; yielded: string | null } {
  const plain = { el: applyElementDelta(el, delta), yielded: null };
  if (delta.kind !== 'idea' || el.type !== 'shape' || pending.length === 0) return plain;
  if (!sameRound(el, delta.round) || typeof delta.text !== 'string') return plain;
  const text = delta.text.trim();
  if (!text || text.length > IDEA_MAX_TEXT) return plain;
  if ((el.ideaCards ?? []).length < IDEA_MAX_CARDS) return plain;
  if (isIdeaCardId(delta.id) && el.ideaCardIds?.includes(delta.id)) return plain;
  const ids = el.ideaCardIds ?? [];
  const yielded = [...pending].reverse().find((id) => ids.includes(id));
  if (!yielded) return plain;
  return { el: applyElementDelta(withoutIdeaCard(el, yielded), delta), yielded };
}

// Carry our `done` flags onto an incoming list of checklist rows, matched by
// position and text the same way a `check` delta finds its row. Rows the peer
// added, removed or retitled come from them; ticks come from us, because every
// tick arrived as a delta.
export function keepLocalTicks(local: ChecklistItem[], incoming: ChecklistItem[]): ChecklistItem[] {
  let changed = false;
  const next = incoming.map((item, i) => {
    const mine = local[i]?.text === item.text ? local[i] : local.find((l) => l.text === item.text);
    if (!mine || mine.done === item.done) return item;
    changed = true;
    return { ...item, done: mine.done };
  });
  return changed ? next : incoming;
}

// A peer's whole-element copy (an `el` update, or an element inside a whole
// `tab` op), folded into ours. Everything the peer changed is taken, EXCEPT the
// delta-carried fields: those reached us one delta at a time and ours is
// already the merged copy, where theirs is a snapshot from their last save that
// can be missing somebody's answer. A different round means the peer cleared
// or reset, and then their (empty) answers and ideas are the new truth. A Plan
// board's set-up is ours too (phase 6), except from a writer that sends no
// deltas, an agent's changeset (`keepBoard: false`).
export function mergeIncomingElement(
  local: Element,
  incoming: Element,
  opts: { keepBoard?: boolean } = {},
): Element {
  if (local.type !== incoming.type) return incoming;
  let next = incoming;
  const localThread = (local as { commentThread?: CommentThread }).commentThread;
  const incomingThread = (incoming as { commentThread?: CommentThread }).commentThread;
  if (localThread !== incomingThread) next = withThread(next, localThread);
  if (local.type === 'shape' && next.type === 'shape') {
    const shape: ShapeElement = next;
    let patched = shape;
    if ((local.collabRound ?? undefined) === (shape.collabRound ?? undefined)) {
      patched = keepField(patched, 'responses', local.responses);
      patched = keepField(patched, 'ideaCards', local.ideaCards);
      patched = keepField(patched, 'ideaCardIds', local.ideaCardIds);
    }
    if (local.checklistItems && shape.checklistItems) {
      const items = keepLocalTicks(local.checklistItems, shape.checklistItems);
      if (items !== shape.checklistItems) patched = { ...patched, checklistItems: items };
    }
    if (
      opts.keepBoard !== false &&
      local.planBoard &&
      shape.planBoard &&
      local.planBoard !== shape.planBoard
    ) {
      patched = { ...patched, planBoard: local.planBoard };
    }
    next = patched;
  }
  return next;
}

function keepField<K extends 'responses' | 'ideaCards' | 'ideaCardIds'>(
  el: ShapeElement,
  key: K,
  value: ShapeElement[K],
): ShapeElement {
  if (el[key] === value) return el;
  const { [key]: _drop, ...rest } = el;
  return (value === undefined ? rest : { ...rest, [key]: value }) as ShapeElement;
}

// Everything about an element EXCEPT what deltas carry, for comparing.
function withoutDeltaFields(el: Element): unknown {
  const { commentThread: _t, ...rest } = el as Element & { commentThread?: CommentThread };
  if (rest.type !== 'shape') return rest;
  const {
    responses: _r,
    ideaCards: _i,
    ideaCardIds: _ii,
    planBoard: _b,
    checklistItems,
    ...shape
  } = rest as ShapeElement;
  return checklistItems
    ? { ...shape, checklistItems: checklistItems.map((item) => item.text) }
    : shape;
}

// Did this element change ONLY in fields that travel as deltas? Then the
// sender has already said it, one delta at a time, and a whole-element update
// on top would only hand receivers a snapshot to be wrong with.
export function elementChangeIsDeltaOnly(before: Element, after: Element): boolean {
  // A set-up that appeared or went has no patch to carry it: the update must go.
  const board = (e: Element) => (e.type === 'shape' && e.planBoard ? 1 : 0);
  if (board(before) !== board(after)) return false;
  return JSON.stringify(withoutDeltaFields(before)) === JSON.stringify(withoutDeltaFields(after));
}

// The tick a press on row `index` sends: the row's opposite state, named by
// index and text. Null when there is no such row.
export function checklistDeltaFor(el: Element, index: number): ElementDelta | null {
  if (el.type !== 'shape') return null;
  const item = el.checklistItems?.[index];
  if (!item) return null;
  return { kind: 'check', index, text: item.text, done: !item.done };
}

// The response a delta would record, for a sender deciding what to send. A
// press on your own answer withdraws it (docs/specs/012-collaboration/participant-responses.md).
export function responseDeltaFor(
  el: ShapeElement,
  participantId: string,
  value: string,
  at: number,
): ElementDelta {
  const already = (el.responses ?? []).find(
    (r: ParticipantResponse) => r.participantId === participantId,
  );
  return {
    kind: 'response',
    participantId,
    value: already?.value === value ? null : value,
    at,
    ...(el.collabRound ? { round: el.collabRound } : {}),
  };
}
