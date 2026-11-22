// Review Due (docs/specs/013-workspace/automations.md "Triggers of its own"): a verified page's review comes due.
// Checked on the review emails' alarm (knowledge/knowledge-emails.ts, the `review-email` work, which wakes when the
// next review comes due), whether those emails are on or not, and only while a rule that is on hears it. A page is
// told of once a verification (`knowledge_email_marks` kind `rule-review`, keyed by the page, holding the
// `verifiedAt` told of); the first check marks every page already due without starting a rule (the `rule-review`
// key '' holds when that was), so a new rule never fires for a backlog. Nobody is behind it.
import { REVIEW_DUE_EVENT } from '@liveknowledge/document/automations';
import { queueEvent } from '@liveworkspace/automations/room';
import { marksOf, putMarks } from '../../knowledge/email-marks';
import type { DocumentEnv } from '../../types';
import { hearsKnowledge } from './knowledge-events';

export const RULE_REVIEW_MARK = 'rule-review';
// The mark that says the first check was made.
const BASELINE_KEY = '';

export type ReviewPage = {
  tab: string;
  state: string;
  verifiedAt?: number | undefined;
  reviewAt?: number | undefined;
};

/** Queue Review Due for each page newly due; answer when the next review comes due, for the alarm, or null when no
 *  rule hears it (the emails' own check keeps its time). */
export async function queueReviewsDue(
  env: DocumentEnv,
  pages: readonly ReviewPage[],
  now: number,
): Promise<number | null> {
  if (!hearsKnowledge(env, REVIEW_DUE_EVENT)) return null;
  const told = await marksOf(env, RULE_REVIEW_MARK);
  const baseline = !told.has(BASELINE_KEY);
  const fresh = pages.filter(
    (p) =>
      p.state === 'review-due' && p.verifiedAt !== undefined && told.get(p.tab) !== p.verifiedAt,
  );
  if (!baseline)
    for (const page of fresh)
      queueEvent(env, {
        id: `review:${page.tab}:${page.verifiedAt}`,
        kind: REVIEW_DUE_EVENT,
        at: now,
        tab: page.tab,
      });
  await putMarks(env, RULE_REVIEW_MARK, [
    ...(baseline ? [{ key: BASELINE_KEY, at: now }] : []),
    ...fresh.map((p) => ({ key: p.tab, at: p.verifiedAt ?? 0 })),
  ]);
  const upcoming = pages.flatMap((p) => (p.state === 'verified' && p.reviewAt ? [p.reviewAt] : []));
  return upcoming.length > 0 ? Math.min(...upcoming) : null;
}
