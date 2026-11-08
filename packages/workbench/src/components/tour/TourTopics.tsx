'use client';

import { lucideGlyph } from '@liveworkspace/ui';
import { lucideCheck, lucideChevronRight } from '@liveworkspace/icons/lucide';

// A tour's start panel body (livediagram docs/specs/007-editor/watch-it-built.md "The start panel"; liveplanner
// docs/specs/026-plan/plan-tour.md "Starting a tour"): "What would you like to learn?", a line, then the tour's topics
// as rows, each with its name, one line on what it teaches and a Done tick once taken. Any row starts its topic, a
// taken one again too. Presentational: each product draws it in its own frame (a player card, a mission strip) with its
// own Not Now, and keeps its own records.

const TickIcon = lucideGlyph(lucideCheck, 12);
const OpenIcon = lucideGlyph(lucideChevronRight, 16);

export type TourTopic<Id extends string = string> = {
  id: Id;
  title: string;
  // What it teaches, in one line.
  line: string;
  // A short note after the line ("30 s", "5 quick missions").
  meta?: string;
  taken: boolean;
};

export function TourTopics<Id extends string>({
  heading,
  line,
  topics,
  onPick,
}: {
  heading: string;
  line: string;
  topics: readonly TourTopic<Id>[];
  onPick: (id: Id) => void;
}) {
  return (
    <div data-tour-topics="" className="flex flex-col gap-3">
      <div>
        <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
          {heading}
        </h3>
        <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">{line}</p>
      </div>
      <ul className="-mx-1.5 flex flex-col">
        {topics.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              data-tour-topic={t.id}
              onClick={() => onPick(t.id)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-1.5 py-2 text-left outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold leading-tight text-slate-900 dark:text-white">
                    {t.title}
                  </span>
                  {t.taken ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <TickIcon />
                      Done
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
                  {t.line}
                  {t.meta ? (
                    <span className="text-slate-400 dark:text-slate-500"> · {t.meta}</span>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-slate-500">
                <OpenIcon />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
