'use client';

// The Knowledgebase Home's sections under the hero (docs/specs/030-knowledgebase/knowledgebase-home.md):
// Knowledgebases, Yours to Review, Recently Updated and Start a Page From. Each list keeps the height of its rows
// while its numbers are read, so nothing moves when they arrive.
import type { ReactNode } from 'react';
import type { KnowledgeSummaryResponse } from '@liveknowledge/api-schema';
import { Button, CompactEmptyState, EmptyState, buttonClassName } from '@liveknowledge/ui';
import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';
import {
  pagesText,
  verifiedPercent,
  type HomeKnowledgebase,
  type HomeRecentPage,
} from '@/lib/knowledge-home/home-data';
import {
  NEW_KNOWLEDGEBASE_HREF,
  knowledgebaseHref,
  pageHref,
  templateHref,
} from '@/lib/knowledge-home/home-links';
import { reviewDueText, shortDate } from '@/lib/knowledge/page-trust';
import {
  ArrowIcon,
  DesignDocIcon,
  HandbookIcon,
  ImportIcon,
  KnowledgebaseIcon,
  MeetingNotesIcon,
  NewIcon,
  PageIcon,
  RecentIcon,
  ReviewIcon,
} from './home-icons';

const SECTION_TITLE = 'text-lg font-semibold tracking-tight text-slate-900 dark:text-white';
const CARD = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
const LINK_CARD = `${CARD} cursor-pointer motion-safe:transition-[border-color,box-shadow] motion-safe:duration-micro hover:border-brand-400 hover:shadow-md hover:shadow-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:border-brand-500`;
const SKELETON = 'rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-800';

