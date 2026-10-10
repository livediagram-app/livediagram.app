// docs/specs/014-identity/profile-and-email-notifications.md: the two opt-out transactional notifications layered on top of the
// docs/specs/014-identity/transactional-email.md email feature. Both are best-effort, fired from `ctx.waitUntil` on a
// request made by SOMEONE OTHER than the recipient (a visitor opening a shared
// document; an invitee responding to an invite), so the recipient's address
// comes from trusted server state (email_lifecycle / team_members), never the
// caller's headers, and their opt-out is read from user_preferences (docs/specs/007-editor/user-preferences.md).
//
// Like every docs/specs/014-identity/transactional-email.md send these never throw — sendEmail swallows failures — so
// a notification problem can't break the request that triggered it.

import {
  claimCommentNotify,
  claimFirstShare,
  claimJoinNotify,
  claimMilestone,
  claimNotifyEmail,
  getNotificationPrefs,
  getOwnerEmail,
  listTeamAdminUserIds,
} from '../db';
import type { Env } from '../types';
import { emailEnabled, sendEmail } from './client';

// At most one "new comment" email per document per this window (docs/specs/014-identity/transactional-email.md #1), so a
// burst of comments doesn't spam the owner.
const COMMENT_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;
// At most one "someone joined your document" email per document per this window
// (docs/specs/014-identity/profile-and-email-notifications.md (a)): the comment email's rule, for the same reason.
const JOIN_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;
import {
  actionAssignedEmail,
  mentionedEmail,
  commentNotificationEmail,
  documentJoinedEmail,
  inviteResponseEmail,
  firstShareEmail,
  milestoneEmail,
} from './templates';

// The action-assigned and mentioned emails carry text from the request body, so each is claimed before it
// goes (db/notify-email-claims.ts). The same email (sender, document, recipient, text) goes once per this
// window, so a replayed request reaches nobody twice; a day covers any retry or double-submit.
export const NOTIFY_EMAIL_DEDUPE_MS = 24 * 60 * 60 * 1000;
// At most this many of those emails per sender per hour: three comments that each @-mention MENTIONS_MAX
// (20) teammates, far past any real hour of assigning and mentioning, and a ceiling on a scripted session.
// Safe range 20..200.
export const NOTIFY_EMAILS_PER_SENDER_PER_HOUR = 60;
const NOTIFY_RATE_WINDOW_MS = 60 * 60 * 1000;

