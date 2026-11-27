'use client';

// One tile of the Insights dashboard (docs/specs/030-knowledgebase/insights.md "The dashboard"): a topic's summary
// and the way into its page. Its heading is its one button, stretched over the whole tile, so pressing anywhere
// opens the topic; a control of the tile's own (Needs Attention's counts) stands above that cover.
import { useId, type ReactNode } from 'react';
import { INSIGHTS_CARD, INSIGHTS_MUTED } from './InsightsSection';
import { RowChevronIcon } from './insights-icons';

/** Lifts a control of the tile's own above the cover that opens the topic. */
export const ABOVE_COVER = 'relative z-10';

export function TopicTile({
  topic,
  label,
  icon,
  figure,
  line,
  spoken,
  attention = false,
  onOpen,
  children,
}: {
  topic: string;
  label: string;
  icon: ReactNode;
  figure: string;
  // Under the figure: what it counts.
  line: ReactNode;
  // Said with the line as the button's description: a picture's words.
  spoken?: string;
  attention?: boolean;
  onOpen: () => void;
  // The picture and the rows to look at first.
  children?: ReactNode;
}) {
  const heading = useId();
  const about = useId();
  return (
    <section
      aria-labelledby={heading}
      data-topic-tile={topic}
      className={`${INSIGHTS_CARD} group relative flex min-w-0 flex-col p-4 transition-[border-color,box-shadow] duration-micro hover:border-slate-300 hover:shadow-sm sm:p-5 dark:hover:border-slate-600`}
    >
      <h2 className="flex min-h-8 items-center">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${label}`}
          aria-describedby={about}
          data-topic-open={topic}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left text-base font-semibold tracking-tight text-slate-900 outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-600 dark:text-white"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 [&_svg]:size-4"
          >
            {icon}
          </span>
          <span id={heading} className="min-w-0 truncate">
            {label}
          </span>
          {attention ? (
            <span
              aria-hidden
              data-attention=""
              className="h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-500/25"
            />
          ) : null}
          <span
            aria-hidden
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition duration-micro group-hover:bg-slate-100 group-hover:text-slate-700 motion-safe:group-hover:translate-x-0.5 dark:text-slate-400 dark:group-hover:bg-slate-800 dark:group-hover:text-slate-200"
          >
            <RowChevronIcon />
          </span>
        </button>
      </h2>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
        {figure}
      </p>
      <p id={about} className={`mt-0.5 min-w-0 text-[13px] leading-5 ${INSIGHTS_MUTED}`}>
        {line}
        {spoken ? <span className="sr-only">. {spoken}</span> : null}
      </p>
      {children}
    </section>
  );
}

/** The rows to look at first, under a hairline: one line each, cut to fit. */
export function TopicPreview({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul
      aria-label={label}
      data-topic-preview=""
      className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"
    >
      {children}
    </ul>
  );
}

/** One preview row: a glyph, its words and, at its right, a figure or a chip. */
export function PreviewRow({
  icon,
  text,
  end,
}: {
  icon?: ReactNode;
  text: string;
  end?: ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-center gap-2 text-[13px] leading-5 text-slate-700 dark:text-slate-200">
      {icon ? (
        <span aria-hidden className="flex shrink-0 text-slate-400 dark:text-slate-400">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {end ? <span className="shrink-0">{end}</span> : null}
    </li>
  );
}

/** A quiet line under the preview: "3 more", "4 pages not read in 90 days". */
export function PreviewNote({ children }: { children: ReactNode }) {
  return <p className={`mt-2 text-xs leading-5 ${INSIGHTS_MUTED}`}>{children}</p>;
}
