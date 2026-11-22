'use client';

// Waiting for Your Approval on Knowledgebase Home (docs/specs/030-knowledgebase/approval.md "Where it shows"): the
// pages Pending Approval that the person did not ask for, in the knowledgebases they may write, oldest request first,
// read from the summaries Home already makes (no request of its own). Each opens its page, where Approve and Reject
// are. Nothing at all when there are none.
import type { KnowledgeSummaryResponse } from '@liveknowledge/api-schema';
import { buttonClassName } from '@liveknowledge/ui';
import type { HomeKnowledgebase } from '@/lib/knowledge-home/home-data';
import { pageHref } from '@/lib/knowledge-home/home-links';
import { relativeSince } from '@/lib/relative-time';
import { PendingIcon } from '@/components/knowledge/approval/feedback-icons';
import { Section } from './HomeSections';

export type HomeAwaitingRow = {
  documentId: string;
  knowledgebase: string;
  tab: string;
  title: string;
  requestedAt: number;
  requestedByAgent?: string;
};

/** Every knowledgebase's waiting pages as one list, oldest request first. */
export function awaitingApprovalAcross(
  knowledgebases: readonly HomeKnowledgebase[],
  summaries: ReadonlyMap<string, KnowledgeSummaryResponse>,
): HomeAwaitingRow[] {
  const rows: HomeAwaitingRow[] = [];
  for (const knowledgebase of knowledgebases)
    for (const page of summaries.get(knowledgebase.id)?.awaitingApproval ?? [])
      rows.push({
        documentId: knowledgebase.id,
        knowledgebase: knowledgebase.name,
        tab: page.tab,
        title: page.title,
        requestedAt: page.requestedAt,
        ...(page.requestedByAgent ? { requestedByAgent: page.requestedByAgent } : {}),
      });
  return rows.sort((a, b) => a.requestedAt - b.requestedAt);
}

export function HomeAwaitingApproval({
  rows,
  now,
}: {
  rows: readonly HomeAwaitingRow[];
  now: number;
}) {
  if (rows.length === 0) return null;
  return (
    <Section id="home-awaiting-approval" title="Waiting for Your Approval">
      <ul className="overflow-hidden rounded-2xl border border-violet-200 bg-white dark:border-violet-500/30 dark:bg-slate-900">
        {rows.map((row) => {
          const href = pageHref(row.documentId, row.tab);
          return (
            <li
              key={`${row.documentId}:${row.tab}`}
              data-awaiting-approval=""
              className="flex min-h-14 items-center gap-3 border-b border-violet-100 px-4 py-2 last:border-b-0 dark:border-violet-500/20"
            >
              <span aria-hidden className="shrink-0 text-violet-700 dark:text-violet-300">
                <PendingIcon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <a
                  href={href}
                  className="block truncate text-sm font-medium text-slate-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-white"
                >
                  {row.title || 'Untitled Page'}
                </a>
                <span className="block truncate text-xs text-slate-600 dark:text-slate-400">
                  {row.knowledgebase} · Requested
                  {row.requestedByAgent ? ` by ${row.requestedByAgent}` : ''}{' '}
                  {relativeSince(row.requestedAt, now)}
                </span>
              </span>
              <a
                href={href}
                aria-label={`Review ${row.title || 'Untitled Page'}`}
                className={`${buttonClassName({ variant: 'secondary', size: 'xs' })} shrink-0 cursor-pointer phone:min-h-11`}
              >
                Review
              </a>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
