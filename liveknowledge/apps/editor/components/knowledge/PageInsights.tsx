'use client';

// Page Insights in the right rail (docs/specs/030-knowledgebase/ai-knowledge.md "Page Insights"): the page's reads over
// the last 30 days, a bar a day with people under agents in AI Knowledge's two tones, how many times Ask cited it and
// agents read it, and the questions it answered most. It reads nothing of its own: everything rides Page Health's one
// read. Quiet, as the rest of the rail is: a small-capitals heading, no card, no border.
import type { ReactNode } from 'react';
import type { PageAnsweredQuestion, PageInsightsWire } from '@liveknowledge/api-schema';
import { isNewPage } from '@liveknowledge/knowledge';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { AGENT_BG, PEOPLE_BG, ReadsSparkline } from '@/components/ai-knowledge/ReadsSparkline';
import { AgentsIcon, CitedIcon, NewPageSproutIcon } from './knowledge-icons';
import { RAIL_LABEL } from './PageHealthCard';
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

/** "Not yet", "Once", "12 times". */
export const timesText = (n: number): string =>
  n === 0 ? 'Not yet' : n === 1 ? 'Once' : `${count(n)} times`;

/** The questions Ask answered from the page, most asked first (ai-knowledge.md "AI Context on a page"). */
export function AnsweredQuestions({ answered }: { answered: readonly PageAnsweredQuestion[] }) {
  return (
    <div data-answered-from-page="" className="mt-5">
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

// Before the read: bars and figures of their own height, so nothing moves when the answer lands.
function Placeholder() {
  return (
    <div aria-hidden data-page-insights-placeholder="" className="mt-3">
      <span className="block h-7 w-24 rounded-md bg-slate-100 dark:bg-slate-800/80" />
      <span className="mt-3 block h-10 w-full rounded-md bg-slate-100 dark:bg-slate-800/80" />
      <span className="mt-4 block h-9 w-full rounded-md bg-slate-100 dark:bg-slate-800/80" />
    </div>
  );
}

function Figure({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className={`flex items-center gap-1.5 text-[11px] ${QUIET}`}>
        <span aria-hidden className="flex text-slate-400 dark:text-slate-400/60">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

export function PageInsights({ insights, answered, createdAt, now }: PageInsightsProps) {
  const days = insights?.days ?? [];
  const people = days.reduce((sum, d) => sum + d.people, 0);
  const agents = days.reduce((sum, d) => sum + d.agents, 0);
  const total = people + agents;
  // A page in its first week has no history to show: never 30 days of bars mostly from before it was made (its
  // maker's own opening is a read, so "no reads" alone would almost never hold).
  const fresh = insights !== undefined && isNewPage(createdAt, now);
  return (
    <section
      aria-label="Page Insights"
      data-page-insights=""
      className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
    >
      <h2 className={RAIL_LABEL}>Page Insights</h2>
      {insights === undefined ? (
        <Placeholder />
      ) : fresh ? (
        <div
          data-page-insights-new=""
          className="mt-3 flex items-start gap-3 rounded-2xl bg-gradient-to-br from-brand-50 via-brand-50/40 to-white p-3.5 ring-1 ring-inset ring-brand-100 dark:from-brand-950/50 dark:via-brand-950/20 dark:to-transparent dark:ring-brand-900/40"
        >
          <span aria-hidden className="mt-0.5 flex text-brand-700 dark:text-brand-300">
            <NewPageSproutIcon />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-50">New This Week</p>
            <p data-page-insights-so-far="" className={`text-xs ${QUIET}`}>
              {total === 0
                ? 'Reads show here as people and agents open it.'
                : readsSoFarText(people, agents)}
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span
              data-page-insights-total=""
              className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white"
            >
              {count(total)}
            </span>
            <span className={QUIET}>
              {total === 0 ? 'No reads in 30 days' : `${total === 1 ? 'read' : 'reads'} in 30 days`}
            </span>
          </p>
          <div className="mt-2">
            <ReadsSparkline days={days} tall />
            <div aria-hidden className={`mt-1 flex justify-between text-[11px] ${QUIET}`}>
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>
          {/* The key, which also says the split for anyone who reads the bars' label instead. */}
          <ul aria-label="Key" className={`mt-2 flex gap-4 text-xs ${QUIET}`}>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={`h-2 w-2 rounded-sm ${PEOPLE_BG}`} />
              People{' '}
              <span className="tabular-nums text-slate-700 dark:text-slate-300">
                {count(people)}
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={`h-2 w-2 rounded-sm ${AGENT_BG}`} />
              Agents{' '}
              <span className="tabular-nums text-slate-700 dark:text-slate-300">
                {count(agents)}
              </span>
            </li>
          </ul>
        </>
      )}
      {/* The counts, in the first week too once there is one to say: a new page cited by Ask says so, but never a
        row of "Not yet". */}
      {insights !== undefined && (!fresh || agents > 0 || (insights.cited ?? 0) > 0) ? (
        <dl
          className={`mt-4 grid gap-3 border-t border-slate-100 pt-3 dark:border-slate-800/70 ${
            insights.cited === undefined ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {/* A link confined to one page has no Ask: nothing cited is said. */}
          {insights.cited === undefined ? null : (
            <Figure icon={<CitedIcon />} label="Cited by Ask" value={timesText(insights.cited)} />
          )}
          <Figure icon={<AgentsIcon />} label="Read by Agents" value={timesText(agents)} />
        </dl>
      ) : null}
      {answered && answered.length > 0 ? <AnsweredQuestions answered={answered} /> : null}
    </section>
  );
}

/** The section for the page open, from what the rail already holds; nothing for a knowledgebase kept Offline. */
export function PageRailInsights({ page }: { page: PageKnowledgeView }) {
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  if (offline || !documentId) return null;
  const { health } = page;
  // An api from before Page Insights answers none: nothing to draw.
  if (health && !health.insights) return null;
  return (
    <PageInsights
      insights={health?.insights}
      answered={health?.answered}
      createdAt={health?.created?.at}
      now={page.now}
    />
  );
}
