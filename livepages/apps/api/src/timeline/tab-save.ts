// Everything one tab save contributes to the Timeline (docs/specs/013-workspace/timeline.md §4.2,
// §4.3), behind a single call so the hot autosave path in
// document-subresource-routes.ts stays readable.
//
// Runs entirely inside waitUntil. The autosave fires roughly every
// 600ms per editor, so this must never be on the response path — and
// because `record` swallows its own failures, a bad diff can't take a
// save down with it.

import type { Element } from '@livediagram/document';
import type { DocumentDTO, Env } from '../types';
import {
  recordActionAssigned,
  recordActionCompleted,
  recordCommentAdded,
  recordCommentResolved,
  recordDocumentEdited,
  retractComments,
} from './document-events';
import {
  claimedComments,
  completedActions,
  newActions,
  newComments,
  newlyResolvedThreads,
  removedComments,
} from './tab-diff';

type DocumentRef = Pick<DocumentDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

export async function recordTabSave(
  env: Env,
  liveDoc: DocumentRef,
  actorId: string,
  next: Element[],
  prev: Element[],
): Promise<void> {
  // The coalesced editing event fires on every save; the dedupe key
  // collapses a day of them into one row that walks its timestamp
  // forward (docs/specs/013-workspace/timeline.md §4.2).
  await recordDocumentEdited(env, liveDoc, actorId);

  // A comment's actor is its author, never simply the saver: a save carries a peer's new comment
  // when it reached the saver live first, stored without an author id until the author's own save
  // claims it (rewriteCommentAuthors). Only an author id equal to the saver's is trusted here, so a
  // client can never credit a comment to somebody else; the claim fills the actor in later.
  for (const comment of [...newComments(next, prev), ...claimedComments(next, prev)]) {
    await recordCommentAdded(
      env,
      liveDoc,
      {
        id: comment.id,
        text: comment.text,
        authorName: comment.authorName,
        authorColor: comment.authorColor,
        reply: comment.reply,
      },
      comment.authorId === actorId ? actorId : null,
    );
  }

  // A deleted comment's words leave the feed with it, whether it went alone or with its element.
  await retractComments(
    env,
    liveDoc.id,
    removedComments(next, prev).map((c) => ({
      id: c.id,
      threadKey: c.opening ? `${liveDoc.id}:${c.elementId}` : null,
    })),
  );

  for (const { elementId, text } of newlyResolvedThreads(next, prev)) {
    // The element id doubles as the thread's identity — a thread has no
    // id of its own, it hangs off its element. Namespaced with the
    // document id so the same element id in two documents (a duplicate)
    // can't collide on the timeline UNIQUE key.
    await recordCommentResolved(env, liveDoc, `${liveDoc.id}:${elementId}`, text, actorId);
  }

  for (const action of newActions(next, prev)) {
    await recordActionAssigned(
      env,
      liveDoc,
      {
        id: action.id,
        name: action.name,
        assigneeId: action.assignee.userId,
        assigneeName: action.assignee.name,
      },
      actorId,
    );
  }

  for (const action of completedActions(next, prev)) {
    await recordActionCompleted(env, liveDoc, { id: action.id, name: action.name }, actorId);
  }
}
