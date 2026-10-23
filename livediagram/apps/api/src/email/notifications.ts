// docs/specs/014-identity/profile-and-email-notifications.md: the opt-out transactional notifications layered on top
// of the docs/specs/014-identity/transactional-email.md email feature: a new comment, someone joining a shared
// canvas, an action assigned, a mention, and the two milestones (the tenth canvas and the first share link). Each is
// best-effort, fired from `waitUntil` on a request made by SOMEONE OTHER than the recipient (or, for a milestone,
// after the owner's own write), so the recipient's address is their verified one at the liveworkspace accounts
// Worker, never the caller's headers, and their opt-out is read from their settings there (liveworkspace/notify.ts,
// docs/specs/007-editor/user-preferences.md). The rules every app shares (the milestone counts, the windows, the
// hourly cap) are @liveworkspace/auth-client's notify.ts; the once-only state is accounts' (the milestones) or the
// canvas's own (@liveworkspace/index-app notify-claims.ts).
//
// Like every docs/specs/014-identity/transactional-email.md send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import {
  JOIN_NOTIFY_THROTTLE_MS,
  MILESTONE_ITEM_COUNTS,
  NOTIFY_EMAIL_DEDUPE_MS,
  NOTIFY_EMAILS_PER_SENDER_PER_HOUR,
  NOTIFY_RATE_WINDOW_MS,
  notifyClaimKey,
  reachedMilestone,
  type TeamPerson,
} from '@liveworkspace/auth-client';
import { claimNotice, claimNotices, workbenchAllowance } from '@liveworkspace/index-app';
import { isAccountIdShape } from '@livediagram/api-schema';
import { claimCommentNotify } from '../document-room/document-content';
import { claimMilestone } from '../liveworkspace/emails';
import { canvasesMadeBy, notifyRecipients, type NotifySetting } from '../liveworkspace/notify';
import { getParticipant } from '../liveworkspace/profiles';
import type { DocumentEnv, Env } from '../types';
import { emailEnabled, sendEmail } from './client';
import {
  actionAssignedEmail,
  commentNotificationEmail,
  documentJoinedEmail,
  firstShareEmail,
  mentionedEmail,
  milestoneEmail,
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

// ---------- Milestones (docs/specs/014-identity/transactional-email.md #6) ----------------------------------------

// The owner just made a canvas: when it brings them to a canvas-count milestone (the tenth), celebrate it once.
// Opt-out (notifyMilestones). The count is the index's (every canvas they have made, the Trash's included), asked
// only up to the milestone, so it costs the same however many canvases they have; the claim at accounts means a
// burst of creates sends exactly one email. Best-effort; never blocks the write.
export async function notifyMilestone(env: Env, ownerId: string): Promise<void> {
  if (!emailEnabled(env) || !isAccountIdShape(ownerId)) return;
  const reached = reachedMilestone(
    await canvasesMadeBy(env, ownerId, Math.max(...MILESTONE_ITEM_COUNTS)),
  );
  if (reached === null) return;
  const to = await recipient(env, ownerId, 'notifyMilestones');
  if (!to) return;
  if (!(await claimMilestone(env, ownerId, 'milestone'))) return;
  await sendEmail(env, { to, ...milestoneEmail(env, reached) });
}

// Someone made a share link for the first time (the index's `shared` notice, routes/internal-items.ts). Opt-out
// (notifyMilestones), the same category as the canvas-count milestone; claimed once per account at accounts.
export async function notifyFirstShare(env: Env, actorId: string): Promise<void> {
  if (!emailEnabled(env) || !isAccountIdShape(actorId)) return;
  const to = await recipient(env, actorId, 'notifyMilestones');
  if (!to) return;
  if (!(await claimMilestone(env, actorId, 'firstShare'))) return;
  await sendEmail(env, { to, ...firstShareEmail(env) });
}

// ---------- Someone joined my canvas (profile-and-email-notifications.md (a)) -----------------------------------------

// A signed-in person opened one of an owner's canvases through a share link for the first time (the index's
// `joined` notice, run inside the canvas's Durable Object). Never for a guest, never for the owner. Opt-out
// (notifyDocumentJoin); throttled per canvas so a run of joins is one email.
export async function notifyDocumentJoin(
  env: DocumentEnv,
  document: { id: string; ownerId: string; name: string },
  joinerId: string,
): Promise<void> {
  if (!emailEnabled(env) || !isAccountIdShape(joinerId) || joinerId === document.ownerId) return;
  if (!isAccountIdShape(document.ownerId)) return;
  const to = await recipient(env, document.ownerId, 'notifyDocumentJoin');
  if (!to) return;
  const now = Date.now();
  const claimed = await claimNotice(env.DOCUMENT_DB, {
    key: 'join',
    sender: document.ownerId,
    now,
    dedupeSince: now - JOIN_NOTIFY_THROTTLE_MS,
  });
  if (!claimed) return;
  const joiner = await getParticipant(env, joinerId);
  await sendEmail(env, { to, ...documentJoinedEmail(env, document.name, joiner?.name ?? null) });
}

// ---------- Actions assigned and mentions (assigned-actions.md, comment-mentions.md) -----------------------------

// The action-assigned and mentioned emails carry the sender's words, so each is claimed in the canvas before it
// goes: the same email (sender, canvas, recipient, wording) once a day, and NOTIFY_EMAILS_PER_SENDER_PER_HOUR per
// sender at most, counted across every canvas in the sender's own store (@liveworkspace/index-app notify-claims.ts).
async function claimTeamNotices(
  env: DocumentEnv,
  senderId: string,
  emails: (string | null)[][],
): Promise<boolean[]> {
  const now = Date.now();
  const keys = await Promise.all(emails.map((parts) => notifyClaimKey([senderId, ...parts])));
  const allowed = await claimNotices(
    env.DOCUMENT_DB,
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

// A teammate assigned the recipient an action on a canvas element (routes/notify-routes.ts, after it checked both
// people and the canvas). Opt-out (notifyActionAssigned).
export async function notifyActionAssigned(
  env: DocumentEnv,
  input: {
    assignee: TeamPerson;
    // The assigner's verified account id: the claim's sender and whose hourly cap the email counts against.
    assignerUserId: string;
    assignerName: string | null;
    document: { id: string; name: string };
    // False when the assignee cannot open the canvas: the email then names no canvas and does not link into it
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
  const [claimed] = await claimTeamNotices(env, input.assignerUserId, [
    [
      'action',
      input.document.id,
      input.assignee.userId ?? `mail:${to}`,
      input.actionName,
      input.description,
    ],
  ]);
  if (!claimed) return;
  await sendEmail(env, {
    to,
    ...actionAssignedEmail(
      env,
      input.assignerName,
      input.assigneeCanOpen ? input.document : null,
      input.actionName,
      input.description,
    ),
  });
}

// A teammate's comment @-mentioned these people (docs/specs/012-collaboration/comment-mentions.md "The email"):
// each gets one email for it. The notify-mention route checked the canvas is the team's, the author one of its joined
// people and each recipient one of its people other than the author. Opt-out (notifyMentions); an invited person with
// no account yet is written to at their invite address. One recipients read and one claim batch, whatever the number
// mentioned. A canvas comment reaches the canvas's storage only with the next tab save, so the route carries its text.
export async function notifyMentioned(
  env: DocumentEnv,
  input: {
    recipients: readonly TeamPerson[];
    // The author's verified account id: the claim's sender and whose hourly cap the emails count against.
    authorUserId: string;
    authorName: string | null;
    document: { id: string; name: string };
    commentText: string;
  },
): Promise<void> {
  if (!emailEnabled(env) || input.recipients.length === 0) return;
  const addresses = await teamAddresses(env, input.recipients, 'notifyMentions');
  const pending = input.recipients.flatMap((person) => {
    const to = addresses.get(person.id);
    return to
      ? [
          {
            to,
            parts: [
              'mention',
              input.document.id,
              null,
              person.userId ?? `mail:${to}`,
              input.commentText,
            ],
          },
        ]
      : [];
  });
  if (pending.length === 0) return;
  const allowed = await claimTeamNotices(
    env,
    input.authorUserId,
    pending.map((p) => p.parts),
  );
  const email = mentionedEmail(
    env,
    input.authorName,
    input.document.name,
    input.document.id,
    input.commentText,
  );
  await Promise.all(
    pending.filter((_, i) => allowed[i]).map(({ to }) => sendEmail(env, { to, ...email })),
  );
}
