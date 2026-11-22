'use client';

// AI Context in the right rail (docs/specs/030-knowledgebase/ai-knowledge.md "AI Context on a page"): whether every
// agent is handed this page first. The agents that read it this week are Read This Week's popover now (ReadByAgents.tsx,
// owner 2026-11-22). The questions Ask answered from it are Page Insights' now (PageInsights.tsx). It reads nothing of its
// own: the agents ride Page Health's one read. Quiet, as the rest of the rail is: small-capital headings, no card, no
// border.
import { useId } from 'react';
import { Switch } from '@liveknowledge/ui';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { track } from '@/lib/telemetry';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ContextIcon } from './knowledge-icons';
import { RAIL_LABEL } from './PageHealthCard';
import type { PageKnowledgeView } from './usePageKnowledge';

export type PageAiContextProps = {
  inContext: boolean;
  /** The page's size against the budget; undefined before Page Health is read. */
  tokens: number | undefined;
  /** Absent for anyone who may not change it: the state reads as words. */
  onSetContext: ((on: boolean) => void) | undefined;
};

const QUIET = 'text-[13px] leading-5 text-slate-500 dark:text-slate-400';

/** "About 1,200 tokens". */
export const aboutTokens = (n: number): string =>
  `About ${n.toLocaleString('en')} ${n === 1 ? 'token' : 'tokens'}`;

export function PageAiContext({ inContext, tokens, onSetContext }: PageAiContextProps) {
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
