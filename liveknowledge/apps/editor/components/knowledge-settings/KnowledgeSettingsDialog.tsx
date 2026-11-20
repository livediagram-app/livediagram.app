'use client';

// Knowledgebase Settings (docs/specs/030-knowledgebase/verification.md "The Review Period"): one centred dialog of
// steady height, with one section today, Reviews. Review Period is five bordered single-choice rows; a shorter
// period that would make more pages due says how many before it applies, in a strip whose room is always kept, so
// nothing in the dialog moves when it appears. Editor only (KnowledgeSettingsHost.tsx draws it for nobody else).
// Fetched when first opened.
import { useId } from 'react';
import { Button, DialogCloseButton, DialogFooter, DialogHeader } from '@liveknowledge/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import {
  REVIEWS_SECTION,
  REVIEW_PERIOD,
  REVIEW_PERIOD_LINE,
  SETTINGS_TITLE,
  pagesDueText,
  reviewPeriodLabel,
} from '@/lib/knowledge-settings/review-period-words';
import { ReviewPeriodRows } from './ReviewPeriodRows';
import { useReviewPeriodFlow, type PeriodAsk } from './useReviewPeriodFlow';

// What sits under the rows: the question a shorter period asks, or one quiet line. One height either way.
function PeriodAskStrip({
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
      className="flex min-h-14 items-center"
    >
      {asked ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-amber-500 bg-amber-50 px-3.5 py-2 dark:border-amber-400 dark:bg-amber-500/10">
          <p className="min-w-0 text-sm text-slate-900 dark:text-slate-100">
            {asked.due === null ? (
              `Counting the pages ${reviewPeriodLabel(asked.every)} would make due.`
            ) : (
              <>
                <strong className="font-semibold">{pagesDueText(asked.due)}</strong> with{' '}
                {reviewPeriodLabel(asked.every)}.
              </>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
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
        <p className="text-xs text-slate-600 dark:text-slate-400">
          A change applies to every page at once. No page is rewritten.
        </p>
      )}
    </div>
  );
}

export function KnowledgeSettingsDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const sectionId = useId();
  const periodId = useId();
  const lineId = useId();
  const flow = useReviewPeriodFlow();
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <DialogHeader
        title={<span id={titleId}>{SETTINGS_TITLE}</span>}
        subtitle="What every page of this knowledgebase follows."
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      {/* One height whatever is showing, so nothing jumps when a shorter period asks its question. */}
      <div
        className="flex h-[29rem] max-h-[calc(100dvh-13rem)] flex-col overflow-y-auto px-6 py-5"
        data-knowledge-settings=""
      >
        <section aria-labelledby={sectionId} className="flex flex-col gap-3">
          <h3
            id={sectionId}
            className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
          >
            {REVIEWS_SECTION}
          </h3>
          <div className="flex flex-col gap-1">
            <span
              id={periodId}
              className="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {REVIEW_PERIOD}
            </span>
            <p id={lineId} className="text-[13px] leading-5 text-slate-600 dark:text-slate-400">
              {REVIEW_PERIOD_LINE}
            </p>
          </div>
          <ReviewPeriodRows
            value={flow.value}
            asked={flow.asked?.every ?? null}
            labelledBy={periodId}
            describedBy={lineId}
            onPick={flow.pick}
          />
          <PeriodAskStrip asked={flow.asked} onApply={flow.apply} onCancel={flow.cancel} />
        </section>
      </div>
      <DialogFooter>
        <Button variant="primary" onClick={onClose} className="cursor-pointer">
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
