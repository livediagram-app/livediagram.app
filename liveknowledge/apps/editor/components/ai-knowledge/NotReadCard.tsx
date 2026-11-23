'use client';

// Not Read in 90 Days (docs/specs/030-knowledgebase/ai-knowledge.md "Not Read in 90 Days"): the pages nobody opened and
// no agent read in all the days the room keeps reads, the one touched longest ago first. A row opens its page. From
// the overview's one read: nothing of its own.
import type { KnowledgeNotReadPage } from '@liveknowledge/api-schema';
import { CompactEmptyState } from '@liveknowledge/ui';
import { lastEditedText, moreNotListedText } from '@/lib/knowledge-ask/overview-words';
import { NotReadIcon, RowChevronIcon } from './ai-knowledge-icons';
import { AI_MUTED, AiSection } from './AiSection';

const ROW =
  'group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 phone:min-h-11 dark:hover:bg-slate-800/60';

export function NotReadCard({
  pages,
  total,
  days,
  now,
  onOpenPage,
}: {
  pages: readonly KnowledgeNotReadPage[];
  total: number;
  // 90, or the days the owner's tier keeps reads where fewer (tiers.md "AI Knowledge History").
  days: number;
  now: number;
  onOpenPage: (tab: string) => void;
}) {
  return (
    <AiSection
      id="ai-not-read"
      title={`Not Read in ${days} Days`}
      icon={<NotReadIcon />}
      count={total}
      about={`Pages nobody opened and no agent read in ${days} days: worth updating, merging or deleting.`}
    >
      {pages.length === 0 ? (
        <CompactEmptyState
          icon={<NotReadIcon />}
          title="Every Page Was Read"
          description={`Each page older than ${days} days was opened, or read by an agent, in that time.`}
        />
      ) : (
        <>
          <ol className="-mx-2 flex flex-col">
            {pages.map((page) => (
              <li key={page.tab} data-not-read={page.tab}>
                <button type="button" onClick={() => onOpenPage(page.tab)} className={ROW}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-slate-900 underline-offset-2 group-hover:underline dark:text-slate-100">
                      {page.title || 'Untitled Page'}
                    </span>
                    <span className={`truncate text-xs ${AI_MUTED}`}>
                      {lastEditedText(page.touchedAt, now)}
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
            ))}
          </ol>
          {total > pages.length ? (
            <p data-not-read-more="" className={`mt-2 text-xs ${AI_MUTED}`}>
              {moreNotListedText(total - pages.length)}
            </p>
          ) : null}
        </>
      )}
    </AiSection>
  );
}
