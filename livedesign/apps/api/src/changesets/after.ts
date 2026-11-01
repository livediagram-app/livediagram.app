import type { Tab } from '@livedesign/design';
import { newCommentsBy } from '../comments';
import { emailEnabled } from '../email/client';
import { notifyMentions, notifyNewComment } from '../email/notifications';
import { pushItemOf, pushNewComments } from '../accounts/push';
import { reportServerEvent } from '../server-telemetry';
import type { DesignDTO, Env, DesignEnv } from '../types';
import type { FrontDoor } from './front-door';
import type { Author } from './write';

// What follows a written changeset, off the response path (docs/specs/024-agents/blueprints/
// agent-changesets.md "The pipeline" step 11): the new-comment and mention emails exactly as a
// save sends them, with the author as the actor (CS29), and the Agent telemetry for a token's changeset.
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
  env: DesignEnv,
  w: {
    design: DesignDTO;
    author: Author;
    next: Tab;
    stored: Tab | null;
    agent: boolean;
    frontDoor: FrontDoor;
    action: 'Applied' | 'Reverted';
  },
): Promise<void> {
  const previous = w.stored?.elements ?? [];
  const work: Promise<unknown>[] = [];
  const fresh =
    emailEnabled(env) && (w.author.id !== w.design.ownerId || (!w.agent && w.design.teamId))
      ? newCommentsBy(w.next.elements, previous, w.author.id)
      : [];
  if (fresh.length > 0 && w.author.id !== w.design.ownerId) {
    work.push(
      notifyNewComment(
        env,
        { id: w.design.id, ownerId: w.design.ownerId, name: w.design.name },
        w.author.name,
      ),
    );
  }
  // The teammates the author's new comments @-mention (docs/specs/012-collaboration/comment-mentions.md): a
  // person's own changeset only, never an API token's, as only a signed-in person's mention emails.
  if (!w.agent && w.design.teamId && fresh.some((c) => c.mentions?.length)) {
    work.push(
      notifyMentions(env, {
        design: { id: w.design.id, name: w.design.name, teamId: w.design.teamId },
        authorId: w.author.id,
        comments: fresh,
      }),
    );
  }
  // Phone notifications for the author's new comments (docs/specs/014-identity/phone-notifications.md): a
  // person's own changeset only.
  if (!w.agent)
    work.push(
      pushNewComments(env, {
        design: pushItemOf(w.design),
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
        designId: w.design.id,
        error: String(s.reason),
      });
    }
  }
}

export const afterChangeset = { run, telemetry };
