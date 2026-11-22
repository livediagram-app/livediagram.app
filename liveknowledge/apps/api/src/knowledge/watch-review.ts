// A watched page's review came due (docs/specs/030-knowledgebase/watching.md "Verification Lapsed"), from the review
// check (knowledge-emails.ts runKnowledgeEmail): each page newly due is noted for its watchers once a verification
// (`watch-review` marks, as Review Due rules keep `rule-review`); the first check marks the backlog without telling
// anyone. Nobody is behind it.
import type { DocumentEnv } from '../types';
import { marksOf, putMarks } from './email-marks';
import { allWatches } from './page-watch';
import { noteWatched } from './watch-notes';

const REVIEW_BASELINE = '';

/**
 * The review check's part: each page newly due is noted for its watchers once a verification (`watch-review`
 * marks); the first check marks the backlog without telling anyone. Answers the next review's time, so the check
 * wakes for it with email off too; null when nobody watches here.
 */
export async function noteReviewsLapsed(
  env: DocumentEnv,
  pages: readonly {
    tab: string;
    state: string;
    verifiedAt?: number | undefined;
    reviewAt?: number | undefined;
  }[],
  now: number,
): Promise<number | null> {
  const watches = await allWatches(env);
  if (watches.length === 0) return null;
  const told = await marksOf(env, 'watch-review');
  const baseline = !told.has(REVIEW_BASELINE);
  const fresh = pages.filter(
    (p) =>
      p.state === 'review-due' && p.verifiedAt !== undefined && told.get(p.tab) !== p.verifiedAt,
  );
  if (!baseline && fresh.length > 0)
    await noteWatched(env, {
      tabs: fresh.map((p) => p.tab),
      kind: 'review_due',
      actor: () => null,
      now,
    });
  await putMarks(env, 'watch-review', [
    ...(baseline ? [{ key: REVIEW_BASELINE, at: now }] : []),
    ...fresh.map((p) => ({ key: p.tab, at: p.verifiedAt ?? 0 })),
  ]);
  const upcoming = pages.flatMap((p) => (p.state === 'verified' && p.reviewAt ? [p.reviewAt] : []));
  return upcoming.length > 0 ? Math.min(...upcoming) : null;
}
