// The Review Period's words (docs/specs/030-knowledgebase/verification.md "The Review Period"), in one place so
// the dialog, Page Health, the toasts and their tests say the same thing. Pure.
import { REVIEW_INTERVALS, reviewDays, type ReviewEvery } from '@liveknowledge/knowledge';

export const SETTINGS_TITLE = 'Knowledgebase Settings';
export const REVIEWS_SECTION = 'Reviews';
export const REVIEW_PERIOD = 'Review Period';
export const REVIEW_PERIOD_LINE =
  'A verified page comes due for review this long after it was last verified.';
export const NO_REVIEW_PERIOD = 'No Review Period';

const LABELS: Record<ReviewEvery, string> = {
  30: 'Every 30 Days',
  90: 'Every 90 Days',
  180: 'Every 180 Days',
  365: 'Every Year',
  never: 'Never',
};

/** "Every 90 Days", "Every Year", "Never". */
export const reviewPeriodLabel = (every: ReviewEvery): string => LABELS[every];

/** The five choices, shortest first, Never last. */
export const REVIEW_PERIOD_OPTIONS: readonly { value: ReviewEvery; label: string }[] =
  REVIEW_INTERVALS.map((value) => ({ value, label: LABELS[value] }));

/** Whether `next` brings reviews forward: only then can more pages come due, and the dialog asks first. */
export function isShorterPeriod(next: ReviewEvery, than: ReviewEvery): boolean {
  const days = reviewDays(next);
  if (days === undefined) return false;
  const was = reviewDays(than);
  return was === undefined || days < was;
}

/** "12 pages will be due for review", counting every page due under the new period. */
export function pagesDueText(due: number): string {
  if (due === 0) return 'No page will be due for review.';
  return `${due.toLocaleString('en')} ${due === 1 ? 'page' : 'pages'} will be due for review`;
}

/** What the toast says once a period is applied. */
export function periodAppliedText(every: ReviewEvery): string {
  return every === 'never'
    ? 'Pages in this knowledgebase no longer come due for review.'
    : `Pages are now reviewed ${LABELS[every].toLowerCase()}.`;
}

/** What a refused change says, in words: never a status or a code. */
export function periodFailureText(status: number | null): string {
  if (status === 403) return 'Only an Editor can change the Review Period. Nothing was changed.';
  if (status === 404 || status === 410)
    return 'This knowledgebase is no longer here. Nothing was changed.';
  return 'The Review Period could not be changed, so it is back as it was. Check your connection and try again.';
}
