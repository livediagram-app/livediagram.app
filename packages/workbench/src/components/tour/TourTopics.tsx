'use client';

import type { ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideCheck, lucideChevronRight } from '@liveworkspace/icons/lucide';

// A tour's start panel body (livediagram docs/specs/007-editor/watch-it-built.md "The start panel"; liveplanner
// docs/specs/026-plan/plan-tour.md "Starting a tour"): "What would you like to learn?", a line, then the tour's topics
// as rows, each with its name, its length in a badge beside it, one line on what it teaches and a Done tick once
// taken. Any row starts its topic, a
// taken one again too. Presentational: each product draws it in its own frame (a player card, a mission strip) with its
// own Not Now, and keeps its own records.

const TickIcon = lucideGlyph(lucideCheck, 12);
const OpenIcon = lucideGlyph(lucideChevronRight, 16);

export type TourTopic<Id extends string = string> = {
  id: Id;
  title: string;
  // What it teaches, in one line.
  line: string;
  // Its length ("30 s", "5 quick missions"), a badge right of the title.
  meta?: string;
  taken: boolean;
  // Its glyph, on a plate at the row's left, as a tool's is in Tools.
  icon?: ReactNode;
};

export function TourTopics<Id extends string>({
  heading,
  line,
  topics,
  onPick,
  idAttribute = 'data-tour-topic',
}: {
  // Absent where the frame already titles it (the Get Started popover's hero header).
  heading?: string;
  line?: string;
  topics: readonly TourTopic<Id>[];
  onPick: (id: Id) => void;
  // The data attribute each row carries its id in, for a product's tests and drivers (liveplanner's data-tour-track).
  idAttribute?: `data-${string}`;
}) {
  return (
    <div data-tour-topics="" className="flex flex-col gap-3">
      {heading ? (
        <div>
          <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
            {heading}
          </h3>
          {line ? (
            <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
              {line}
            </p>
          ) : null}
        </div>
      ) : null}
      <ul className="-mx-1.5 flex flex-col">
        {topics.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              {...{ [idAttribute]: t.id }}
              onClick={() => onPick(t.id)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-1.5 py-2 text-left outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
            >
              {t.icon ? (
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_var(--color-brand-100)] transition-colors group-hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:shadow-none dark:group-hover:bg-brand-500/25"
                >
                  {t.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  {/* The name wraps if it must; its length and Done pills stay whole on one line beside it. */}
                  <span className="min-w-0 text-[14px] font-semibold leading-tight text-slate-900 dark:text-white">
                    {t.title}
                  </span>
                  {t.meta ? (
                    <span
                      data-tour-topic-meta=""
                      className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-px text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {t.meta}
                    </span>
                  ) : null}
                  {t.taken ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <TickIcon />
                      Done
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
                  {t.line}
                </span>
              </span>
              <span className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-slate-400">
                <OpenIcon />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
