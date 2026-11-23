'use client';

// Required Reading (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): each Required Reading page with
// its bar and "7 of 12", the least read first, a row opening its page. Counts only, for everyone who sees AI
// Knowledge. From the overview's one read: nothing of its own.
import type { KnowledgeRequiredReadingPage } from '@liveknowledge/api-schema';
import { CompactEmptyState } from '@liveknowledge/ui';
import { ReadingBookIcon } from '@/components/required-reading/reading-icons';
import { audienceText } from '@/lib/required-reading/reading-words';
import { RowChevronIcon } from './insights-icons';
import { INSIGHTS_MUTED, InsightsSection } from './InsightsSection';

const ROW =
  'group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 phone:min-h-11 dark:hover:bg-slate-800/60';

export function RequiredReadingCard({
  pages,
  onOpenPage,
}: {
  pages: readonly KnowledgeRequiredReadingPage[];
  onOpenPage: (tab: string) => void;
}) {
  return (
    <InsightsSection
      id="ai-required-reading"
      title="Required Reading"
      icon={<ReadingBookIcon />}
      count={pages.length}
      about="Pages everyone, or chosen people, are asked to confirm they read, and how many have."
    >
      {pages.length === 0 ? (
        <CompactEmptyState
          icon={<ReadingBookIcon />}
          title="No Required Reading"
          description="An Editor marks a page Required Reading from its menu in the page tree."
        />
      ) : (
        <ol className="-mx-2 flex flex-col">
          {pages.map((page) => {
            const share = page.total > 0 ? Math.min(1, page.done / page.total) : 0;
            const done = page.total > 0 && page.done >= page.total;
            return (
              <li key={page.tab} data-required-reading={page.tab}>
                <button type="button" onClick={() => onOpenPage(page.tab)} className={ROW}>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex min-w-0 items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-slate-900 underline-offset-2 group-hover:underline dark:text-slate-100">
                        {page.title || 'Untitled Page'}
                      </span>
                      <span className={`shrink-0 text-xs tabular-nums ${INSIGHTS_MUTED}`}>
                        {page.done.toLocaleString('en')} of {page.total.toLocaleString('en')}
                      </span>
                    </span>
                    <span
                      role="progressbar"
                      aria-label={`${page.title || 'Untitled Page'}, read so far`}
                      aria-valuemin={0}
                      aria-valuemax={page.total}
                      aria-valuenow={page.done}
                      aria-valuetext={`${page.done} of ${page.total} have read it`}
                      className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
                    >
                      <span
                        className={`block h-full rounded-full ${
                          done
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : 'bg-brand-600 dark:bg-brand-400'
                        }`}
                        style={{ width: `${share * 100}%` }}
                      />
                    </span>
                    <span className={`truncate text-xs ${INSIGHTS_MUTED}`}>
                      {audienceText(page.audience, page.total)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="flex shrink-0 text-slate-400 transition-transform duration-micro group-hover:translate-x-0.5"
                  >
                    <RowChevronIcon />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </InsightsSection>
  );
}
