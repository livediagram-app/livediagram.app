import type { Tab } from '@livehuddle/document';
import { hasNewComments } from '../comments';
import { emailEnabled } from '../email/client';
import { notifyNewComment } from '../email/notifications';
import { pushItemOf, pushNewComments } from '../liveworkspace/push';
import { reportServerEvent } from '../server-telemetry';
import type { DocumentDTO, DocumentEnv, Env } from '../types';
import type { FrontDoor } from './front-door';
import type { Author } from './write';

// What follows a written changeset, off the response path (docs/specs/024-agents/blueprints/
// agent-changesets.md "The pipeline" step 11): the new-comment email exactly as a
// save does, with the author as the actor (CS29), and the Agent telemetry for a token's changeset.
// Never for a dry run (CS12).

type AgentAction = 'Applied' | 'Conflicted' | 'Held' | 'Reverted';

// One literal emit per action, so the telemetry dashboard's emitter scan can see each event.
function telemetry(env: Env, action: AgentAction, frontDoor: FrontDoor): Promise<void> {
  switch (action) {
    case 'Applied':
      return reportServerEvent(env, 'Agent', 'Applied', frontDoor);
    case 'Conflicted':
      return reportServerEvent(env, 'Agent', 'Conflicted', frontDoor);
    case 'Held':
      return reportServerEvent(env, 'Agent', 'Held', frontDoor);
    case 'Reverted':
      return reportServerEvent(env, 'Agent', 'Reverted', frontDoor);
  }
}

async function run(
  env: DocumentEnv,
  w: {
    document: DocumentDTO;
    author: Author;
    next: Tab;
    stored: Tab | null;
    agent: boolean;
    frontDoor: FrontDoor;
    action: 'Applied' | 'Reverted';
  },
): Promise<void> {
  // The edit itself reaches the Timeline from the canvas (document-room.ts records whoever wrote).
  const previous = w.stored?.elements ?? [];
  const work: Promise<unknown>[] = [];
  if (
    emailEnabled(env) &&
    w.author.id !== w.document.ownerId &&
    hasNewComments(w.next.elements, previous, w.author.id)
  ) {
    work.push(
      notifyNewComment(
        env,
        { id: w.document.id, ownerId: w.document.ownerId, name: w.document.name },
        w.author.name,
      ),
    );
  }
  // Phone notifications for the author's new comments (docs/specs/014-identity/phone-notifications.md): a person's
  // own changeset only, never an API token's.
  if (!w.agent)
    work.push(
      pushNewComments(env, {
        document: pushItemOf(w.document),
        tabId: w.next.id,
        authorId: w.author.id,
        authorName: w.author.name,
        next: w.next.elements,
        previous,
      }),
    );
  if (w.agent) work.push(telemetry(env, w.action, w.frontDoor));
  const settled = await Promise.allSettled(work);
  for (const s of settled) {
    if (s.status === 'rejected') {
      console.warn('[changeset] after-work failed', {
        documentId: w.document.id,
        error: String(s.reason),
      });
    }
  }
}

export const afterChangeset = { run, telemetry };
