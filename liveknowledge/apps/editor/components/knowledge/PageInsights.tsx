'use client';

// Page Insights in the right rail (docs/specs/030-knowledgebase/ai-knowledge.md "Page Insights"): the page's reads over
// the last 30 days, drawn inside Read This Week (owner 2026-11-22), and the questions it answered most. It reads
// nothing of its own: everything rides Page Health's one read.
import type { PageAnsweredQuestion, PageInsightsWire } from '@liveknowledge/api-schema';
import { isNewPage } from '@liveknowledge/knowledge';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { ReadsSparkline } from '@/components/ai-knowledge/ReadsSparkline';
import { NewPageSproutIcon } from './knowledge-icons';
import type { PageKnowledgeView } from './usePageKnowledge';

export type PageInsightsProps = {
  /** Undefined before Page Health is read. */
  insights: PageInsightsWire | undefined;
  answered: readonly PageAnsweredQuestion[] | undefined;
  /** When the page was made, where it was kept: a page in its first week with no reads is New This Week. */
  createdAt: number | undefined;
  now: number;
};

const SUB_LABEL = 'text-xs font-medium text-slate-500 dark:text-slate-400';
const QUIET = 'text-slate-500 dark:text-slate-400';
const count = (n: number) => n.toLocaleString('en');

/** "Asked once", "Asked 6 times". */
export const askedTimes = (n: number): string =>
  n === 1 ? 'Asked once' : `Asked ${count(n)} times`;

/** "3 reads so far: 2 by people, 1 by an agent" (a new page's line). */
export const readsSoFarText = (people: number, agents: number): string => {
  const total = people + agents;
  const parts = [
    ...(people ? [`${count(people)} by ${people === 1 ? 'a person' : 'people'}`] : []),
    ...(agents ? [`${count(agents)} by ${agents === 1 ? 'an agent' : 'agents'}`] : []),
  ];
  return `${count(total)} ${total === 1 ? 'read' : 'reads'} so far: ${parts.join(', ')}`;
};

/** The questions Ask answered from the page, most asked first (ai-knowledge.md "AI Context on a page"). */
export function AnsweredQuestions({ answered }: { answered: readonly PageAnsweredQuestion[] }) {
  return (
    <div data-answered-from-page="">
      <h3 className={SUB_LABEL}>Answered From This Page</h3>
      <ul className="mt-2 flex flex-col gap-3">
        {answered.map((q) => (
          <li key={q.question} data-answered-question="" className="flex gap-2">
            <span
              aria-hidden
              className="-mt-0.5 select-none font-serif text-2xl leading-7 text-brand-600/70 dark:text-brand-400/70"
            >
              {'“'}
            </span>
            <div className="min-w-0">
              {/* Other people's words, drawn as text. Clamped to three lines; the whole stays for a reader. */}
              <p className="line-clamp-3 break-words text-slate-800 dark:text-slate-200">
                {q.question}
              </p>
              <p className="mt-0.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {askedTimes(q.asked)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Read This Week's trend (owner 2026-11-22: Page Insights merged into Read This Week): the page's reads over the
 *  last 30 days, a bar a day with people under agents in AI Knowledge's two tones. A page in its first week has no
 *  history to show, so it says its reads so far instead. */
export function ReadsTrend({ insights, createdAt, now }: Omit<PageInsightsProps, 'answered'>) {
  if (insights === undefined)
    return (
      <span
        aria-hidden
        data-page-insights-placeholder=""
        className="mt-2.5 block h-10 w-full rounded-md bg-white/60 dark:bg-slate-800/60"
      />
    );
  const days = insights.days;
  const people = days.reduce((sum, d) => sum + d.people, 0);
  const agents = days.reduce((sum, d) => sum + d.agents, 0);
  if (isNewPage(createdAt, now))
    return (
      <p data-page-insights-new="" className={`mt-2.5 flex items-center gap-1.5 text-xs ${QUIET}`}>
        <span aria-hidden className="flex text-brand-700 dark:text-brand-300">
          <NewPageSproutIcon />
        </span>
        {people + agents === 0
          ? 'New this week: reads show here as people and agents open it.'
          : `New this week, ${readsSoFarText(people, agents)}`}
      </p>
    );
  return (
    <div data-page-insights="" className="mt-2.5">
      <ReadsSparkline days={days} tall />
      <div aria-hidden className={`mt-1 flex justify-between text-[11px] ${QUIET}`}>
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** Read This Week's trend for the page open, from what the rail already holds; nothing Offline or from an api before
 *  Page Insights. */
export function PageReadsTrend({ page }: { page: PageKnowledgeView }) {
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const { health } = page;
  if (offline || !documentId || (health && !health.insights)) return null;
  return <ReadsTrend insights={health?.insights} createdAt={health?.created?.at} now={page.now} />;
}

/** Answered From This Page, under On This Page's sections, for the page open. */
export function PageRailAnswered({ page }: { page: PageKnowledgeView }) {
  const answered = page.health?.answered;
  if (!answered || answered.length === 0) return null;
  return (
    <section
      aria-label="Answered From This Page"
      className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
    >
      <AnsweredQuestions answered={answered} />
    </section>
  );
}
