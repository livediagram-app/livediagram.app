// Per-element deltas (docs/specs/012-collaboration/collab-race-hardening.md): the fields that many participants write AT
// ONCE travel as the change, not the state.
//
// An element change otherwise leaves a browser as an `el` `update` op that
// replaces the whole element on every receiver (docs/specs/012-collaboration/realtime-conflict-resolution.md). That is fine for an
// author editing a shape, which the selection lock makes a one-writer affair,
// and wrong for a comment thread the whole room writes in the same second: each
// receiver took the other's copy, and one comment vanished. A delta names one
// comment or one pinned note, so concurrent deltas commute and every peer lands on the same element.
//
// Three pieces, all pure:
//   - `applyElementDelta`: the one place a delta changes an element, run by
//     the sender and by every receiver, so they cannot disagree.
//   - `mergeIncomingElement`: a whole-element update keeps the receiver's copy
//     of these fields, because every change to them arrived as a delta.
//   - `elementChangeIsDeltaOnly`: the sender skips the whole-element update
//     when nothing else changed, since the delta already said it.
//
// A LEAF module: runtime imports come only from other leaves, so the index <-> factories module cycle never reaches
// it.

import type { Element, ShapeElement } from './index';
import type { Comment, CommentThread } from './comments';
import { threadResolved, threadWithComment, threadWithoutComment } from './comment-thread';
import { holdsNotes, isNoticeNote, NOTES_MAX, type NoticeNote } from './office-social';
import { arcadeTableWith, type ArcadeScore } from './arcade-scores';
import { isPieceTimer, isTimerPieceShape, samePieceTimer, type PieceTimer } from './timer-pieces';
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
  // Comment threads (docs/specs/008-canvas/canvas-and-palette.md): append, delete, the server's id replacing the
  // local one, and resolve / unresolve.
  // `before`: a refused delete put back ahead of the comment that followed it (useEditorComments).
  | { kind: 'comment-add'; comment: Comment; before?: string }
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
    }
  // A Notice Board's notes (docs/specs/009-elements/social-pieces.md "Notice Board"), and a Calendar Wall's, each
  // pinned to a day (team-pieces.md): pin one, or take one down by id.
  // An unpin names the note's signer too, and removes the note only while that is still its `by`: the room lets a
  // Participant send only its own key there, so it can unpin only what it pinned.
  | { kind: 'notice-pin'; note: NoticeNote }
  | { kind: 'notice-unpin'; noteId: string; by: string }
  // A Timer's or Stopwatch's clock (docs/specs/009-elements/timer-and-stopwatch.md "How a change travels"): the whole
  // new state, so the last press in the room's order wins on every screen. Names nobody: anyone who takes part runs it.
  | { kind: 'piece-timer'; state: PieceTimer }
  // An Arcade Machine's High Scores (docs/specs/009-elements/social-pieces.md "High Scores"): post one score, put in
  // its place and the table cut to ten where it is applied, or empty the table (an Editor's).
  | { kind: 'arcade-score'; score: ArcadeScore }
  | { kind: 'arcade-clear' };

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

const threadOf = (el: Element): CommentThread | undefined =>
  (el as { commentThread?: CommentThread }).commentThread;

// The element with its thread set, or removed when `thread` is undefined.
function withThread(el: Element, thread: CommentThread | undefined): Element {
  const { commentThread: _drop, ...rest } = el;
  return thread ? { ...rest, commentThread: thread } : rest;
}

// A piece that takes note changes (a Notice Board, a Calendar Wall: docs/specs/009-elements/team-pieces.md).
function openNotePiece(el: Element): ShapeElement | null {
  return el.type === 'shape' && holdsNotes(el.shape) ? el : null;
}

// The board with its notes set, the field dropped when none are left.
// A pinned note's own fields alone: a field the wire does not define is never stored on the board, so a pin padded
// with junk can't grow the tab past what a save takes.
function noteFields(n: NoticeNote): NoticeNote {
  return {
    id: n.id,
    ...(n.title === undefined ? {} : { title: n.title }),
    text: n.text,
    author: n.author,
    by: n.by,
    at: n.at,
    ...(n.color === undefined ? {} : { color: n.color }),
    ...(n.day === undefined ? {} : { day: n.day }),
  };
}

function withNotes(el: ShapeElement, notes: NoticeNote[]): ShapeElement {
  const { noticeNotes: _drop, ...rest } = el;
  return notes.length > 0 ? { ...rest, noticeNotes: notes } : rest;
}

const holdsComment = (el: Element, commentId: string): boolean =>
  !!threadOf(el)?.comments?.some((c) => c.id === commentId);

