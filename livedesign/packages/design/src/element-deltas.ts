// Per-element deltas (docs/specs/012-collaboration/collab-race-hardening.md): the fields that many participants write AT
// ONCE travel as the change, not the state.
//
// An element change otherwise leaves a browser as an `el` `update` op that
// replaces the whole element on every receiver (docs/specs/012-collaboration/realtime-conflict-resolution.md). That is fine for an
// author editing a shape, which the selection lock makes a one-writer affair,
// and wrong for a checklist the whole room ticks in the same second: each
// receiver took the other's copy, and one mark vanished. A delta names one
// tick or one comment, so concurrent deltas commute and every peer lands on the
// same element.
//
// Three pieces, all pure:
//   - `applyElementDelta`: the one place a delta changes an element, run by
//     the sender and by every receiver, so they cannot disagree.
//   - `mergeIncomingElement`: a whole-element update keeps the receiver's copy
//     of these fields, because every change to them arrived as a delta.
//   - `elementChangeIsDeltaOnly`: the sender skips the whole-element update
//     when nothing else changed, since the delta already said it.
//
// A LEAF module: runtime imports come only from other leaves, so it stays
// out of the index ⇄ factories module cycle.

import type { Element, ShapeElement } from './index';
import type { Comment, CommentThread } from './comments';
import { threadResolved, threadWithComment, threadWithoutComment } from './comment-thread';
import type { ChecklistItem } from './data-shapes';
import { MENTIONS_MAX } from '@liveworkspace/model-core/comment-mentions';
import {
  commentWithReactions,
  isCommentReactions,
  isReactionChange,
  withReaction,
  type CommentReactionId,
} from '@liveworkspace/model-core/comment-reactions';

// Bounds on a comment arriving in a delta. Generous: the editor's own limits
// are tighter, this only stops a hand-crafted frame from bloating a peer.
const COMMENT_MAX_TEXT = 5000;
export const COMMENTS_MAX = 500;

export type ElementDelta =
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
  // One person's reaction on one comment, on or off (docs/specs/012-collaboration/comment-reactions.md): `by` is
  // their collab key, `name` the name they react under (the room stamps both from the sender's presence).
  | {
      kind: 'comment-react';
      commentId: string;
      emoji: CommentReactionId;
      by: string;
      name: string;
      on: boolean;
    };

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
    (c.mentions === undefined ||
      (Array.isArray(c.mentions) && c.mentions.length <= MENTIONS_MAX)) &&
    // Reactions (docs/specs/012-collaboration/comment-reactions.md), when present, are the bounded list.
    isCommentReactions(c.reactions)
  );
}

function threadOf(el: Element): CommentThread | undefined {
  return (el as { commentThread?: CommentThread }).commentThread;
}

// The element with its thread set, or removed when `thread` is undefined.
function withThread(el: Element, thread: CommentThread | undefined): Element {
  const { commentThread: _drop, ...rest } = el as Element & { commentThread?: CommentThread };
  return (thread ? { ...rest, commentThread: thread } : rest) as Element;
}

// Apply one delta. Returns the SAME element when nothing changes (a tick a row
// already shows, a comment that isn't there, a malformed frame),
// so callers keep identity and the autosave sees no phantom change. Validated
// here because a delta is the one element write that skips `validate.ts`.
export function applyElementDelta(el: Element, delta: ElementDelta): Element {
  switch (delta.kind) {
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
      const thread = threadOf(el);
      const next = threadWithComment(thread, delta.comment, COMMENTS_MAX);
      return next === thread ? el : withThread(el, next);
    }
    case 'comment-remove': {
      const thread = threadOf(el);
      if (!thread?.comments?.some((c) => c.id === delta.commentId)) return el;
      const next = threadWithoutComment(thread, delta.commentId);
      return next === thread ? el : withThread(el, next);
    }
    case 'comment-rekey': {
      if (typeof delta.to !== 'string') return el;
      const thread = threadOf(el);
      if (!thread?.comments?.some((c) => c.id === delta.from)) return el;
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
      const thread = threadOf(el);
      const next = threadResolved(thread, delta.resolved);
      return next === thread ? el : withThread(el, next);
    }
    case 'comment-react': {
      if (typeof delta.commentId !== 'string' || !isReactionChange(delta)) return el;
      const thread = threadOf(el);
      if (!thread?.comments.some((c) => c.id === delta.commentId)) return el;
      let changed = false;
      const comments = thread.comments.map((c) => {
        if (c.id !== delta.commentId) return c;
        const next = commentWithReactions(c, withReaction(c.reactions, delta));
        if (next !== c) changed = true;
        return next;
      });
      return changed ? withThread(el, { ...thread, comments }) : el;
    }
    default:
      return el;
  }
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
// can be missing somebody's tick.
export function mergeIncomingElement(local: Element, incoming: Element): Element {
  if (local.type !== incoming.type) return incoming;
  let next = incoming;
  const localThread = (local as { commentThread?: CommentThread }).commentThread;
  const incomingThread = (incoming as { commentThread?: CommentThread }).commentThread;
  if (localThread !== incomingThread) next = withThread(next, localThread);
  if (local.type === 'shape' && next.type === 'shape') {
    const shape: ShapeElement = next;
    if (local.checklistItems && shape.checklistItems) {
      const items = keepLocalTicks(local.checklistItems, shape.checklistItems);
      if (items !== shape.checklistItems) next = { ...shape, checklistItems: items };
    }
  }
  return next;
}

// Everything about an element EXCEPT what deltas carry, for comparing.
function withoutDeltaFields(el: Element): unknown {
  const { commentThread: _t, ...rest } = el as Element & { commentThread?: CommentThread };
  if (rest.type !== 'shape') return rest;
  const { checklistItems, ...shape } = rest as ShapeElement;
  return checklistItems
    ? { ...shape, checklistItems: checklistItems.map((item) => item.text) }
    : shape;
}

// Did this element change ONLY in fields that travel as deltas? Then the
// sender has already said it, one delta at a time, and a whole-element update
// on top would only hand receivers a snapshot to be wrong with.
export function elementChangeIsDeltaOnly(before: Element, after: Element): boolean {
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
