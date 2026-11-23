'use client';

// Most Read (docs/specs/030-knowledgebase/insights.md "The view, as built"): the pages read most in the last 7
// days, each with a bar of its reads against the most read page, people and agents in the sparkline's two tones.
// A row opens its page.
import type { KnowledgeMostRead } from '@liveknowledge/api-schema';
import { CompactEmptyState } from '@liveknowledge/ui';
import { readersText } from '@/lib/knowledge-ask/dashboard-figures';
import { MostReadIcon } from './insights-icons';
import { INSIGHTS_MUTED, InsightsSection } from './InsightsSection';
import { AGENT_BG, PEOPLE_BG } from './ReadsSparkline';

const ROW =
  'group flex w-full min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg px-2 py-2 text-left transition-colors duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:hover:bg-slate-800/60';

export function MostReadCard({
  pages,
  onOpenPage,
}: {
  pages: readonly KnowledgeMostRead[];
  onOpenPage: (tab: string) => void;
}) {
  const most = Math.max(1, ...pages.map((page) => page.people + page.agents));
  return (
    <InsightsSection
      id="ai-reads"
      title="Most Read"
      icon={<MostReadIcon />}
      about="Read most by people and agents in the last 7 days."
    >
      {pages.length === 0 ? (
        <CompactEmptyState
          icon={<MostReadIcon />}
          title="No Reads Yet"
          description="Opening a page counts a read, and so does an agent reading it or finding it in a search."
        />
      ) : (
        <>
          <ol className="-mx-2 flex flex-col">
            {pages.map((page) => {
              const total = page.people + page.agents;
              return (
                <li key={page.tab} data-most-read={page.tab}>
                  <button type="button" onClick={() => onOpenPage(page.tab)} className={ROW}>
                    <span className="flex w-full min-w-0 items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 underline-offset-2 group-hover:underline dark:text-slate-100">
                        {page.title || 'Untitled Page'}
                      </span>
                      <span className={`shrink-0 text-xs tabular-nums ${INSIGHTS_MUTED}`}>
                        <span aria-hidden>{total.toLocaleString('en')}</span>
                        <span className="sr-only">{readersText(page.people, page.agents)}</span>
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    >
                      <span
                        className={`h-full ${PEOPLE_BG}`}
                        style={{ width: `${(page.people / most) * 100}%` }}
                      />
                      <span
                        className={`h-full ${AGENT_BG}`}
                        style={{ width: `${(page.agents / most) * 100}%` }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <ul aria-label="Key" className={`mt-3 flex gap-4 text-xs ${INSIGHTS_MUTED}`}>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={`h-2 w-2 rounded-sm ${PEOPLE_BG}`} />
              People
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={`h-2 w-2 rounded-sm ${AGENT_BG}`} />
              Agents
            </li>
          </ul>
        </>
      )}
    </InsightsSection>
  );
}
