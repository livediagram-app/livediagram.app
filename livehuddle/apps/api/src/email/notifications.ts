// docs/specs/014-identity/profile-and-email-notifications.md: the opt-out transactional notifications layered on top
// of the docs/specs/014-identity/transactional-email.md email feature: a new comment, someone joining a shared
// canvas, an action assigned, a mention, and the two milestones (the tenth canvas and the first share link).
// Every app sends the last five the same way, so they are @liveworkspace/index-app's createNotifier with this app's
// templates and accounts; the new-comment email, throttled in the canvas's own storage, is this app's.
//
// Like every docs/specs/014-identity/transactional-email.md send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import type { TeamPerson } from '@liveworkspace/auth-client';
import { accountsAllowance, createNotifier } from '@liveworkspace/index-app';
import { accountCredentials } from '../auth/accounts';
import { isAccountIdShape } from '@livediagram/api-schema';
import { claimCommentNotify } from '../document-room/document-content';
import { claimMilestone } from '../liveworkspace/emails';
import { canvasesMadeBy, notifyRecipients, type NotifySetting } from '../liveworkspace/notify';
import { getParticipant } from '../liveworkspace/profiles';
import { teamPeople } from '../liveworkspace/team-people';
import type { DocumentEnv, Env } from '../types';
import { emailEnabled, sendEmail } from './client';
import {
  actionAssignedEmail,
  commentNotificationEmail,
  documentJoinedEmail,
  firstShareEmail,
  mentionedEmail,
  milestoneEmail,
  type RenderedEmail,
} from './templates';

// At most one "new comment" email per canvas per this window (docs/specs/014-identity/transactional-email.md #1), so
// a burst of comments doesn't spam the owner.
const COMMENT_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;

// One person's address for `setting`: their verified one unless they turned it off.
async function recipient(env: Env, id: string, setting: NotifySetting): Promise<string | null> {
  return (await notifyRecipients(env, [id], setting)).get(id) ?? null;
}

// Someone OTHER than the owner left a comment on a canvas the owner owns
// (docs/specs/014-identity/transactional-email.md #1). Immediate, opt-out (notifyComments). Best-effort; never blocks
// the comment write. The comment text is deliberately NOT included.
export async function notifyNewComment(
  env: DocumentEnv,
  liveDoc: { id: string; ownerId: string; name: string },
  commenterName: string | null,
): Promise<void> {
  if (!emailEnabled(env) || !isAccountIdShape(liveDoc.ownerId)) return;
  const to = await recipient(env, liveDoc.ownerId, 'notifyComments');
  if (!to) return;
  // Throttle so a burst of comments is one email, not one per comment.
  const now = Date.now();
  if (!(await claimCommentNotify(env, liveDoc.id, now, now - COMMENT_NOTIFY_THROTTLE_MS))) return;
  await sendEmail(env, {
    to,
    ...commentNotificationEmail(env, liveDoc.name, liveDoc.id, commenterName),
  });
}

// ---------- Milestones, joins, actions and mentions: the kit's, with this app's wording -----------------------------

const notifier = createNotifier<Env, RenderedEmail>({
  enabled: emailEnabled,
  send: sendEmail,
  isAccount: isAccountIdShape,
  recipients: (env, ids, setting) => notifyRecipients(env, ids, setting as NotifySetting),
  itemsMadeBy: canvasesMadeBy,
  claimMilestone,
  claims: (env) => (env as DocumentEnv).DOCUMENT_DB,
  allowance: (env) => accountsAllowance(accountCredentials(env)),
  nameOf: async (env, id) => (await getParticipant(env, id))?.name ?? null,
  teamPeople,
  settings: { join: 'notifyDocumentJoin' },
  emails: {
    milestone: milestoneEmail,
    firstShare: firstShareEmail,
    joined: documentJoinedEmail,
    actionAssigned: actionAssignedEmail,
    mentioned: (env, authorName, canvas, text) =>
      mentionedEmail(env, authorName, canvas.name, canvas.id, text),
  },
});

// The owner just made a canvas: the tenth celebrates, once (docs/specs/014-identity/transactional-email.md #6).
export const notifyMilestone = (env: Env, ownerId: string): Promise<void> =>
  notifier.notifyMilestone(env, ownerId);

// Someone made a share link for the first time (the index's `shared` notice, routes/internal-items.ts).
export const notifyFirstShare = (env: Env, actorId: string): Promise<void> =>
  notifier.notifyFirstShare(env, actorId);

// A signed-in person opened one of an owner's canvases through a share link for the first time (the index's `joined`
// notice, run inside the canvas's Durable Object). Opt-out (notifyDocumentJoin).
export const notifyDocumentJoin = (
  env: DocumentEnv,
  document: { id: string; ownerId: string; name: string },
  joinerId: string,
): Promise<void> => notifier.notifyJoin(env, document, joinerId);

// A teammate assigned the recipient an action on a canvas element (routes/notify-routes.ts, after it checked both
// people and the canvas). Opt-out (notifyActionAssigned).
export function notifyActionAssigned(
  env: DocumentEnv,
  input: {
    assignee: TeamPerson;
    assignerUserId: string;
    assignerName: string | null;
    document: { id: string; name: string };
    assigneeCanOpen: boolean;
    actionName: string;
    description: string | null;
  },
): Promise<void> {
  const { document, ...rest } = input;
  return notifier.notifyActionAssigned(env, { ...rest, item: document });
}

// A teammate's comment @-mentioned these people (docs/specs/012-collaboration/comment-mentions.md "The email"): the
// notify-mention route checked the canvas is the team's, the author one of its joined people and each recipient one
// of its people other than the author. A canvas comment reaches the canvas's storage only with the next tab save, so
// the route carries its text. Opt-out (notifyMentions).
export function notifyMentioned(
  env: DocumentEnv,
  input: {
    recipients: readonly TeamPerson[];
    authorUserId: string;
    authorName: string | null;
    document: { id: string; name: string };
    commentText: string;
  },
): Promise<void> {
  const { document, ...rest } = input;
  return notifier.notifyMentioned(env, { ...rest, item: document });
}