// The claim key: a SHA-256 over the parts that make two emails the same one. Hashed so the table holds no
// comment text, action names or addresses.
async function notifyEmailKey(parts: (string | null)[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function claimTeamNotifyEmail(
  env: Env,
  senderId: string,
  parts: (string | null)[],
): Promise<boolean> {
  const now = Date.now();
  const claimed = await claimNotifyEmail(env, {
    key: await notifyEmailKey([senderId, ...parts]),
    senderId,
    now,
    dedupeSince: now - NOTIFY_EMAIL_DEDUPE_MS,
    rateSince: now - NOTIFY_RATE_WINDOW_MS,
    rateMax: NOTIFY_EMAILS_PER_SENDER_PER_HOUR,
  });
  if (!claimed)
    console.warn(
      `[notify-email] skipped a ${String(parts[0])} email: duplicate or sender over the hourly cap`,
    );
  return claimed;
}

// docs/specs/012-collaboration/assigned-actions.md: a teammate assigned the recipient an action on a document element.
// Fired by the notify-action route AFTER it has verified both parties are
// joined members of the same team and resolved every string server-side.
// Opt-out (notifyActionAssigned). The assignee's address prefers their
// verified email_lifecycle row, falling back to the team_members invite
// address (both trusted server state, never a client header).
export async function notifyActionAssigned(
  env: Env,
  input: {
    // Null for an invited member with no identified account yet — the
    // fallback (their membership invite address) is the destination
    // then, and prefs default to on (no account, no prefs row).
    assigneeUserId: string | null;
    assigneeFallbackEmail: string | null;
    // The assigner's verified account id: the dedupe key's sender and whose hourly cap the email counts against.
    assignerUserId: string;
    assignerName: string | null;
    document: { id: string; name: string };
    // False when the assignee cannot open the document: the email then names no document and does not link
    // into it (docs/specs/012-collaboration/assigned-actions.md §4).
    assigneeCanOpen: boolean;
    actionName: string;
    description: string | null;
  },
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = input.assigneeUserId
    ? ((await getOwnerEmail(env, input.assigneeUserId)) ?? input.assigneeFallbackEmail)
    : input.assigneeFallbackEmail;
  if (!to) return;
  if (input.assigneeUserId) {
    const prefs = await getNotificationPrefs(env, input.assigneeUserId);
    if (!prefs.notifyActionAssigned) return;
  }
  const claimed = await claimTeamNotifyEmail(env, input.assignerUserId, [
    'action',
    input.document.id,
    input.assigneeUserId ?? `mail:${to}`,
    input.actionName,
    input.description,
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

// docs/specs/012-collaboration/comment-mentions.md: a teammate @-mentioned the recipient in a comment. Fired
// by the notify-mention route after it verified the team, the document and the
// recipient's membership. Opt-out (notifyMentions); an invited member with no
// account has no prefs and is written to at their invite address.
export async function notifyMentioned(
  env: Env,
  input: {
    recipientUserId: string | null;
    recipientFallbackEmail: string | null;
    // The author's verified account id: the dedupe key's sender and whose hourly cap the email counts against.
    authorUserId: string;
    authorName: string | null;
    document: { id: string; name: string };
    commentText: string;
    // A Plan card's comment: the card the button opens.
    itemId?: string;
  },
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = input.recipientUserId
    ? ((await getOwnerEmail(env, input.recipientUserId)) ?? input.recipientFallbackEmail)
    : input.recipientFallbackEmail;
  if (!to) return;
  if (input.recipientUserId) {
    const prefs = await getNotificationPrefs(env, input.recipientUserId);
    if (!prefs.notifyMentions) return;
  }
  const claimed = await claimTeamNotifyEmail(env, input.authorUserId, [
    'mention',
    input.document.id,
    input.itemId ?? null,
    input.recipientUserId ?? `mail:${to}`,
    input.commentText,
  ]);
  if (!claimed) return;
  await sendEmail(env, {
    to,
    ...mentionedEmail(
      env,
      input.authorName,
      input.document.name,
      input.document.id,
      input.commentText,
      input.itemId,
    ),
  });
}

// A signed-in person opened one of an owner's shared documents for the FIRST
// time (recordSharedAccess reported a new row; the route sends only for a
// verified visitor, never a guest id). No-op unless email is on, the owner has
// a stored verified address (a Clerk owner, guests have none), and the owner
// hasn't opted out. Throttled per document so a run of joins is one email.
export async function notifyDocumentJoin(
  env: Env,
  liveDoc: { id: string; ownerId: string; name: string },
  joinerName: string | null,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await getOwnerEmail(env, liveDoc.ownerId);
  if (!to) return;
  const prefs = await getNotificationPrefs(env, liveDoc.ownerId);
  if (!prefs.notifyDocumentJoin) return;
  const now = Date.now();
  if (!(await claimJoinNotify(env, liveDoc.id, now, now - JOIN_NOTIFY_THROTTLE_MS))) return;
  await sendEmail(env, { to, ...documentJoinedEmail(env, liveDoc.name, joinerName) });
}

// An invitee accepted / declined a team invite. Tells each JOINED admin of the
// team (other than the responder themselves) who has a known address and
// hasn't opted out. Sends run concurrently; each is independently best-effort.
export async function notifyInviteResponse(
  env: Env,
  team: { id: string; name: string },
  responderEmail: string,
  accepted: boolean,
  responderUserId: string | null,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const adminIds = await listTeamAdminUserIds(env, team.id);
  await Promise.all(
    adminIds.map(async (adminId) => {
      // Don't notify the responder about their own action (an admin can be
      // re-invited as a member and respond to that).
      if (responderUserId && adminId === responderUserId) return;
      const to = await getOwnerEmail(env, adminId);
      if (!to) return;
      const prefs = await getNotificationPrefs(env, adminId);
      if (!prefs.notifyInviteResponse) return;
      await sendEmail(env, {
        to,
        ...inviteResponseEmail(env, team.name, responderEmail, accepted),
      });
    }),
  );
}

// Someone OTHER than the owner left a comment on a document the owner owns
// (docs/specs/014-identity/transactional-email.md #1). Immediate, opt-out (notifyComments). Best-effort; never blocks
// the comment write. The comment text is deliberately NOT included.
export async function notifyNewComment(
  env: Env,
  liveDoc: { id: string; ownerId: string; name: string },
  commenterName: string | null,
): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await getOwnerEmail(env, liveDoc.ownerId);
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

// docs/specs/014-identity/transactional-email.md (#6): the document counts that trigger a milestone email. Just the
// tenth for now; the single milestone_sent_at column fires once per owner.
const MILESTONE_DOCUMENT_COUNTS = [10];

// Celebrate when an owner reaches a document-count milestone (docs/specs/014-identity/transactional-email.md #6).
// Opt-out (notifyMilestones). The atomic claim means a burst of saves at the
// milestone count sends exactly one email. Best-effort; never blocks the write.
export async function notifyMilestone(
  env: Env,
  ownerId: string,
  documentCount: number,
): Promise<void> {
  if (!emailEnabled(env)) return;
  if (!MILESTONE_DOCUMENT_COUNTS.includes(documentCount)) return;
  const to = await getOwnerEmail(env, ownerId);
  if (!to) return;
  const prefs = await getNotificationPrefs(env, ownerId);
  if (!prefs.notifyMilestones) return;
  if (!(await claimMilestone(env, ownerId))) return;
  await sendEmail(env, { to, ...milestoneEmail(env, documentCount) });
}

// First-ever share link is a milestone (docs/specs/014-identity/transactional-email.md #6). Opt-out (notifyMilestones).
// Same claim-then-send shape as notifyMilestone; the atomic claim fires it once.
export async function notifyFirstShare(env: Env, ownerId: string): Promise<void> {
  if (!emailEnabled(env)) return;
  const to = await getOwnerEmail(env, ownerId);
  if (!to) return;
  const prefs = await getNotificationPrefs(env, ownerId);
  if (!prefs.notifyMilestones) return;
  if (!(await claimFirstShare(env, ownerId))) return;
  await sendEmail(env, { to, ...firstShareEmail(env) });
}
