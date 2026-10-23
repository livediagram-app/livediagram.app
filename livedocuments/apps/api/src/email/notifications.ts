// docs/specs/014-identity/profile-and-email-notifications.md: the opt-out transactional notifications layered on top
// of the docs/specs/014-identity/transactional-email.md email feature: a new comment, someone joining a shared
// document, an action assigned, a mention, and the two milestones (the tenth document and the first share link). Each is best-effort, fired from `waitUntil` on a request made by SOMEONE OTHER than the
// recipient (or, for a milestone, after the owner's own write), so the recipient's address is their verified one
// at the liveworkspace accounts Worker, never the caller's headers, and their opt-out is read from their settings
// there (person/notify.ts, person/settings.ts, docs/specs/007-editor/user-preferences.md). The rules every app
// shares (the milestone counts, the windows, the hourly cap) are @liveworkspace/auth-client's notify.ts; the
// once-only state is accounts' (the milestones) or the document's own (document-room/notify-claims.ts).
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
  teamTargets,
  type TeamPerson,
} from '@liveworkspace/auth-client';
import { MENTIONS_MAX, type Comment } from '@livedocuments/document';
import { ownerEmail } from '../person/account-app';
import { claimOwnerMilestone, notifyRecipients, documentsMadeBy, teamPeople } from '../person/notify';
import { isAccountOwner } from '../person/owner';
import { getParticipant } from '../person/profiles';
import { getNotificationPrefs } from '../person/settings';
import { claimCommentNotify } from '../document-room/document-content';
import { claimNotice } from '../document-room/notify-claims';
import type { Env, DocumentEnv } from '../types';
import { emailEnabled, sendEmail } from './client';

// At most one "new comment" email per document per this window (docs/specs/014-identity/transactional-email.md #1), so a
// burst of comments doesn't spam the owner.
const COMMENT_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;
import {
  actionAssignedEmail,
  commentNotificationEmail,
  firstShareEmail,
  mentionedEmail,
  milestoneEmail,
  documentJoinedEmail,
} from './templates';

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

// ---------- Milestones (docs/specs/014-identity/transactional-email.md #6) ----------------------------------------

// The highest milestone `count` has reached, or null for none.
function reachedMilestone(count: number | null): number | null {
  if (count === null) return null;
  let reached: number | null = null;
  for (const m of MILESTONE_ITEM_COUNTS)
    if (count >= m && (reached === null || m > reached)) reached = m;
  return reached;
}

// The owner just made a document: when it brings them to a document-count milestone (the tenth), celebrate it once.
// Opt-out (notifyMilestones). The count is the index's (every document they have made, the Trash's included), asked
// only up to the milestone, so it costs the same however many documents they have; the claim at accounts means a
// burst of creates sends exactly one email. Best-effort; never blocks the write.
export async function notifyMilestone(env: Env, ownerId: string): Promise<void> {
  if (!emailEnabled(env) || !isAccountOwner(ownerId)) return;
  const reached = reachedMilestone(
    await documentsMadeBy(env, ownerId, Math.max(...MILESTONE_ITEM_COUNTS)),
  );
  if (reached === null) return;
  const to = (await notifyRecipients(env, [ownerId], 'notifyMilestones')).get(ownerId);
  if (!to) return;
  if (!(await claimOwnerMilestone(env, ownerId, 'milestone'))) return;
  await sendEmail(env, { to, ...milestoneEmail(env, reached) });
}

// Someone made a share link for the first time (the index's `shared` notice, routes/internal-items.ts). Opt-out
// (notifyMilestones), the same category as the document-count milestone; claimed once per account at accounts.
export async function notifyFirstShare(env: Env, actorId: string): Promise<void> {
  if (!emailEnabled(env) || !isAccountOwner(actorId)) return;
  const to = (await notifyRecipients(env, [actorId], 'notifyMilestones')).get(actorId);
  if (!to) return;
  if (!(await claimOwnerMilestone(env, actorId, 'firstShare'))) return;
  await sendEmail(env, { to, ...firstShareEmail(env) });
}

