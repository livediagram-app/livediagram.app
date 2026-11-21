'use client';

// AI Context in the right rail (docs/specs/030-knowledgebase/ai-knowledge.md "AI Context on a page"): whether every
// agent is handed this page first, the questions Ask answered from it, the agents that read it this week (each
// shown only when there is something: owner 2026-11-21). It reads nothing of its own: the questions and the agents ride Page Health's one read. Quiet, as
// the rest of the rail is: small-capital headings, no card, no border.
import { useId } from 'react';
import type { PageAgentReads, PageAnsweredQuestion } from '@liveknowledge/api-schema';
import { Switch } from '@liveknowledge/ui';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { track } from '@/lib/telemetry';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { AgentsIcon, ContextIcon } from './knowledge-icons';
import { RAIL_LABEL } from './PageHealthCard';
import type { PageKnowledgeView } from './usePageKnowledge';

export type PageAiContextProps = {
  inContext: boolean;
  /** The page's size against the budget; undefined before Page Health is read. */
  tokens: number | undefined;
  /** Undefined before Page Health is read. */
  answered: readonly PageAnsweredQuestion[] | undefined;
  agents: readonly PageAgentReads[] | undefined;
  /** Absent for anyone who may not change it: the state reads as words. */
  onSetContext: ((on: boolean) => void) | undefined;
};

const SUB_LABEL = 'text-xs font-medium text-slate-500 dark:text-slate-400';
const QUIET = 'text-[13px] leading-5 text-slate-500 dark:text-slate-400';

/** "Asked once", "Asked 6 times". */
export const askedTimes = (n: number): string =>
  n === 1 ? 'Asked once' : `Asked ${n.toLocaleString('en')} times`;

/** "About 1,200 tokens". */
export const aboutTokens = (n: number): string =>
  `About ${n.toLocaleString('en')} ${n === 1 ? 'token' : 'tokens'}`;

// Before the read: quiet lines of the rows' own height, so nothing moves when the answer lands.
function Placeholder() {
  return (
    <div aria-hidden data-ai-context-placeholder="" className="mt-2 flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <span className="h-3 w-11/12 rounded-full bg-slate-100 dark:bg-slate-800/80" />
          <span className="h-2.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800/80" />
        </div>
      ))}
    </div>
  );
}

export function PageAiContext({
  inContext,
  tokens,
  answered,
  agents,
  onSetContext,
}: PageAiContextProps) {
  const labelId = useId();
  const sizeId = useId();
  return (
    <section
      aria-label="AI Context"
      data-ai-context=""
      className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
    >
      <div className="flex items-center gap-1">
        <h2 className={RAIL_LABEL}>AI Context</h2>
        <HelpArticleLink article="aiContext" />
      </div>

      <div data-ai-context-always="" className="mt-3 flex items-start gap-2.5">
        <span
          className={`mt-0.5 flex ${inContext ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 dark:text-slate-400/60'}`}
          aria-hidden
        >
          <ContextIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p id={labelId} className="font-medium text-slate-800 dark:text-slate-200">
            Always in Context
          </p>
          {onSetContext ? null : (
            <p data-context-state="" className={QUIET}>
              {inContext ? 'Handed to Every Agent First' : 'Not Handed to Agents First'}
            </p>
          )}
          {tokens === undefined ? null : (
            <p
              id={sizeId}
              data-context-size=""
              className="text-xs tabular-nums text-slate-500 dark:text-slate-400"
            >
              {aboutTokens(tokens)}
            </p>
          )}
        </div>
        {onSetContext ? (
          <Switch
            size="sm"
            checked={inContext}
            labelledBy={labelId}
            {...(tokens === undefined ? {} : { describedBy: sizeId })}
            onChange={onSetContext}
            className="mt-0.5"
          />
        ) : null}
      </div>

      {/* Only when Ask has answered from the page (owner 2026-11-21: "if no questions or read by agents, don't show
        it"); a placeholder while Page Health is read. */}
      {answered?.length === 0 ? null : (
        <div data-ai-context-answered="" className="mt-5">
          <h3 className={SUB_LABEL}>Answered From This Page</h3>
          {answered === undefined ? (
            <Placeholder />
          ) : (
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
          )}
        </div>
      )}

      {agents === undefined || agents.length === 0 ? null : (
        <div data-ai-context-agents="" className="mt-5">
          <h3 className={SUB_LABEL}>Read by Agents</h3>
          <ul className="mt-1.5 flex flex-col">
            {agents.map((a) => (
              <li key={a.agent} data-page-agent="" className="flex min-h-8 items-center gap-2">
                <span className="flex text-slate-400 dark:text-slate-400/60" aria-hidden>
                  <AgentsIcon />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">
                  {a.agent}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {a.reads.toLocaleString('en')} {a.reads === 1 ? 'read' : 'reads'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The section for the page open, from what the rail already holds; nothing for a knowledgebase kept Offline. */
export function PageRailAiContext({ page }: { page: PageKnowledgeView }) {
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  if (offline || !documentId) return null;
  const { health, rights, pageId } = page;
  return (
    <PageAiContext
      inContext={page.trust.fields.context === true}
      tokens={health?.knowledge.tokens}
      answered={health ? (health.answered ?? []) : undefined}
      agents={health ? (health.agents ?? []) : undefined}
      onSetContext={
        rights.editFields
          ? (on) => {
              track('UI', on ? 'Added' : 'Removed', 'ContextPage');
              page.setFields(pageId, { context: on }, 'context');
            }
          : undefined
      }
    />
  );
}
