// The Knowledgebase Reviews emails (docs/specs/030-knowledgebase/verification.md "Reminders", ai-knowledge.md "Pages
// that disagree", "Knowledge Health"), sent through the platform's notifier (`notifyKnowledgeReviews`,
// email/notifications.ts), so each goes to an account's verified address and only while its Knowledgebase Reviews
// switch is on. Nothing here holds an address.
//
//   - Review Due: the room's alarm (`review-email`, knowledge-work.ts) wakes when the next review comes due and tells
//     each owner once of the pages newly due, in one email that lists all their due pages, a day apart at least.
//   - Remind the Owners: an Editor's press; one email an owner of their due and never-verified pages, once a week.
//   - Ask Both Owners: an Editor's press on a conflict; one email each owner of the two pages, once a conflict.
//
// Every recipient is checked to still reach the knowledgebase before an email names its pages, the three kinds
// share a ceiling of 50 emails a day (`reserveEmails`), and the marks that keep each cap are the room's
// (email-marks.ts). A knowledgebase kept Offline has no room, so none of this runs for one.
import { isAccountId } from '@liveworkspace/auth-client';
import type { KnowledgeEmailResult } from '@liveknowledge/api-schema';
import { parseKnowledgeFields, trustState, verificationOn } from '@liveknowledge/knowledge';
import { getDocument } from '../db';
import { emailEnabled } from '../email/client';
import { notifyKnowledgeReviews } from '../email/notifications';
import {
  pagesDisagreeEmail,
  remindOwnersEmail,
  reviewDueEmail,
  type EmailConflict,
  type EmailPage,
} from '../email/knowledge-templates';
import type { RenderedEmail } from '../email/templates';
import { requestGrant } from '../index-service';
import { teamPeople } from '../person/notify';
import type { DocumentDTO, DocumentEnv } from '../types';
import { claimMark, dropMark, marksOf, putMarks, reserveEmails } from './email-marks';
import { REMIND_OWNERS_GAP_MS, REVIEW_EMAIL_GAP_MS } from './knowledge-review-timing';
import { REVIEW_DUE_EVENT } from '@liveknowledge/document/automations';
import { hearsKnowledge } from '../document-room/automations/knowledge-events';
import { queueReviewsDue } from '../document-room/automations/review-events';
import type { Work } from './knowledge-work';
import { noteReviewsLapsed } from './watch-review';

const DAY_MS = 86_400_000;

/** What an email route answers: what was sent, or why nothing was. */
export type KnowledgeEmailOutcome = KnowledgeEmailResult;

type OwnedPage = EmailPage & { owner: string; verifiedAt?: number };

// Each page with what its stored fields, the knowledgebase's Review Period (read once, with the document) and
// the clock say (`trustState`): no page's writing is read.
export function pagesOf(document: DocumentDTO, now: number) {
  const { reviewEvery } = document.knowledgeSettings;
  // A connected file in the tree is no page: nobody answers for it (links-and-embeds.md).
  return document.tabs.flatMap((tab) => {
    if (tab.connection) return [];
    const fields = parseKnowledgeFields(tab.knowledge);
    const trust = trustState(fields, reviewEvery, now);
    return [{ tab: tab.id, title: tab.name, owner: fields.owner, ...trust }];
  });
}

const byOwner = (pages: readonly OwnedPage[]): Map<string, OwnedPage[]> => {
  const owners = new Map<string, OwnedPage[]>();
  for (const page of pages) owners.set(page.owner, [...(owners.get(page.owner) ?? []), page]);
  return owners;
};

/**
 * Who of these owners can still open the knowledgebase: an email names its pages, so someone who has left is told
 * nothing. The knowledgebase's own owner can; so can a joined member of its team (one read of the team); anyone
 * else is asked of the index, as when they were made a page's owner. A check that fails counts as no.
 */
export async function ownersWhoReach(
  env: DocumentEnv,
  document: Pick<DocumentDTO, 'id' | 'ownerId' | 'teamId'>,
  owners: readonly string[],
): Promise<string[]> {
  const accounts = owners.filter(isAccountId);
  if (accounts.length === 0) return [];
  const team = document.teamId ? await teamPeople(env, document.teamId) : null;
  const joined = new Set(
    (team ?? []).flatMap((p) => (p.status === 'joined' && p.userId ? [p.userId] : [])),
  );
  const reach: string[] = [];
  for (const owner of accounts) {
    if (owner === document.ownerId || joined.has(owner)) {
      reach.push(owner);
      continue;
    }
    const grant = await requestGrant(
      env,
      { kind: 'delegate', personId: owner, teams: [] },
      document.id,
      null,
    ).catch(() => ({ ok: false }));
    if (grant.ok) reach.push(owner);
  }
  return reach;
}

