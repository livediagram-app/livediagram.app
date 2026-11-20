// One section of AI Knowledge (docs/specs/030-knowledgebase/ai-knowledge.md): a card with its heading, one line
// about it, an action at its right, and its rows or its empty state.
import type { ReactNode } from 'react';
import { CountBadge } from '@liveknowledge/ui';

export const AI_CARD =
  'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
export const AI_CHIP =
  'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200';
export const AI_MUTED = 'text-slate-600 dark:text-slate-400';

export function AiSection({
  id,
  title,
  about,
  count,
  action,
  children,
}: {
  id: string;
  title: string;
  about: string;
  // How many rows, beside the heading; left out at none.
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} data-ai-section={id} className={`${AI_CARD} p-4 sm:p-5`}>
      <div className="mb-4 flex min-h-9 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            {/* The section is named by its words alone; the count is beside them. */}
            <span id={id}>{title}</span>
            {count ? <CountBadge count={count} /> : null}
          </h2>
          <p className={`mt-0.5 text-[13px] leading-5 ${AI_MUTED}`}>{about}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