function Section({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id: string;
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <div className="mb-4 flex min-h-8 items-center justify-between gap-3">
        <h2 id={id} className={SECTION_TITLE}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// The share of pages verified, as a thin bar and its number.
function VerifiedBar({ summary }: { summary: KnowledgeSummaryResponse }) {
  const percent = verifiedPercent(summary.health);
  return (
    <>
      <p className="mt-1 flex items-center justify-between gap-2 text-[13px] text-slate-600 dark:text-slate-400">
        <span>{pagesText(summary.pages)}</span>
        <span>{percent === null ? 'No pages yet' : `${percent}% verified`}</span>
      </p>
      <span
        role="img"
        aria-label={
          percent === null ? 'No pages to verify' : `${percent} percent of pages verified`
        }
        className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <span
          className="block h-full rounded-full bg-brand-600 dark:bg-brand-400"
          style={{ width: `${percent ?? 0}%` }}
        />
      </span>
    </>
  );
}

const GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function HomeKnowledgebases({
  loading,
  knowledgebases,
  total,
  summaries,
  summaryFailed,
}: {
  loading: boolean;
  knowledgebases: readonly HomeKnowledgebase[];
  total: number;
  summaries: ReadonlyMap<string, KnowledgeSummaryResponse>;
  summaryFailed: ReadonlySet<string>;
}) {
  return (
    <Section
      id="home-knowledgebases"
      title="Knowledgebases"
      action={
        total > knowledgebases.length ? (
          <a
            href={EXPLORER_LANDING_PATH}
            className={buttonClassName({ variant: 'ghost', size: 'xs' })}
          >
            See All
            <ArrowIcon />
          </a>
        ) : undefined
      }
    >
      {loading ? (
        <ul className={GRID} role="status" aria-label="Loading your knowledgebases">
          {[0, 1, 2, 3].map((at) => (
            <li key={at} className={`${CARD} h-[7.25rem] p-4`}>
              <span className={`${SKELETON} block h-4 w-2/3`} />
              <span className={`${SKELETON} mt-4 block h-3 w-full`} />
              <span className={`${SKELETON} mt-3 block h-1.5 w-full`} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={GRID}>
          {knowledgebases.map((knowledgebase) => {
            const summary = summaries.get(knowledgebase.id);
            return (
              <li key={knowledgebase.id}>
                <a
                  href={knowledgebaseHref(knowledgebase.id)}
                  data-home-knowledgebase={knowledgebase.id}
                  className={`${LINK_CARD} block h-[7.25rem] p-4`}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="shrink-0 text-brand-700 dark:text-brand-300">
                      <KnowledgebaseIcon />
                    </span>
                    <span className="min-w-0 truncate text-[15px] font-semibold text-slate-900 dark:text-white">
                      {knowledgebase.name}
                    </span>
                  </span>
                  <span className="mt-2 block">
                    {summary ? (
                      <VerifiedBar summary={summary} />
                    ) : summaryFailed.has(knowledgebase.id) ? (
                      <span className="mt-1 block text-[13px] text-slate-600 dark:text-slate-400">
                        Its numbers could not be read.
                      </span>
                    ) : (
                      <span role="status" aria-label="Loading its numbers" className="block">
                        <span className={`${SKELETON} mt-2 block h-3 w-full`} />
                        <span className={`${SKELETON} mt-3 block h-1.5 w-full`} />
                      </span>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export type HomeReviewRow = {
  documentId: string;
  knowledgebase: string;
  tab: string;
  title: string;
  reviewAt: number;
};

/** Yours to Review (verification.md "Reminders"): the pages this person owns that are due, oldest first. Nothing at
 *  all when there are none. */
export function HomeReview({
  rows,
  now,
  verifying,
  onStillRight,
}: {
  rows: readonly HomeReviewRow[];
  now: number;
  // The rows being verified now, as `<documentId>:<tab>`.
  verifying: ReadonlySet<string>;
  onStillRight: (row: HomeReviewRow) => void;
}) {
  if (rows.length === 0) return null;
  const oldestFirst = [...rows].sort((a, b) => a.reviewAt - b.reviewAt);
  return (
    <Section id="home-review" title="Yours to Review">
      <ul className="overflow-hidden rounded-2xl border border-amber-300 bg-white dark:border-amber-500/40 dark:bg-slate-900">
        {oldestFirst.map((row) => (
          <li
            key={`${row.documentId}:${row.tab}`}
            className="flex min-h-14 items-center gap-3 border-b border-amber-200 px-4 py-2 last:border-b-0 dark:border-amber-500/20"
          >
            <span aria-hidden className="shrink-0 text-amber-700 dark:text-amber-300">
              <ReviewIcon />
            </span>
            <span className="min-w-0 flex-1">
              <a
                href={pageHref(row.documentId, row.tab)}
                className="block truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-white"
              >
                {row.title || 'Untitled Page'}
              </a>
              <span className="block truncate text-xs text-slate-600 dark:text-slate-400">
                {row.knowledgebase} · {reviewDueText(row.reviewAt, now)}
              </span>
            </span>
            <Button
              variant="secondary"
              size="xs"
              busy={verifying.has(`${row.documentId}:${row.tab}`)}
              onClick={() => onStillRight(row)}
              className="shrink-0 phone:min-h-11"
            >
              Still Right
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function HomeRecent({
  loading,
  pages,
  now,
}: {
  loading: boolean;
  pages: readonly HomeRecentPage[];
  now: number;
}) {
  return (
    <Section id="home-recent" title="Recently Updated">
      {loading ? (
        <ul
          className={`${CARD} divide-y divide-slate-100 dark:divide-slate-800`}
          role="status"
          aria-label="Loading recent pages"
        >
          {[0, 1, 2, 3].map((at) => (
            <li key={at} className="flex h-12 items-center px-4">
              <span className={`${SKELETON} block h-3 w-1/2`} />
            </li>
          ))}
        </ul>
      ) : pages.length === 0 ? (
        <div className={CARD}>
          <CompactEmptyState
            icon={<RecentIcon />}
            title="No Pages Updated Yet"
            description="The pages your team changes last show here."
          />
        </div>
      ) : (
        <ul className={`${CARD} divide-y divide-slate-100 overflow-hidden dark:divide-slate-800`}>
          {pages.map((page) => (
            <li key={`${page.documentId}:${page.tab}`}>
              <a
                href={pageHref(page.documentId, page.tab)}
                data-home-recent=""
                className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800/60"
              >
                <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
                  <PageIcon />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                  {page.title || 'Untitled Page'}
                </span>
                <span className="hidden min-w-0 max-w-[40%] truncate text-[13px] text-slate-600 dark:text-slate-400 sm:block">
                  {page.knowledgebase}
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-slate-600 dark:text-slate-400">
                  {shortDate(page.updatedAt, now)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const TILE = `${LINK_CARD} flex min-h-[6.5rem] w-full flex-col items-center justify-center gap-2.5 px-3 py-4 text-center text-sm font-medium text-slate-900 dark:text-white`;
const TILE_ICON =
  'flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200';

/** The kept article templates Home starts a knowledgebase from, under their own names. */
export const HOME_TEMPLATES = [
  { kind: 'meeting-notes', label: 'Meeting Notes', icon: <MeetingNotesIcon /> },
  { kind: 'design-doc', label: 'Design Doc', icon: <DesignDocIcon /> },
  { kind: 'onboarding-handbook', label: 'Onboarding Handbook', icon: <HandbookIcon /> },
] as const;

export function HomeStartTiles({ onImport }: { onImport: () => void }) {
  return (
    <Section id="home-start" title="Start a Page From">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HOME_TEMPLATES.map((template) => (
          <li key={template.kind}>
            <a
              href={templateHref(template.kind)}
              data-home-template={template.kind}
              className={TILE}
            >
              <span aria-hidden className={TILE_ICON}>
                {template.icon}
              </span>
              {template.label}
            </a>
          </li>
        ))}
        <li>
          <button type="button" onClick={onImport} data-home-import="" className={TILE}>
            <span aria-hidden className={TILE_ICON}>
              <ImportIcon />
            </span>
            Import
          </button>
        </li>
      </ul>
    </Section>
  );
}

/** Nobody's first visit: one card, Make Your First Knowledgebase, with Import beside it. */
export function HomeFirstKnowledgebase({ onImport }: { onImport: () => void }) {
  return (
    <div className="mt-4" data-home-first="">
      <EmptyState
        icon={<KnowledgebaseIcon />}
        title="No Knowledgebases Yet"
        description="A knowledgebase is your team's pages in one tree, searchable and answerable. Start one, or bring in what you already have from Markdown, Notion or Confluence."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href={NEW_KNOWLEDGEBASE_HREF}
            className={buttonClassName({ variant: 'primary', size: 'md' })}
          >
            <NewIcon />
            Make Your First Knowledgebase
          </a>
          <Button variant="secondary" size="md" onClick={onImport}>
            Import
          </Button>
        </div>
      </EmptyState>
    </div>
  );
}