// ---------- Someone joined my document (profile-and-email-notifications.md (a)) ---------------------------------------

// A signed-in person opened one of an owner's documents through a share link for the first time (the index's
// `joined` notice, run inside the document's Durable Object). Never for a guest, never for the owner. Opt-out
// (notifyDocumentJoin); throttled per document so a run of joins is one email.
export async function notifyDocumentJoin(
  env: DocumentEnv,
  document: { id: string; ownerId: string; name: string },
  joinerId: string,
): Promise<void> {
  if (!emailEnabled(env) || !isAccountOwner(joinerId) || joinerId === document.ownerId) return;
  const to = (await notifyRecipients(env, [document.ownerId], 'notifyDocumentJoin')).get(document.ownerId);
  if (!to) return;
  const now = Date.now();
  const claimed = await claimNotice(env, {
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

// The action-assigned and mentioned emails carry the sender's words, so each is claimed in the document before it
// goes: the same email (sender, document, recipient, wording) once a day, and NOTIFY_EMAILS_PER_SENDER_PER_HOUR per
// sender at most.
async function claimTeamNotice(
  env: DocumentEnv,
  senderId: string,
  parts: (string | null)[],
): Promise<boolean> {
  const now = Date.now();
  const claimed = await claimNotice(env, {
    key: await notifyClaimKey([senderId, ...parts]),
    sender: senderId,
    now,
    dedupeSince: now - NOTIFY_EMAIL_DEDUPE_MS,
    rate: { since: now - NOTIFY_RATE_WINDOW_MS, max: NOTIFY_EMAILS_PER_SENDER_PER_HOUR },
  });
  if (!claimed)
    console.warn(
      `[notify-email] skipped a ${String(parts[0])} email: duplicate or sender over the hourly cap`,
    );
  return claimed;
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

// A teammate assigned the recipient an action on a document (routes/notify-action-route.ts, after it checked both
// people and the document). Opt-out (notifyActionAssigned).
export async function notifyActionAssigned(
  env: DocumentEnv,
  input: {
    assignee: TeamPerson;
    // The assigner's verified account id: the claim's sender and whose hourly cap the email counts against.
    assignerUserId: string;
    assignerName: string | null;
    document: { id: string; name: string };
    // False when the assignee cannot open the document: the email then names no document and does not link into it
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
    input.document.id,
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
      input.assigneeCanOpen ? input.document : null,
      input.actionName,
      input.description,
    ),
  });
}

// The author's new comments on a team document @-mentioned teammates (docs/specs/012-collaboration/comment-mentions.md
// "The email"): each person mentioned gets one email per comment. A mention only ever reaches the document's own team,
// and only from one of its joined members; anyone else a comment names is skipped. Opt-out (notifyMentions); an
// invited person with no account yet is written to at their invite address. One team read and one recipients
// read, whatever the number of comments and mentions.
export async function notifyMentions(
  env: DocumentEnv,
  input: {
    document: { id: string; name: string; teamId: string | null };
    authorId: string;
    // Who signs the email when the author has no profile name (their verified address).
    authorFallbackName?: string | null;
    comments: readonly Comment[];
  },
): Promise<void> {
  const { document, authorId } = input;
  if (!emailEnabled(env) || !document.teamId || !isAccountOwner(authorId)) return;
  const mentioning = input.comments.filter((c) => (c.mentions?.length ?? 0) > 0);
  if (mentioning.length === 0) return;
  const people = await teamPeople(env, document.teamId);
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
  const work: Promise<unknown>[] = [];
  for (const { comment, to: recipients } of sends) {
    for (const person of recipients) {
      const to = addresses.get(person.id);
      if (!to) continue;
      const claimed = await claimTeamNotice(env, authorId, [
        'mention',
        document.id,
        person.userId ?? `mail:${to}`,
        `comment:${comment.id}`,
      ]);
      if (!claimed) continue;
      work.push(
        sendEmail(env, {
          to,
          ...mentionedEmail(env, authorName, document.name, document.id, comment.text),
        }),
      );
    }
  }
  await Promise.all(work);
}
