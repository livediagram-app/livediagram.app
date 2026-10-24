// docs/specs/014-identity/profile-and-email-notifications.md: the opt-out transactional notifications layered on top
// of the docs/specs/014-identity/transactional-email.md email feature: a new comment, someone joining a shared
// document, an action assigned, a mention, and the two milestones (the tenth document and the first share link).
// Every app sends the last five the same way, so they are @liveworkspace/index-app's createNotifier with this app's
// templates and accounts; the new-comment email, throttled in the document's own storage, is this app's.
//
// Like every docs/specs/014-identity/transactional-email.md send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import { createNotifier, workbenchAllowance } from '@liveworkspace/index-app';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { MENTIONS_MAX, type Comment } from '@livedocuments/document';
import { ownerEmail } from '../person/account-app';
import {
  claimOwnerMilestone,
  notifyRecipients,
  documentsMadeBy,
  teamPeople,
  type NotifySetting,
} from '../person/notify';
import { isAccountOwner } from '../person/owner';
import { getParticipant } from '../person/profiles';
import { getNotificationPrefs } from '../person/settings';
import { claimCommentNotify } from '../document-room/document-content';
import type { Env, DocumentEnv } from '../types';
import { emailEnabled, sendEmail } from './client';
import {
  actionAssignedEmail,
  commentNotificationEmail,
  firstShareEmail,
  mentionedEmail,
  milestoneEmail,
  documentJoinedEmail,
  type RenderedEmail,
} from './templates';

// At most one "new comment" email per document per this window (docs/specs/014-identity/transactional-email.md #1), so a
// burst of comments doesn't spam the owner.
const COMMENT_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;

// Someone OTHER than the owner left a comment on a document the owner owns
// (docs/specs/014-identity/transactional-email.md #1). Immediate, opt-out (notifyComments). Best-effort; never blocks
// the comment write. The comment text is deliberately NOT included.
export async function notifyNewComment(
  env: DocumentEnv,
  liveDoc: { id: string; ownerId: string; name: string },
  commenterName: string | null,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await ownerEmail(env, liveDoc.ownerId);
  if (!to) return;
  const prefs = await getNotificationPrefs(env, liveDoc.ownerId);
  if (!prefs.notifyComments) return;
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
  isAccount: isAccountOwner,
  recipients: (env, ids, setting) => notifyRecipients(env, ids, setting as NotifySetting),
  itemsMadeBy: documentsMadeBy,
  claimMilestone: claimOwnerMilestone,
  claims: (env) => (env as DocumentEnv).DOCUMENT_DB,
  allowance: (env) => workbenchAllowance(env.WORKBENCH),
  nameOf: async (env, id) => (await getParticipant(env, id))?.name ?? null,
  teamPeople,
  settings: { join: 'notifyDocumentJoin' },
  emails: {
    milestone: milestoneEmail,
    firstShare: firstShareEmail,
    joined: documentJoinedEmail,
    actionAssigned: actionAssignedEmail,
    mentioned: (env, authorName, document, text) =>
      mentionedEmail(env, authorName, document.name, document.id, text),
  },
});

// The owner just made a document: the tenth celebrates, once (docs/specs/014-identity/transactional-email.md #6).
export const notifyMilestone = (env: Env, ownerId: string): Promise<void> =>
  notifier.notifyMilestone(env, ownerId);

// Someone made a share link for the first time (the index's `shared` notice, routes/internal-items.ts).
export const notifyFirstShare = (env: Env, actorId: string): Promise<void> =>
  notifier.notifyFirstShare(env, actorId);

// A signed-in person opened one of an owner's documents through a share link for the first time (the index's `joined`
// notice, run inside the document's Durable Object). Opt-out (notifyDocumentJoin).
export const notifyDocumentJoin = (
  env: DocumentEnv,
  document: { id: string; ownerId: string; name: string },
  joinerId: string,
): Promise<void> => notifier.notifyJoin(env, document, joinerId);

// A teammate assigned the recipient an action on a document (routes/notify-action-route.ts, after it checked both
// people and the document). Opt-out (notifyActionAssigned).
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

// The author's new comments on a team document @-mentioned teammates (docs/specs/012-collaboration/comment-mentions.md
// "The email"): each person mentioned gets one email per comment. Opt-out (notifyMentions).
export function notifyMentions(
  env: DocumentEnv,
  input: {
    document: { id: string; name: string; teamId: string | null };
    authorId: string;
    // Who signs the email when the author has no profile name (their verified address).
    authorFallbackName?: string | null;
    comments: readonly Comment[];
  },
): Promise<void> {
  const { document, ...rest } = input;
  return notifier.notifyMentions(env, { ...rest, item: document, mentionsMax: MENTIONS_MAX });
}
