// A card's comment threads on the wire (docs/specs/026-plan/items.md "Comments", blueprint item-store.md "Comments"):
// what the thread routes take and answer, and the room op every thread write sends. A thread is stored once, in
// its home plan, and reached through any plan holding one of its cards: `/projects/:id/...` names the plan the
// caller views it through.

import type { CardThread, CommentMention, CommentReactionId } from '@liveplanner/project';

export type { CardRef, CardThread, ThreadPerson } from '@liveplanner/project';

// GET /api/projects/:id/threads (?item=<itemId> for one card's): every thread on a card of this plan the caller
// reaches, open and resolved, each whole. Author ids only on the caller's own comments.
export type CardThreadsResponse = { threads: CardThread[] };

// POST /api/projects/:id/items/:itemId/threads: a new thread on the card, with its first comment. `title` is
// optional; left out, the thread is titled from the caller's name and the comment. `field` is the Comments field it
// starts in (a Comments field of the card's type, by id; the built-in Comments when absent), else 400 field_invalid.
export type CardThreadStartRequest = {
  text: string;
  mentions?: CommentMention[];
  title?: string;
  field?: string;
};

// POST /api/projects/:id/threads/:threadId/comments (a reply) and PUT .../comments/:commentId (an edit).
export type CardThreadCommentRequest = { text: string; mentions?: CommentMention[] };

// POST /api/projects/:id/threads/:threadId/comments/:commentId/reactions: the caller's own reaction on one comment,
// on or off (docs/specs/012-collaboration/comment-reactions.md). `key` is the caller's public collab key, which
// their reactions are kept under; the name is the server's. Nothing changing answers 204.
export type CardThreadReactionRequest = { emoji: CommentReactionId; on: boolean; key: string };

// PUT /api/projects/:id/threads/:threadId/title: '' goes back to the automatic title.
export type CardThreadRenameRequest = { title: string };

// POST /api/projects/:id/threads/:threadId/cards: the card of this plan to add the thread to. A projectId naming
// another plan is refused (thread_other_plan); it is still read so an older client's request answers that.
export type CardThreadAddCardRequest = { itemId: string; projectId?: string };

// Every write's answer: the thread as stored (null once a comment delete took its last comment), and the comment
// a start, reply or edit wrote.
export type CardThreadWriteResponse = { thread: CardThread | null; commentId?: string };

// The room op every thread write sends (ordered, carrying no store rev), to every plan the thread is on. A session
// scoped to one tab hears both lists empty and reads GET /threads again.
export type CardThreadsRoomOp = { kind: 'threads'; upserts: CardThread[]; removed: string[] };