// Send each of these owners their email, within what is left of the day. Answers who was emailed, and who was
// left for another day by the ceiling.
async function sendTo(
  env: DocumentEnv,
  document: DocumentDTO,
  emails: ReadonlyMap<string, RenderedEmail>,
  now: number,
): Promise<{ sent: string[]; tried: string[]; held: string[] }> {
  const reach = await ownersWhoReach(env, document, [...emails.keys()]);
  const allowed = await reserveEmails(env, reach.length, now);
  const tried = reach.slice(0, allowed);
  const sent = await notifyKnowledgeReviews(
    env,
    new Map(tried.map((owner) => [owner, emails.get(owner)!])),
  );
  return { sent, tried, held: reach.slice(allowed) };
}

/**
 * The alarm's review check. Tells each owner of their pages newly due (a page is new until its owner was told of
 * this review date), then answers when to look again: the next review that comes due, or sooner for an owner the
 * day's rule or the ceiling held back. Null when nothing is left to wait for.
 */
export async function runReviewEmails(
  env: DocumentEnv,
  documentId: string,
  now: number,
): Promise<number | null> {
  if (!emailEnabled(env)) {
    console.info('[knowledge] email not sent', { documentId, kind: 'review', reason: 'email_off' });
    return null;
  }
  const document = await getDocument(env, documentId);
  if (!document) return null;
  const pages = pagesOf(document, now);
  const upcoming = pages.flatMap((p) => (p.state === 'verified' && p.reviewAt ? [p.reviewAt] : []));
  let next = upcoming.length > 0 ? Math.min(...upcoming) : null;
  const sooner = (at: number) => {
    next = next === null ? at : Math.min(next, at);
  };
  const due = pages.flatMap((p): OwnedPage[] =>
    p.state === 'review-due' && p.owner
      ? [{ tab: p.tab, title: p.title, owner: p.owner, verifiedAt: p.verifiedAt }]
      : [],
  );
  if (due.length === 0) return next;
  const [told, lastSent] = await Promise.all([
    marksOf(env, 'review-page'),
    marksOf(env, 'review-owner'),
  ]);
  const emails = new Map<string, RenderedEmail>();
  const owed = new Map<string, OwnedPage[]>();
  for (const [owner, own] of byOwner(due)) {
    // A page is new until its owner was told of the review of this verification: a change of Review Period moves
    // when it is due, never whether they were told.
    if (!own.some((page) => told.get(page.tab) !== page.verifiedAt)) continue;
    const last = lastSent.get(owner);
    if (last !== undefined && last > now - REVIEW_EMAIL_GAP_MS) {
      sooner(last + REVIEW_EMAIL_GAP_MS);
      continue;
    }
    owed.set(owner, own);
    emails.set(owner, reviewDueEmail(env, document, own));
  }
  if (emails.size === 0) return next;
  const { sent, tried, held } = await sendTo(env, document, emails, now);
  if (held.length > 0) sooner((Math.floor(now / DAY_MS) + 1) * DAY_MS);
  // Told, or not to be told (the switch is off, or the knowledgebase is no longer theirs to open): either way these
  // pages are settled until they are verified and come due again. An owner the ceiling held back keeps theirs.
  const waiting = new Set(held);
  const settled = [...owed].flatMap(([owner, own]) => (waiting.has(owner) ? [] : own));
  await putMarks(
    env,
    'review-page',
    settled.map((page) => ({ key: page.tab, at: page.verifiedAt ?? 0 })),
  );
  await putMarks(
    env,
    'review-owner',
    sent.map((owner) => ({ key: owner, at: now })),
  );
  console.info('[knowledge] review emails', {
    documentId,
    owners: emails.size,
    tried: tried.length,
    sent: sent.length,
    held: held.length,
    pages: settled.length,
  });
  return next;
}

