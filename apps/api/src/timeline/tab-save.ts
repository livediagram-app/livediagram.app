// Everything one tab save contributes to the Timeline (docs/specs/013-workspace/timeline.md §4.2,
// §4.3), behind a single call so the hot autosave path in
// document-subresource-routes.ts stays readable.
//
// Runs entirely inside waitUntil. The autosave fires roughly every
// 600ms per editor, so this must never be on the response path — and
// because `record` swallows its own failures, a bad diff can't take a
// save down with it.

import type { Element } from '@livediagram/document';
import type { DocumentDTO, Runtime } from '../types';
import {
  recordActionAssigned,
  recordActionCompleted,
  recordCommentAdded,
  recordCommentResolved,
  recordDocumentEdited,
} from './document-events';
import { completedActions, newActions, newComments, newlyResolvedThreads } from './tab-diff';

type DocumentRef = Pick<DocumentDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

export async function recordTabSave(
  env: Runtime,
  liveDoc: DocumentRef,
  actorId: string,
  next: Element[],
  prev: Element[],
): Promise<void> {
  // The coalesced editing event fires on every save; the dedupe key
  // collapses a day of them into one row that walks its timestamp
  // forward (docs/specs/013-workspace/timeline.md §4.2).
  await recordDocumentEdited(env, liveDoc, actorId);

  for (const comment of newComments(next, prev)) {
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
      actorId,
    );
  }

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
