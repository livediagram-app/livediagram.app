// A page's verified state, wherever it shows (docs/specs/030-knowledgebase/verification.md "States"): a tick for
// Verified, an amber pill for Review Due; a page never verified shows nothing, so there is no third look. `compact`
// is the page tree row's: the tick alone, or a short pill, each with its full name for a screen reader.
import type { TrustMark } from '@/lib/knowledge/page-trust';
import { TickIcon } from './knowledge-icons';

// brand-900 on brand-100 and amber-800 on amber-100 are both over 4.5:1 (TrustBadge.test.tsx).
export const VERIFIED_PILL = 'bg-brand-100 text-brand-900 dark:bg-brand-500/20 dark:text-brand-100';
export const REVIEW_DUE_PILL =
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200';

const PILL = 'inline-flex shrink-0 items-center rounded-full font-medium';

export function TrustBadge({
  mark,
  label,
  compact = false,
}: {
  mark: TrustMark;
  // The words beside the tick ("Verified by Priya Nair"); "Verified" when absent.
  label?: string;
  compact?: boolean;
}) {
  if (mark === 'review-due') {
    return compact ? (
      <span
        role="img"
        aria-label="Review Due"
        data-trust="review-due"
        className={`${PILL} ${REVIEW_DUE_PILL} h-[18px] px-1.5 text-[10px] leading-none`}
      >
        Due
      </span>
    ) : (
      <span
        data-trust="review-due"
        className={`${PILL} ${REVIEW_DUE_PILL} px-2 py-0.5 text-[13px]`}
      >
        Review Due
      </span>
    );
  }
  return compact ? (
    <span
      role="img"
      aria-label="Verified"
      data-trust="verified"
      className="inline-flex shrink-0 text-brand-700 dark:text-brand-300"
    >
      <TickIcon />
    </span>
  ) : (
    <span
      data-trust="verified"
      className={`${PILL} ${VERIFIED_PILL} gap-1 py-0.5 pl-1.5 pr-2 text-[13px]`}
    >
      <TickIcon />
      {label ?? 'Verified'}
    </span>
  );
}
