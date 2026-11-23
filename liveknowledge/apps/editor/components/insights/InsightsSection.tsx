// One card of the Insights dashboard (docs/specs/030-knowledgebase/insights.md "The view, as built"): its
// glyph and heading, one line about it, an action at its right (under the heading where there is no room), and its
// rows or its empty state. A figure tile brings it into view and focuses it, so it takes focus without being a stop.
import type { ReactNode } from 'react';
import { CountBadge } from '@liveknowledge/ui';

export const INSIGHTS_CARD =
  'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
export const INSIGHTS_CHIP =
  'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200';
export const INSIGHTS_MUTED = 'text-slate-600 dark:text-slate-400';

export function InsightsSection({
  id,
  title,
  about,
  count,
  action,
  icon,
  className = '',
  children,
}: {
  id: string;
  title: string;
  // The card's glyph, before its heading.
  icon?: ReactNode;
  className?: string;
  about: string;
  // How many rows, beside the heading; left out at none.
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      data-ai-section={id}
      tabIndex={-1}
      className={`${INSIGHTS_CARD} min-w-0 scroll-mt-4 p-4 outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:p-5 ${className}`}
    >
      {/* The heading row (glyph, words, action), then the line about the card under it at full width, so a narrow
          card keeps its action beside its heading. */}
      <div className="mb-4">
        <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
          {icon ? (
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 [&_svg]:size-4"
            >
              {icon}
            </span>
          ) : null}
          <h2 className="flex flex-1 items-center gap-2 whitespace-nowrap text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            {/* The card is named by its words alone; the count is beside them. */}
            <span id={id}>{title}</span>
            {count ? <CountBadge count={count} /> : null}
          </h2>
          {action ? <div className="ml-auto max-w-full shrink-0">{action}</div> : null}
        </div>
        <p className={`mt-1.5 text-[13px] leading-5 ${INSIGHTS_MUTED}`}>{about}</p>
      </div>
      {children}
    </section>
  );
}
