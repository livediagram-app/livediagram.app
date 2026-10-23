// docs/specs/014-identity/profile-and-email-notifications.md: the opt-out transactional notifications layered on top
// of the docs/specs/014-identity/transactional-email.md email feature: a new comment, someone joining a shared design,
// an action assigned, a mention, and the two milestones (the tenth design and the first share link). Each is best-effort, fired from `waitUntil` on a request made by SOMEONE OTHER than the
// recipient (or, for a milestone, after the owner's own write), so the recipient's address is their verified one
// at the liveworkspace accounts Worker, never the caller's headers, and their opt-out is read from their settings
// there (accounts/notify.ts, accounts/settings.ts, docs/specs/007-editor/user-preferences.md). The rules every app
// shares (the milestone counts, the windows, the hourly cap) are @liveworkspace/auth-client's notify.ts; the
// once-only state is accounts' (the milestones) or the design's own (@liveworkspace/index-app notify-claims.ts).
//
// Like every docs/specs/014-identity/transactional-email.md send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import { claimNotice, claimNotices, workbenchAllowance } from '@liveworkspace/index-app';
import {
  JOIN_NOTIFY_THROTTLE_MS,
  MILESTONE_ITEM_COUNTS,
  NOTIFY_EMAIL_DEDUPE_MS,
  NOTIFY_EMAILS_PER_SENDER_PER_HOUR,
  NOTIFY_RATE_WINDOW_MS,
  notifyClaimKey,
  reachedMilestone,
  teamTargets,
  type TeamPerson,
} from '@liveworkspace/auth-client';
import { MENTIONS_MAX, type Comment } from '@livedesign/design';
import { emailOf } from '../accounts/people';
import {
  claimOwnerMilestone,
  notifyRecipients,
  designsMadeBy,
  teamPeople,
} from '../accounts/notify';
import { isAccountOwner } from '../accounts/client';
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

// ---------- Milestones (docs/specs/014-identity/transactional-email.md #6) ----------------------------------------

// The owner just made a design: when it brings them to a design-count milestone (the tenth), celebrate it once.
// Opt-out (notifyMilestones). The count is the index's (every design they have made, the Trash's included), asked
// only up to the milestone, so it costs the same however many designs they have; the claim at accounts means a
// burst of creates sends exactly one email. Best-effort; never blocks the write.
export async function notifyMilestone(env: Env, ownerId: string): Promise<void> {
  if (!emailEnabled(env) || !isAccountOwner(ownerId)) return;
  const reached = reachedMilestone(
    await designsMadeBy(env, ownerId, Math.max(...MILESTONE_ITEM_COUNTS)),
  );
  if (reached === null) return;
  const to = (await notifyRecipients(env, [ownerId], 'notifyMilestones')).get(ownerId);
  if (!to) return;
  if (!(await claimOwnerMilestone(env, ownerId, 'milestone'))) return;
  await sendEmail(env, { to, ...milestoneEmail(env, reached) });
}

// Someone made a share link for the first time (the index's `shared` notice, routes/internal-items.ts). Opt-out
// (notifyMilestones), the same category as the design-count milestone; claimed once per account at accounts.
export async function notifyFirstShare(env: Env, actorId: string): Promise<void> {
  if (!emailEnabled(env) || !isAccountOwner(actorId)) return;
  const to = (await notifyRecipients(env, [actorId], 'notifyMilestones')).get(actorId);
  if (!to) return;
  if (!(await claimOwnerMilestone(env, actorId, 'firstShare'))) return;
  await sendEmail(env, { to, ...firstShareEmail(env) });
}

// ---------- Someone joined my design (profile-and-email-notifications.md (a)) ---------------------------------------

// A signed-in person opened one of an owner's designs through a share link for the first time (the index's
// `joined` notice, run inside the design's Durable Object). Never for a guest, never for the owner. Opt-out
// (notifyDesignJoin); throttled per design so a run of joins is one email.
export async function notifyDesignJoin(
  env: DesignEnv,
  design: { id: string; ownerId: string; name: string },
  joinerId: string,
): Promise<void> {
  if (!emailEnabled(env) || !isAccountOwner(joinerId) || joinerId === design.ownerId) return;
  const to = (await notifyRecipients(env, [design.ownerId], 'notifyDesignJoin')).get(
    design.ownerId,
  );
  if (!to) return;
  const now = Date.now();
  const claimed = await claimNotice(env.DESIGN_DB, {
    key: 'join',
    sender: design.ownerId,
    now,
    dedupeSince: now - JOIN_NOTIFY_THROTTLE_MS,
  });
  if (!claimed) return;
  const joiner = await getParticipant(env, joinerId);
  await sendEmail(env, { to, ...designJoinedEmail(env, design.name, joiner?.name ?? null) });
}

// ---------- Actions assigned and mentions (assigned-actions.md, comment-mentions.md) -----------------------------