/** The alarm's email work (knowledge-turn.ts): the review check is the one kind owed. */
export async function runKnowledgeEmail(
  env: DocumentEnv,
  documentId: string,
  work: Work,
  now: number,
): Promise<number | null> {
  if (work.kind === 'review-email') {
    // Review Due rules and the pages' watchers (watching.md "Verification Lapsed") look first, whether the emails are
    // on or not (review-events.ts, watch-work.ts); the work wakes again at the soonest of the answers.
    const document = await getDocument(env, documentId);
    const pages = document ? pagesOf(document, now) : [];
    const rules =
      document && hearsKnowledge(env, REVIEW_DUE_EVENT)
        ? await queueReviewsDue(env, pages, now)
        : null;
    const watchers = document ? await noteReviewsLapsed(env, pages, now) : null;
    const emails = await runReviewEmails(env, documentId, now);
    const next = [rules, watchers, emails].filter((at): at is number => at !== null);
    return next.length > 0 ? Math.min(...next) : null;
  }
  console.warn('[knowledge] email work unknown', { documentId, kind: work.kind });
  return null;
}

/** Remind the Owners (Knowledge Health): each owner's due and never-verified pages in one email, once a week. */
export async function remindOwners(
  env: DocumentEnv,
  document: DocumentDTO,
  now: number,
): Promise<KnowledgeEmailOutcome> {
  if (!emailEnabled(env)) return { outcome: 'unavailable' };
  // Verification off (a Review Period of Never, verification.md): there is nothing to review.
  if (!verificationOn(document.knowledgeSettings.reviewEvery))
    return { outcome: 'verification_off' };
  const pages = pagesOf(document, now).filter((p) => p.state !== 'verified');
  if (pages.length === 0) return { outcome: 'nothing_due' };
  const owned = pages.flatMap((p): OwnedPage[] =>
    p.owner && isAccountId(p.owner)
      ? [{ tab: p.tab, title: p.title, owner: p.owner, state: p.state as OwnedPage['state'] }]
      : [],
  );
  if (owned.length === 0) return { outcome: 'no_owners' };
  if (!(await claimMark(env, 'remind', 'owners', now, now - REMIND_OWNERS_GAP_MS))) {
    const sentAt = (await marksOf(env, 'remind')).get('owners') ?? now;
    return { outcome: 'already_sent', sentAt, nextAt: sentAt + REMIND_OWNERS_GAP_MS };
  }
  const emails = new Map(
    [...byOwner(owned)].map(([owner, own]) => [owner, remindOwnersEmail(env, document, own)]),
  );
  const { sent, tried, held } = await sendTo(env, document, emails, now);
  console.info('[knowledge] owners reminded', {
    documentId: document.id,
    owners: emails.size,
    sent: sent.length,
    held: held.length,
  });
  if (sent.length > 0) return { outcome: 'sent', sent: sent.length, owners: emails.size };
  // Nothing went: the week is not spent.
  await dropMark(env, 'remind', 'owners');
  return { outcome: tried.length === 0 && held.length > 0 ? 'daily_limit' : 'no_recipients' };
}

/** Ask Both Owners (a conflict): each owner of the two pages gets one email naming both pages and passages, once
 *  a conflict. */
export async function askConflictOwners(
  env: DocumentEnv,
  document: DocumentDTO,
  conflict: EmailConflict & { id: string },
  now: number,
): Promise<KnowledgeEmailOutcome> {
  if (!emailEnabled(env)) return { outcome: 'unavailable' };
  const ownerOf = new Map(pagesOf(document, now).map((p) => [p.tab, p.owner]));
  const owners = [
    ...new Set(
      [conflict.a.tab, conflict.b.tab].flatMap((tab) => {
        const owner = ownerOf.get(tab);
        return owner && isAccountId(owner) ? [owner] : [];
      }),
    ),
  ];
  if (owners.length === 0) return { outcome: 'no_owners' };
  if (!(await claimMark(env, 'ask', conflict.id, now, null))) {
    return { outcome: 'already_sent', sentAt: (await marksOf(env, 'ask')).get(conflict.id) ?? now };
  }
  const email = pagesDisagreeEmail(env, document, conflict);
  const { sent, tried, held } = await sendTo(
    env,
    document,
    new Map(owners.map((owner) => [owner, email])),
    now,
  );
  console.info('[knowledge] owners asked', {
    documentId: document.id,
    conflictId: conflict.id,
    owners: owners.length,
    sent: sent.length,
    held: held.length,
  });
  if (sent.length > 0) return { outcome: 'sent', sent: sent.length, owners: owners.length };
  await dropMark(env, 'ask', conflict.id);
  return { outcome: tried.length === 0 && held.length > 0 ? 'daily_limit' : 'no_recipients' };
}