// Apply one delta. Returns the SAME element when nothing changes (a tick that is
// already so, a comment that isn't there, a malformed frame),
// so callers keep identity and the autosave sees no phantom change. Validated
// here because a delta is the one element write that skips `validate.ts`.
export function applyElementDelta(el: Element, delta: ElementDelta): Element {
  switch (delta.kind) {
    case 'comment-add': {
      if (!isComment(delta.comment)) return el;
      const thread = threadOf(el);
      const before = typeof delta.before === 'string' ? delta.before : undefined;
      const next = threadWithComment(thread, delta.comment, COMMENTS_MAX, before);
      return next === thread ? el : withThread(el, next);
    }
    case 'comment-remove': {
      if (!holdsComment(el, delta.commentId)) return el;
      const thread = threadOf(el)!;
      const next = threadWithoutComment(thread, delta.commentId);
      return next === thread ? el : withThread(el, next);
    }
    case 'comment-rekey': {
      if (typeof delta.to !== 'string') return el;
      if (!holdsComment(el, delta.from)) return el;
      const thread = threadOf(el)!;
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
      if (!holdsComment(el, delta.commentId)) return el;
      const thread = threadOf(el)!;
      let changed = false;
      const comments = thread.comments.map((c) => {
        if (c.id !== delta.commentId) return c;
        const next = commentWithReactions(c, withReaction(c.reactions, delta));
        if (next !== c) changed = true;
        return next;
      });
      return changed ? withThread(el, { ...thread, comments }) : el;
    }
    case 'notice-pin': {
      const board = openNotePiece(el);
      if (!board || !isNoticeNote(delta.note)) return el;
      const notes = board.noticeNotes ?? [];
      // A replay, or a board already full: the note does not land (two pins racing for the last place settle in
      // the room's order).
      if (notes.length >= NOTES_MAX || notes.some((n) => n.id === delta.note.id)) return el;
      return withNotes(board, [...notes, noteFields(delta.note)]);
    }
    case 'notice-unpin': {
      const board = openNotePiece(el);
      if (!board || typeof delta.noteId !== 'string' || typeof delta.by !== 'string') return el;
      const notes = board.noticeNotes ?? [];
      const at = notes.findIndex((n) => n.id === delta.noteId && n.by === delta.by);
      if (at === -1) return el;
      return withNotes(
        board,
        notes.filter((_, i) => i !== at),
      );
    }
    case 'piece-timer': {
      if (el.type !== 'shape' || !isTimerPieceShape(el.shape)) return el;
      if (!isPieceTimer(delta.state, el.shape)) return el;
      if (el.pieceTimer && samePieceTimer(el.pieceTimer, delta.state)) return el;
      const { running, startedAt, accumulatedMs, durationMs } = delta.state;
      return { ...el, pieceTimer: { running, startedAt, accumulatedMs, durationMs } };
    }
    case 'arcade-score': {
      if (el.type !== 'shape' || el.shape !== 'arcade-machine') return el;
      const table = arcadeTableWith(el.arcadeScores, delta.score);
      return table ? { ...el, arcadeScores: table } : el;
    }
    case 'arcade-clear': {
      if (el.type !== 'shape' || el.shape !== 'arcade-machine' || !el.arcadeScores) return el;
      return withoutArcadeScores(el);
    }
    default:
      return el;
  }
}

// A peer's whole-element copy (an `el` update, or an element inside a whole
// `tab` op), folded into ours. Everything the peer changed is taken, EXCEPT the
// delta-carried fields: those reached us one delta at a time and ours is
// already the merged copy, where theirs is a snapshot from their last save that
// can be missing somebody's comment or note.
export function mergeIncomingElement(local: Element, incoming: Element): Element {
  if (local.type !== incoming.type) return incoming;
  let next = incoming;
  const localThread = (local as { commentThread?: CommentThread }).commentThread;
  const incomingThread = (incoming as { commentThread?: CommentThread }).commentThread;
  if (localThread !== incomingThread) next = withThread(next, localThread);
  if (local.type === 'shape' && next.type === 'shape') {
    const shape: ShapeElement = next;
    // A notice board's notes are ours whole: every pin and unpin reached us as a delta, so a peer's update (an
    // Editor moving the board) never carries its older list over somebody's new note.
    if (local.noticeNotes !== shape.noticeNotes) {
      next = local.noticeNotes ? { ...next, noticeNotes: local.noticeNotes } : withoutNotes(next);
    }
    // A Timer's clock likewise: every press reached us as a delta, so a peer moving the piece never stops it.
    if (local.pieceTimer !== next.pieceTimer) {
      next = local.pieceTimer ? { ...next, pieceTimer: local.pieceTimer } : withoutPieceTimer(next);
    }
    // An Arcade Machine's High Scores likewise: every score reached us as a delta.
    if (local.arcadeScores !== next.arcadeScores) {
      next = local.arcadeScores
        ? { ...next, arcadeScores: local.arcadeScores }
        : withoutArcadeScores(next);
    }
  }
  return next;
}

function withoutPieceTimer(el: ShapeElement): ShapeElement {
  const { pieceTimer: _drop, ...rest } = el;
  return rest;
}

function withoutArcadeScores(el: ShapeElement): ShapeElement {
  const { arcadeScores: _drop, ...rest } = el;
  return rest;
}

function withoutNotes(el: ShapeElement): ShapeElement {
  const { noticeNotes: _drop, ...rest } = el;
  return rest;
}

// Everything about an element EXCEPT what deltas carry, for comparing.
function withoutDeltaFields(el: Element): unknown {
  const { commentThread: _t, ...rest } = el;
  if (rest.type !== 'shape') return rest;
  const { noticeNotes: _n, pieceTimer: _p, arcadeScores: _a, ...shape } = rest as ShapeElement;
  return shape;
}

// Did this element change ONLY in fields that travel as deltas? Then the
// sender has already said it, one delta at a time, and a whole-element update
// on top would only hand receivers a snapshot to be wrong with.
export function elementChangeIsDeltaOnly(before: Element, after: Element): boolean {
  return JSON.stringify(withoutDeltaFields(before)) === JSON.stringify(withoutDeltaFields(after));
}
