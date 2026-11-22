'use client';

// Knowledge Health and Always in Context (docs/specs/030-knowledgebase/ai-knowledge.md). Health is one stacked bar:
// Verified, Review Due and Never Verified, dark, mid and light, so the three differ in lightness as well as hue,
// with a legend that says each count. Remind the Owners emails each owner their due and never-verified pages, once
// a week (knowledge-email-routes.ts); in that week the section says when they were reminded in the button's place.
// Always in Context lists the pages every agent is handed first, each with its size, against the budget.
import type {
  KnowledgeContextPage,
  KnowledgeHealthCounts,
  KnowledgeLowHealthPage,
} from '@liveknowledge/api-schema';
import { HEALTH_HEALTHY_MIN } from '@liveknowledge/knowledge';
import { HealthChip } from '@/components/knowledge/HealthChip';
import { Button, CompactEmptyState, HoverCard } from '@liveknowledge/ui';
import { ownersEmailedText, remindedThisWeek } from '@/lib/knowledge-ask/email-words';
import {
  budgetText,
  healthParts,
  tokensText,
  type HealthPart,
} from '@/lib/knowledge-ask/overview-words';
import { AddIcon, ContextIcon, DismissIcon, HealthIcon, RemindIcon } from './ai-knowledge-icons';
import { AI_MUTED, AiSection } from './AiSection';
import { useShowAll } from './useShowAll';

export const CONTEXT_CAP = 5;

// Light theme: dark, mid, light. Dark theme: light, mid, dark. Each neighbour is a clear step of lightness apart.
const HEALTH_FILL: Record<HealthPart['key'], string> = {
  verified: 'bg-brand-700 dark:bg-brand-300',
  reviewDue: 'bg-amber-400 dark:bg-amber-500',
  neverVerified: 'bg-slate-300 dark:bg-slate-600',
};

const LOW_ROW =
  'group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 dark:hover:bg-slate-800/60';

/** Pages With Low Health (ai-knowledge.md "Knowledge Health"): up to 5, lowest first, each opening its page. */
function LowHealthPages({
  pages,
  onOpenPage,
}: {
  pages: readonly KnowledgeLowHealthPage[];
  onOpenPage: (tab: string) => void;
}) {
  return (
    <div data-low-health="" className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Pages With Low Health
      </p>
      {pages.length === 0 ? (
        <p className={`mt-2 text-[13px] ${AI_MUTED}`}>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            Every Page Is Healthy
          </span>
          <span className="block">Every page scores {HEALTH_HEALTHY_MIN} or more.</span>
        </p>
      ) : (
        <ol className="-mx-2 mt-1 flex flex-col">
          {pages.map((page) => (
            <li key={page.tab} data-low-health-page={page.tab}>
              <button type="button" onClick={() => onOpenPage(page.tab)} className={LOW_ROW}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 underline-offset-2 group-hover:underline dark:text-slate-100">
                    {page.title || 'Untitled Page'}
                  </span>
                  <span className={`block truncate text-xs ${AI_MUTED}`}>{page.reason}</span>
                </span>
                <HealthChip score={page.score} label={page.label} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function HealthSection({
  health,
  lowHealth,
  canRemind,
  remindedAt,
  reminding,
  now,
  onRemind,
  onOpenPage,
}: {
  health: KnowledgeHealthCounts;
  /** Absent from an older api: the list is not drawn. */
  lowHealth: readonly KnowledgeLowHealthPage[] | undefined;
  onOpenPage: (tab: string) => void;
  // A signed-in Editor, where this deployment sends email.
  canRemind: boolean;
  remindedAt: number | undefined;
  reminding: boolean;
  now: number;
  onRemind: () => void;
}) {
  const { parts, label } = healthParts(health);
  // Rounded down, as the Verified tile is, so one page unverified never reads as 100%.
  const share = health.total === 0 ? 0 : Math.floor((health.verified / health.total) * 100);
  // Nobody to remind while every page is verified.
  const toReview = health.reviewDue + health.neverVerified;
  return (
    <AiSection
      id="ai-health"
      title="Knowledge Health"
      icon={<HealthIcon />}
      about="How much of this knowledgebase someone vouches for, from each page's review date."
      action={
        !canRemind || toReview === 0 ? undefined : remindedThisWeek(remindedAt, now) ? (
          <span className={`flex min-h-8 items-center gap-1.5 text-xs ${AI_MUTED}`}>
            <RemindIcon />
            {ownersEmailedText('remind', remindedAt!, now)}
          </span>
        ) : (
          <Button
            variant="secondary"
            size="xs"
            busy={reminding}
            onClick={onRemind}
            className="phone:min-h-11"
          >
            <RemindIcon />
            Remind the Owners
          </Button>
        )
      }
    >
      {health.total === 0 ? (
        <CompactEmptyState
          icon={<HealthIcon />}
          title="No Pages Yet"
          description="Once there are pages, their verified share shows here."
        />
      ) : (
        <>
          <p className="mb-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
              {share}%
            </span>
            <span className={`text-[13px] ${AI_MUTED}`}>
              of {health.total.toLocaleString('en')} {health.total === 1 ? 'page' : 'pages'}{' '}
              verified
            </span>
            {health.average === undefined ? null : (
              <span
                data-health-average=""
                className="ml-auto whitespace-nowrap text-[13px] text-slate-600 dark:text-slate-300"
              >
                Average health{' '}
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                  {health.average}
                </span>
              </span>
            )}
          </p>
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
          {lowHealth ? <LowHealthPages pages={lowHealth} onOpenPage={onOpenPage} /> : null}
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
  const { shown, toggle } = useShowAll(context.pages, CONTEXT_CAP);
  const share = context.budget > 0 ? Math.min(100, (context.used / context.budget) * 100) : 0;
  return (
    <AiSection
      id="ai-context"
      title="Always in Context"
      icon={<ContextIcon />}
      about="Pages every agent is handed first. Keep them few and short."
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
        <>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((page) => (
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
          {toggle}
        </>
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
