// docs/specs/014-identity/profile-and-email-notifications.md: the opt-out transactional notifications layered on top
// of the docs/specs/014-identity/transactional-email.md email feature: a new comment, someone joining a shared
// design, an action assigned, a mention, and the two milestones (the tenth design and the first share link).
// Every app sends the last five the same way, so they are @liveworkspace/index-app's createNotifier with this app's
// templates and accounts; the rest are this app's own.
//
// Like every docs/specs/014-identity/transactional-email.md send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import { accountsAllowance, createNotifier } from '@liveworkspace/index-app';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { MENTIONS_MAX, type Comment } from '@livedesign/design';
import { emailOf } from '../accounts/people';
import {
  claimOwnerMilestone,
  notifyRecipients,
  designsMadeBy,
  teamPeople,
  type NotifySetting,
} from '../accounts/notify';
import { isAccountOwner } from '../accounts/client';
import { accountCredentials } from '../auth/accounts';
import { getParticipant } from '../accounts/profiles';
import { getNotificationPrefs } from '../accounts/settings';
import { claimCommentNotify } from '../design-room/design-content';
import type { Env, DesignEnv } from '../types';
import { emailEnabled, sendEmail } from './client';

// At most one "new comment" email per design per this window (docs/specs/014-identity/transactional-email.md #1), so a
// burst of comments doesn't spam the owner.
const COMMENT_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;
import {
  actionAssignedEmail,
  commentNotificationEmail,
  firstShareEmail,
  mentionedEmail,
  milestoneEmail,
  designJoinedEmail,
  type RenderedEmail,
} from './templates';

// Someone OTHER than the owner left a comment on a design the owner owns
// (docs/specs/014-identity/transactional-email.md #1). Immediate, opt-out (notifyComments). Best-effort; never blocks
// the comment write. The comment text is deliberately NOT included.
export async function notifyNewComment(
  env: DesignEnv,
  liveDoc: { id: string; ownerId: string; name: string },
  commenterName: string | null,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await emailOf(env, liveDoc.ownerId);
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
  itemsMadeBy: designsMadeBy,
  claimMilestone: claimOwnerMilestone,
  claims: (env) => (env as DesignEnv).DESIGN_DB,
  allowance: (env) => accountsAllowance(accountCredentials(env)),
  nameOf: async (env, id) => (await getParticipant(env, id))?.name ?? null,
  teamPeople,
  settings: { join: 'notifyDesignJoin' },
  emails: {
    milestone: milestoneEmail,
    firstShare: firstShareEmail,
    joined: designJoinedEmail,
    actionAssigned: actionAssignedEmail,
    mentioned: (env, authorName, design, text) =>
      mentionedEmail(env, authorName, design.name, design.id, text),
  },
});

// The owner just made a design: the tenth celebrates, once (docs/specs/014-identity/transactional-email.md #6).
export const notifyMilestone = (env: Env, ownerId: string): Promise<void> =>
  notifier.notifyMilestone(env, ownerId);

// Someone made a share link for the first time (the index's `shared` notice, routes/internal-items.ts).
export const notifyFirstShare = (env: Env, actorId: string): Promise<void> =>
  notifier.notifyFirstShare(env, actorId);

// A signed-in person opened one of an owner's designs through a share link for the first time (the index's `joined`
// notice, run inside the design's Durable Object). Opt-out (notifyDesignJoin).
export const notifyDesignJoin = (
  env: DesignEnv,
  design: { id: string; ownerId: string; name: string },
  joinerId: string,
): Promise<void> => notifier.notifyJoin(env, design, joinerId);

// A teammate assigned the recipient an action on a design (routes/notify-action-route.ts, after it checked both
// people and the design). Opt-out (notifyActionAssigned).
export function notifyActionAssigned(
  env: DesignEnv,
  input: {
    assignee: TeamPerson;
    assignerUserId: string;
    assignerName: string | null;
    design: { id: string; name: string };
    assigneeCanOpen: boolean;
    actionName: string;
    description: string | null;
  },
): Promise<void> {
  const { design, ...rest } = input;
  return notifier.notifyActionAssigned(env, { ...rest, item: design });
}

// The author's new comments on a team design @-mentioned teammates (docs/specs/012-collaboration/comment-mentions.md
// "The email"): each person mentioned gets one email per comment. Opt-out (notifyMentions).
export function notifyMentions(
  env: DesignEnv,
  input: {
    design: { id: string; name: string; teamId: string | null };
    authorId: string;
    // Who signs the email when the author has no profile name (their verified address).
    authorFallbackName?: string | null;
    comments: readonly Comment[];
  },
): Promise<void> {
  const { design, ...rest } = input;
  return notifier.notifyMentions(env, { ...rest, item: design, mentionsMax: MENTIONS_MAX });
}
