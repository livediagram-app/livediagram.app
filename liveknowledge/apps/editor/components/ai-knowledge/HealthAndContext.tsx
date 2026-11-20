'use client';

// Knowledge Health and Always in Context (docs/specs/030-knowledgebase/ai-knowledge.md). Health is one stacked bar:
// Verified, Review Due and Never Verified, dark, mid and light, so the three differ in lightness as well as hue,
// with a legend that says each count. "Remind the Owners" waits for the knowledgebase's emails and is not drawn.
// Always in Context lists the pages every agent is handed first, each with its size, against the budget.
import type { KnowledgeContextPage, KnowledgeHealthCounts } from '@liveknowledge/api-schema';
import { Button, CompactEmptyState, HoverCard } from '@liveknowledge/ui';
import {
  budgetText,
  healthParts,
  tokensText,
  type HealthPart,
} from '@/lib/knowledge-ask/overview-words';
import { AddIcon, ContextIcon, DismissIcon, HealthIcon } from './ai-knowledge-icons';
import { AI_MUTED, AiSection } from './AiSection';

// Light theme: dark, mid, light. Dark theme: light, mid, dark. Each neighbour is a clear step of lightness apart.
const HEALTH_FILL: Record<HealthPart['key'], string> = {
  verified: 'bg-brand-700 dark:bg-brand-300',
  reviewDue: 'bg-amber-400 dark:bg-amber-500',
  neverVerified: 'bg-slate-300 dark:bg-slate-600',
};

export function HealthSection({ health }: { health: KnowledgeHealthCounts }) {
  const { parts, label } = healthParts(health);
  return (
    <AiSection
      id="ai-health"
      title="Knowledge Health"
      about="How much of this knowledgebase someone vouches for, worked out now from each page's review date."
    >
      {health.total === 0 ? (
        <CompactEmptyState
          icon={<HealthIcon />}
          title="No Pages Yet"
          description="Once there are pages, their verified share shows here."
        />
      ) : (
        <>
          <div
            role="img"
            aria-label={label}
            data-health-bar=""
            className="flex h-3 gap-px overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          >
            {parts.map((part) =>
              part.pages > 0 ? (
                <span
                  key={part.key}
                  data-health-part={part.key}
                  className={HEALTH_FILL[part.key]}
                  style={{ flexGrow: part.pages, flexBasis: 0, minWidth: 4 }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Legend">
            {parts.map((part) => (
              <li key={part.key} className="flex items-center gap-2 text-[13px]">
                <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${HEALTH_FILL[part.key]}`} />
                <span className="text-slate-900 dark:text-slate-100">{part.label}</span>
                <span className={`tabular-nums ${AI_MUTED}`}>
                  {part.pages.toLocaleString('en')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AiSection>
  );
}

export function ContextSection({
  context,
  canEdit,
  busy,
  onAdd,
  onRemove,
  onOpenPage,
}: {
  context: { budget: number; used: number; pages: readonly KnowledgeContextPage[] };
  canEdit: boolean;
  busy: ReadonlySet<string>;
  onAdd: () => void;
  onRemove: (tab: string) => void;
  onOpenPage: (tab: string) => void;
}) {
  const over = context.used > context.budget;
  const share = context.budget > 0 ? Math.min(100, (context.used / context.budget) * 100) : 0;
  return (
    <AiSection
      id="ai-context"
      title="Always in Context"
      about="Pages every agent is handed before it starts. Keep them few and short: they are sent with every task."
      count={context.pages.length}
      action={
        canEdit ? (
          <Button variant="secondary" size="xs" onClick={onAdd} className="phone:min-h-11">
            <AddIcon />
            Add a Page
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3">
        <div
          role="progressbar"
          aria-label="Always in Context budget"
          aria-valuemin={0}
          aria-valuemax={context.budget}
          aria-valuenow={Math.min(context.used, context.budget)}
          aria-valuetext={budgetText(context.used, context.budget)}
          className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <span
            className={`block h-full rounded-full ${
              over ? 'bg-amber-500' : 'bg-brand-600 dark:bg-brand-400'
            }`}
            style={{ width: `${share}%` }}
          />
        </div>
        <p className={`mt-1.5 text-[13px] tabular-nums ${AI_MUTED}`} data-context-budget="">
          {budgetText(context.used, context.budget)}
        </p>
      </div>
      {context.pages.length === 0 ? (
        <CompactEmptyState
          icon={<ContextIcon />}
          title="No Pages in Context Yet"
          description={
            canEdit
              ? 'Add the pages an agent should always know: how the team works, where things are.'
              : 'An Editor chooses the pages every agent is handed first.'
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {context.pages.map((page) => (
            <li
              key={page.tab}
              data-context-page={page.tab}
              className="flex min-h-11 items-center gap-3 py-1"
            >
              <button
                type="button"
                onClick={() => onOpenPage(page.tab)}
                className="min-w-0 flex-1 cursor-pointer truncate rounded text-left text-sm font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-100"
              >
                {page.title || 'Untitled Page'}
              </button>
              <span className={`shrink-0 text-[13px] tabular-nums ${AI_MUTED}`}>
                {tokensText(page.tokens)}
              </span>
              {canEdit ? (
                <HoverCard title="Remove" description="Takes this page out of Always in Context.">
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Remove ${page.title || 'Untitled Page'} from Always in Context`}
                    busy={busy.has(`context:${page.tab}`)}
                    onClick={() => onRemove(page.tab)}
                    className="shrink-0 !px-2 phone:min-h-11 phone:min-w-11"
                  >
                    <DismissIcon />
                  </Button>
                </HoverCard>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AiSection>
  );
}

/** What an Agent Sees: a short sample of how one search result reads to an agent. Dark in both themes, as a
 *  terminal is; the sample is text. */
export function AgentSampleCard({ sample }: { sample: string }) {
  return (
    <section
      aria-labelledby="ai-sample"
      data-ai-section="ai-sample"
      className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-100 sm:p-5"
    >
      <h2 id="ai-sample" className="text-base font-semibold tracking-tight text-white">
        What an Agent Sees
      </h2>
      <p className="mt-0.5 text-[13px] leading-5 text-slate-200">
        A search result as an agent reads it: the passage, its page, and how far to trust it.
      </p>
      <pre
        tabIndex={0}
        aria-label="A sample search result"
        className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-slate-900 p-4 font-mono text-[12.5px] leading-6 text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      >
        {sample}
      </pre>
    </section>
  );
}
