'use client';

// The Review Period's popover body (docs/specs/030-knowledgebase/verification.md "The Review Period"), opened from
// Page Health's Change: its heading, the line that says it is the whole knowledgebase's, the five rows and the
// strip that asks before a shorter period applies. One height whatever it shows. Its own chunk, fetched by
// ReviewPeriodButton before it first opens, so none of this is in the editor's first bundle.
import { useId } from 'react';
import {
  REVIEW_PERIOD,
  REVIEW_PERIOD_LINE,
  REVIEW_PERIOD_SCOPE,
} from '@/lib/knowledge-settings/review-period-words';
import { ContextIcon, PeriodIcon } from '@/components/knowledge/knowledge-icons';
import { PeriodAskStrip } from './PeriodAskStrip';
import { ReviewPeriodRows } from './ReviewPeriodRows';
import { useReviewPeriodFlow } from './useReviewPeriodFlow';

export function ReviewPeriodPanel({ titleId }: { titleId: string }) {
  const lineId = useId();
  const flow = useReviewPeriodFlow();
  return (
    <div data-review-period-panel="" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-900/50"
        >
          <PeriodIcon />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {REVIEW_PERIOD}
          </h2>
          <p
            id={lineId}
            className="mt-0.5 text-[13px] leading-5 text-slate-600 dark:text-slate-400"
          >
            {REVIEW_PERIOD_LINE}
          </p>
        </div>
      </div>
      {/* Whose it is, said before the choices: the whole knowledgebase's, never one page's. */}
      <p
        data-review-period-scope=""
        className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium leading-4 text-brand-800 ring-1 ring-inset ring-brand-100 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-900/50"
      >
        <span aria-hidden className="flex shrink-0">
          <ContextIcon />
        </span>
        {REVIEW_PERIOD_SCOPE}
      </p>
      <ReviewPeriodRows
        value={flow.value}
        asked={flow.asked?.every ?? null}
        labelledBy={titleId}
        describedBy={lineId}
        onPick={flow.pick}
      />
      <PeriodAskStrip asked={flow.asked} onApply={flow.apply} onCancel={flow.cancel} />
    </div>
  );
}