// The action-assigned and mentioned emails carry the sender's words, so each is claimed in the design before it
// goes: the same email (sender, design, recipient, wording) once a day, and NOTIFY_EMAILS_PER_SENDER_PER_HOUR per
// sender at most, counted across every design in the sender's own store (@liveworkspace/index-app notify-claims.ts).
async function claimTeamNotices(
  env: DesignEnv,
  senderId: string,
  emails: (string | null)[][],
): Promise<boolean[]> {
  const now = Date.now();
  const keys = await Promise.all(emails.map((parts) => notifyClaimKey([senderId, ...parts])));
  const allowed = await claimNotices(
    env.DESIGN_DB,
    keys.map((key) => ({
      key,
      sender: senderId,
      now,
      dedupeSince: now - NOTIFY_EMAIL_DEDUPE_MS,
      rate: { max: NOTIFY_EMAILS_PER_SENDER_PER_HOUR, windowMs: NOTIFY_RATE_WINDOW_MS },
    })),
    workbenchAllowance(env.WORKBENCH),
  );
  const skipped = allowed.filter((ok) => !ok).length;
  if (skipped > 0)
    console.warn(
      `[notify-email] skipped ${skipped} ${String(emails[0]?.[0])} email(s): duplicate or sender over the hourly cap`,
    );
  return allowed;
}

async function claimTeamNotice(
  env: DesignEnv,
  senderId: string,
  parts: (string | null)[],
): Promise<boolean> {
  const [allowed] = await claimTeamNotices(env, senderId, [parts]);
  return allowed === true;
}

// Where each of these team people's email goes: an account's verified address unless they turned `setting` off,
// an invited person's invite address (no account, so no switch: on).
async function teamAddresses(
  env: Env,
  people: readonly TeamPerson[],
  setting: 'notifyActionAssigned' | 'notifyMentions',
): Promise<Map<string, string>> {
  const accounts = people.flatMap((p) => (p.userId ? [p.userId] : []));
  const verified =
    accounts.length > 0
      ? await notifyRecipients(env, accounts, setting)
      : new Map<string, string>();
  const out = new Map<string, string>();
  for (const p of people) {
    const to = p.userId ? verified.get(p.userId) : p.email;
    if (to) out.set(p.id, to);
  }
  return out;
}

// A teammate assigned the recipient an action on a design (routes/notify-action-route.ts, after it checked both
// people and the design). Opt-out (notifyActionAssigned).
export async function notifyActionAssigned(
  env: DesignEnv,
  input: {
    assignee: TeamPerson;
    // The assigner's verified account id: the claim's sender and whose hourly cap the email counts against.
    assignerUserId: string;
    assignerName: string | null;
    design: { id: string; name: string };
    // False when the assignee cannot open the design: the email then names no design and does not link into it
    // (docs/specs/012-collaboration/assigned-actions.md §4).
    assigneeCanOpen: boolean;
    actionName: string;
    description: string | null;
  },
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = (await teamAddresses(env, [input.assignee], 'notifyActionAssigned')).get(
    input.assignee.id,
  );
  if (!to) return;
  const claimed = await claimTeamNotice(env, input.assignerUserId, [
    'action',
    input.design.id,
    input.assignee.userId ?? `mail:${to}`,
    input.actionName,
    input.description,
  ]);
  if (!claimed) return;
  await sendEmail(env, {
    to,
    ...actionAssignedEmail(
      env,
      input.assignerName,
      input.assigneeCanOpen ? input.design : null,
      input.actionName,
      input.description,
    ),
  });
}

// The author's new comments on a team design @-mentioned teammates (docs/specs/012-collaboration/comment-mentions.md
// "The email"): each person mentioned gets one email per comment. A mention only ever reaches the design's own team,
// and only from one of its joined members; anyone else a comment names is skipped. Opt-out (notifyMentions); an
// invited person with no account yet is written to at their invite address. One team read and one recipients
// read, whatever the number of comments and mentions.
export async function notifyMentions(
  env: DesignEnv,
  input: {
    design: { id: string; name: string; teamId: string | null };
    authorId: string;
    // Who signs the email when the author has no profile name (their verified address).
    authorFallbackName?: string | null;
    comments: readonly Comment[];
  },
): Promise<void> {
  const { design, authorId } = input;
  if (!emailEnabled(env) || !design.teamId || !isAccountOwner(authorId)) return;
  const mentioning = input.comments.filter((c) => (c.mentions?.length ?? 0) > 0);
  if (mentioning.length === 0) return;
  const people = await teamPeople(env, design.teamId);
  if (!people?.some((p) => p.userId === authorId && p.status === 'joined')) return;
  const sends = mentioning.map((c) => ({
    comment: c,
    to: teamTargets(people, c.mentions!.slice(0, MENTIONS_MAX), authorId),
  }));
  const everyone = new Map(sends.flatMap((s) => s.to).map((p) => [p.id, p]));
  if (everyone.size === 0) return;
  const [addresses, author] = await Promise.all([
    teamAddresses(env, [...everyone.values()], 'notifyMentions'),
    getParticipant(env, authorId),
  ]);
  const authorName = author?.name ?? input.authorFallbackName ?? null;
  // Every email this save may send, claimed together: one batch in the design and one call to the author's store.
  const pending: { to: string; comment: Comment; parts: (string | null)[] }[] = [];
  for (const { comment, to: recipients } of sends) {
    for (const person of recipients) {
      const to = addresses.get(person.id);
      if (!to) continue;
      pending.push({
        to,
        comment,
        parts: ['mention', design.id, null, person.userId ?? `mail:${to}`, `comment:${comment.id}`],
      });
    }
  }
  const allowed = await claimTeamNotices(
    env,
    authorId,
    pending.map((p) => p.parts),
  );
  await Promise.all(
    pending
      .filter((_, i) => allowed[i])
      .map(({ to, comment }) =>
        sendEmail(env, {
          to,
          ...mentionedEmail(env, authorName, design.name, design.id, comment.text),
        }),
      ),
  );
}
