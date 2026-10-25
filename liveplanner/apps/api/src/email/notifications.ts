// docs/specs/014-identity/profile-and-email-notifications.md: the opt-out transactional notifications layered on top
// of the docs/specs/014-identity/transactional-email.md email feature: a new comment, a form response, a suspended form, someone joining a shared
// plan, an action assigned, a mention, and the two milestones (the tenth plan and the first share link).
// Every app sends the last five the same way, so they are @liveworkspace/index-app's createNotifier with this app's
// templates and accounts; the rest are this app's own.
//
// Like every docs/specs/014-identity/transactional-email.md send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import { accountsAllowance, createNotifier } from '@liveworkspace/index-app';
import { isAccountId, type TeamPerson } from '@liveworkspace/auth-client';
import { MENTIONS_MAX, type Comment } from '@liveplanner/project';
import { claimFormEmail } from '../db';
import { ownerEmail } from '../person/account-app';
import {
  claimOwnerMilestone,
  notifyRecipients,
  plansMadeBy,
  teamPeople,
  type NotifySetting,
} from '../person/notify';
import { accountCredentials } from '../auth/accounts';
import { getParticipant } from '../person/profiles';
import { getNotificationPrefs } from '../person/settings';
import { claimCommentNotify } from '../plan-room/plan-content';
import type { Env, PlanEnv } from '../types';
import { emailEnabled, sendEmail } from './client';

// At most one "new comment" email per project per this window (docs/specs/014-identity/transactional-email.md #1), so a
// burst of comments doesn't spam the owner.
const COMMENT_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;
// At most one "new response" email per form per this window (docs/specs/030-forms/forms.md "Hearing about
// responses"); the next one says how many came while it was held. Safe range 5..60 minutes.
const FORM_EMAIL_THROTTLE_MS = 15 * 60 * 1000;
import {
  actionAssignedEmail,
  commentNotificationEmail,
  firstShareEmail,
  formResponseEmail,
  formSuspendedEmail,
  mentionedEmail,
  milestoneEmail,
  projectJoinedEmail,
  type RenderedEmail,
} from './templates';

// Someone OTHER than the owner left a comment on a project the owner owns
// (docs/specs/014-identity/transactional-email.md #1). Immediate, opt-out (notifyComments). Best-effort; never blocks
// the comment write. The comment text is deliberately NOT included.
export async function notifyNewComment(
  env: PlanEnv,
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

// A respondent filled in a form on a project the owner owns (docs/specs/030-forms/forms.md "Hearing about
// responses"). Opt-out (notifyFormResponses), throttled per form; never blocks the response.
export async function notifyFormResponse(
  env: PlanEnv,
  liveDoc: { id: string; ownerId: string; name: string },
  form: { code: string; heading: string },
  cardTitle: string,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await ownerEmail(env, liveDoc.ownerId);
  if (!to) return;
  const prefs = await getNotificationPrefs(env, liveDoc.ownerId);
  if (!prefs.notifyFormResponses) return;
  const claim = await claimFormEmail(env, form.code, Date.now(), FORM_EMAIL_THROTTLE_MS);
  if (!claim.send) {
    console.info('[forms] form.email.held', { projectId: liveDoc.id });
    return;
  }
  await sendEmail(env, {
    to,
    ...formResponseEmail(
      env,
      { heading: form.heading, projectId: liveDoc.id, projectName: liveDoc.name },
      cardTitle,
      claim.heldBefore,
    ),
  });
  console.info('[forms] form.email.sent', { projectId: liveDoc.id });
}

// A form link suspended after reports (docs/specs/030-forms/forms.md "Report This Form"): always sent, where email is
// configured and the owner has an address.
export async function notifyFormSuspended(
  env: Env,
  liveDoc: { id: string; ownerId: string; name: string },
  heading: string,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await ownerEmail(env, liveDoc.ownerId);
  if (!to) return;
  await sendEmail(env, {
    to,
    ...formSuspendedEmail(env, { heading, projectId: liveDoc.id, projectName: liveDoc.name }),
  });
}

// ---------- Milestones, joins, actions and mentions: the kit's, with this app's wording -----------------------------

const notifier = createNotifier<Env, RenderedEmail>({
  enabled: emailEnabled,
  send: sendEmail,
  isAccount: isAccountId,
  recipients: (env, ids, setting) => notifyRecipients(env, ids, setting as NotifySetting),
  itemsMadeBy: plansMadeBy,
  claimMilestone: claimOwnerMilestone,
  claims: (env) => (env as PlanEnv).PLAN_DB,
  allowance: (env) => accountsAllowance(accountCredentials(env)),
  nameOf: async (env, id) => (await getParticipant(env, id))?.name ?? null,
  teamPeople,
  settings: { join: 'notifyProjectJoin' },
  emails: {
    milestone: milestoneEmail,
    firstShare: firstShareEmail,
    joined: projectJoinedEmail,
    actionAssigned: actionAssignedEmail,
    mentioned: (env, authorName, plan, text, cardId) =>
      mentionedEmail(env, authorName, plan.name, plan.id, text, cardId ?? undefined),
  },
});

// The owner just made a plan: the tenth celebrates, once (docs/specs/014-identity/transactional-email.md #6).
export const notifyMilestone = (env: Env, ownerId: string): Promise<void> =>
  notifier.notifyMilestone(env, ownerId);

// Someone made a share link for the first time (the index's `shared` notice, routes/internal-items.ts).
export const notifyFirstShare = (env: Env, actorId: string): Promise<void> =>
  notifier.notifyFirstShare(env, actorId);

// A signed-in person opened one of an owner's plans through a share link for the first time (the index's `joined`
// notice, run inside the plan's Durable Object). Opt-out (notifyProjectJoin).
export const notifyProjectJoin = (
  env: PlanEnv,
  plan: { id: string; ownerId: string; name: string },
  joinerId: string,
): Promise<void> => notifier.notifyJoin(env, plan, joinerId);

// A teammate assigned the recipient an action on a plan (routes/notify-action-route.ts, after it checked both
// people and the plan). Opt-out (notifyActionAssigned).
export function notifyActionAssigned(
  env: PlanEnv,
  input: {
    assignee: TeamPerson;
    assignerUserId: string;
    assignerName: string | null;
    project: { id: string; name: string };
    assigneeCanOpen: boolean;
    actionName: string;
    description: string | null;
  },
): Promise<void> {
  const { project, ...rest } = input;
  return notifier.notifyActionAssigned(env, { ...rest, item: project });
}

// The author's new comments on a team plan @-mentioned teammates (docs/specs/012-collaboration/comment-mentions.md
// "The email"): each person mentioned gets one email per comment. Opt-out (notifyMentions).
export function notifyMentions(
  env: PlanEnv,
  input: {
    plan: { id: string; name: string; teamId: string | null };
    authorId: string;
    // Who signs the email when the author has no profile name (their verified address).
    authorFallbackName?: string | null;
    comments: readonly Comment[];
    // A plan card's comments: the card the button opens.
    itemId?: string;
  },
): Promise<void> {
  const { plan, itemId, ...rest } = input;
  return notifier.notifyMentions(env, {
    ...rest,
    item: plan,
    mentionsMax: MENTIONS_MAX,
    partId: itemId ?? null,
  });
}
