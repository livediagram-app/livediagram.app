// Everything one tab save contributes to the Timeline (spec/138 §4.2,
// §4.3), behind a single call so the hot autosave path in
// diagram-subresource-routes.ts stays readable.
//
// Runs entirely inside waitUntil. The autosave fires roughly every
// 600ms per editor, so this must never be on the response path — and
// because `record` swallows its own failures, a bad diff can't take a
// save down with it.

import type { Element } from '@livediagram/diagram';
import type { DiagramDTO, Env } from '../types';
import {
  recordActionAssigned,
  recordActionCompleted,
  recordCommentAdded,
  recordCommentResolved,
  recordDiagramEdited,
} from './diagram-events';
import { completedActions, newActions, newComments, newlyResolvedThreads } from './tab-diff';

type DiagramRef = Pick<DiagramDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

export async function recordTabSave(
  env: Env,
  diagram: DiagramRef,
  actorId: string,
  next: Element[],
  prev: Element[],
): Promise<void> {
  // The coalesced editing event fires on every save; the dedupe key
  // collapses a day of them into one row that walks its timestamp
  // forward (spec/138 §4.2).
  await recordDiagramEdited(env, diagram, actorId);

  for (const comment of newComments(next, prev)) {
    await recordCommentAdded(
      env,
      diagram,
      {
        id: comment.id,
        text: comment.text,
        authorName: comment.authorName,
        authorColor: comment.authorColor,
      },
      actorId,
    );
  }

  for (const elementId of newlyResolvedThreads(next, prev)) {
    // The element id doubles as the thread's identity — a thread has no
    // id of its own, it hangs off its element. Namespaced with the
    // diagram id so the same element id in two diagrams (a duplicate)
    // can't collide on the timeline UNIQUE key.
    await recordCommentResolved(env, diagram, `${diagram.id}:${elementId}`, actorId);
  }

  for (const action of newActions(next, prev)) {
    await recordActionAssigned(
      env,
      diagram,
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
    await recordActionCompleted(env, diagram, { id: action.id, name: action.name }, actorId);
  }
}
