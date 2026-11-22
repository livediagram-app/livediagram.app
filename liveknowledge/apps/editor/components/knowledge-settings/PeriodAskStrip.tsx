'use client';

// What sits under the Review Period's rows (docs/specs/030-knowledgebase/verification.md "The Review Period"): the
// question a shorter period asks before it applies, or one quiet line. Its room is always kept (`min-h-[6.5rem]`),
// so the popover never changes height when the question appears.
import { Button } from '@liveknowledge/ui';
import { pagesDueText, reviewPeriodLabel } from '@/lib/knowledge-settings/review-period-words';
import type { PeriodAsk } from './useReviewPeriodFlow';

export function PeriodAskStrip({
  asked,
  onApply,
  onCancel,
}: {
  asked: PeriodAsk | null;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      aria-live="polite"
      data-review-period-ask={asked ? String(asked.every) : ''}
      // Room for the question kept whether it shows or not, so nothing above or below it moves.
      className="flex min-h-[6.5rem] flex-col"
    >
      {asked ? (
        <div className="flex flex-1 flex-col justify-between gap-2 rounded-lg border border-amber-500 bg-amber-50 px-3 py-2.5 dark:border-amber-400 dark:bg-amber-500/10">
          <p className="text-[13px] leading-5 text-slate-900 dark:text-slate-100">
            {asked.due === null ? (
              `Counting the pages ${reviewPeriodLabel(asked.every)} would make due.`
            ) : (
              <>
                <strong className="font-semibold">{pagesDueText(asked.due)}</strong> with{' '}
                {reviewPeriodLabel(asked.every)}.
              </>
            )}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={asked.due === null}
              onClick={onApply}
              className="cursor-pointer"
            >
              Apply
            </Button>
          </div>
        </div>
      ) : (
        <p className="pt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
          Every page&apos;s due date moves at once. No page is rewritten.
        </p>
      )}
    </div>
  );
}
