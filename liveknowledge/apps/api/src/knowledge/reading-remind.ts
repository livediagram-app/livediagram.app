// Remind on a Required Reading page (docs/specs/030-knowledgebase/required-reading.md "Remind"; blueprint "Behaviour
// and state"): one email each person asked who has not confirmed, at most once a week a person a page, through the
// platform's notifier under their Knowledgebase Reviews switch and within the knowledgebase's 50 review emails a day.
// Only someone who still reaches the knowledgebase is emailed. Each person tried takes a mark (`reading-remind`), so
// pressing again inside the week reaches only those not reminded yet.
import { isAccountId } from '@liveworkspace/auth-client';
import { READING_REMIND_GAP_MS, type ReadingRemindResult } from '@liveknowledge/api-schema';
import { emailEnabled } from '../email/client';
import { notifyKnowledgeReviews } from '../email/notifications';
import { readingReminderEmail } from '../email/reading-reminder-email';
import type { DocumentDTO, DocumentEnv } from '../types';
import { putMarks, reserveEmails } from './email-marks';
import { ownersWhoReach } from './knowledge-emails';
import { knowledgeDb } from './knowledge-db';

/** A person's mark key for a page: neither id holds a space. */
export const remindKey = (tab: string, person: string) => `${tab} ${person}`;

/** When each person was last reminded of the page: one read of the page's marks by their key's prefix. */
export async function remindedOf(env: DocumentEnv, tab: string): Promise<Map<string, number>> {
  const prefix = `${tab} `;
  const { results } = await knowledgeDb(env)
    .prepare(
      `SELECT key, at FROM knowledge_email_marks
        WHERE kind = 'reading-remind' AND substr(key, 1, ?1) = ?2`,
    )
    .bind(prefix.length, prefix)
    .all<{ key: string; at: number }>();
  return new Map((results ?? []).map((r) => [r.key.slice(prefix.length), r.at]));
}

export async function remindReaders(
  env: DocumentEnv,
  document: DocumentDTO,
  page: { tab: string; title: string },
  pending: readonly string[],
  from: string,
  now: number,
): Promise<ReadingRemindResult> {
  if (!emailEnabled(env)) return { outcome: 'unavailable' };
  const accounts = pending.filter(isAccountId);
  if (accounts.length === 0) return { outcome: 'nobody_pending' };
  const reminded = await remindedOf(env, page.tab);
  const since = now - READING_REMIND_GAP_MS;
  const due = accounts.filter((person) => (reminded.get(person) ?? 0) <= since);
  if (due.length === 0) {
    const soonest = Math.min(...accounts.map((p) => reminded.get(p) ?? now));
    return { outcome: 'already_sent', nextAt: soonest + READING_REMIND_GAP_MS };
  }
  const reach = await ownersWhoReach(env, document, due);
  const allowed = await reserveEmails(env, reach.length, now);
  const tried = reach.slice(0, allowed);
  const email = readingReminderEmail(env, document, page, from);
  const sent = await notifyKnowledgeReviews(env, new Map(tried.map((person) => [person, email])));
  // Everyone tried is reminded for the week, one whose switch is off too: they chose not to hear.
  await putMarks(
    env,
    'reading-remind',
    tried.map((person) => ({ key: remindKey(page.tab, person), at: now })),
  );
  console.info('[reading] reminded', {
    documentId: document.id,
    tabId: page.tab,
    pending: accounts.length,
    tried: tried.length,
    sent: sent.length,
    held: reach.length - tried.length,
  });
  if (sent.length > 0) return { outcome: 'sent', sent: sent.length };
  return { outcome: tried.length === 0 && reach.length > 0 ? 'daily_limit' : 'no_recipients' };
}
