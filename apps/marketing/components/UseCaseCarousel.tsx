'use client';

import { useState } from 'react';
import { Sketch, type SketchKind } from './use-case-sketches';

// Use-case carousel: a deliberately different layout from the FeatureGrid
// sections. One large featured use case with two smaller ones stacked
// beside it, and prev/next arrows to rotate through the rest. Clicking a
// side card promotes it to the featured slot and the list rotates so a new
// card fills the vacated place. The whole thing is illustrative (it shows
// what people build), so the cards don't link anywhere; the page's CTAs
// handle conversion.
//
// Every use case maps to something the editor actually ships today
// (templates in apps/live/lib/templates.ts + the shape palette), keeping
// the marketing golden rule intact: claims map to shipped features
// (see specs/16-marketing-site.md).

type UseCase = {
  key: string;
  title: string;
  blurb: string;
  sketch: SketchKind;
};

const USE_CASES: UseCase[] = [
  {
    key: 'flowchart',
    title: 'Flowcharts & process maps',
    blurb:
      'Map a process step by step, branch on decisions, and let arrows re-route themselves as you move things around.',
    sketch: 'flowchart',
  },
  {
    key: 'architecture',
    title: 'System architecture',
    blurb:
      'Lay out services, queues, and data stores, then link the pieces. Split a big system across tabs and jump between them.',
    sketch: 'architecture',
  },
  {
    key: 'mindmap',
    title: 'Mind maps & brainstorms',
    blurb:
      'Start from one idea in the middle and branch outward as fast as you can think. Recolour the whole map in a click.',
    sketch: 'mindmap',
  },
  {
    key: 'orgchart',
    title: 'Org charts',
    blurb: 'Show who reports to whom with boxes and connectors that stay tidy as the team grows.',
    sketch: 'orgchart',
  },
  {
    key: 'kanban',
    title: 'Kanban boards',
    blurb:
      'Track work across columns. Group the cards in a lane, lock the ones that are done, and reorder by dragging.',
    sketch: 'kanban',
  },
  {
    key: 'retro',
    title: 'Agile retrospectives',
    blurb:
      'Run a live retro with the team on one canvas: columns, sticky notes, comments, and a laser pointer to talk it through.',
    sketch: 'retro',
  },
  {
    key: 'wireframe',
    title: 'Wireframes & UI mockups',
    blurb:
      'Sketch screens with browser, laptop, phone, and tablet frames straight from the palette, then link them into a flow.',
    sketch: 'wireframe',
  },
  {
    key: 'moodboard',
    title: 'Mood boards',
    blurb:
      'Set up a board and let the whole team drop in images. Everyone gets a slot to fill, uploads land live, and the board comes together as people add to it.',
    sketch: 'moodboard',
  },
  {
    key: 'journey',
    title: 'User journey maps',
    blurb:
      'Trace a customer from first touch to outcome across stages, with the highs and lows mapped at each step.',
    sketch: 'journey',
  },
  {
    key: 'timeline',
    title: 'Timelines & roadmaps',
    blurb:
      'Place milestones along a track and tell the story of what ships when, quarter by quarter.',
    sketch: 'timeline',
  },
  {
    key: 'fishbone',
    title: 'Root-cause analysis',
    blurb:
      'Run a fishbone from the problem back to its causes, grouping contributing factors along each branch.',
    sketch: 'fishbone',
  },
  {
    key: 'swot',
    title: 'SWOT analysis',
    blurb:
      'Weigh strengths, weaknesses, opportunities, and threats across four quadrants, then theme the board to match your deck.',
    sketch: 'swot',
  },
  {
    key: 'matrix',
    title: 'Prioritization matrices',
    blurb:
      'Plot items across two axes, impact against effort, and let the quadrants make the call obvious.',
    sketch: 'matrix',
  },
  {
    key: 'gantt',
    title: 'Gantt charts & schedules',
    blurb:
      'Lay tasks along a track as bars, stagger them by phase, and see the plan from kickoff to ship at a glance.',
    sketch: 'gantt',
  },
  {
    key: 'venn',
    title: 'Venn diagrams',
    blurb:
      'Show what overlaps between two or three sets, with translucent circles that blend where they meet.',
    sketch: 'venn',
  },
  {
    key: 'erd',
    title: 'Database & ER diagrams',
    blurb:
      'Model tables and the relationships between them, with connectors that stay attached as you rearrange the schema.',
    sketch: 'erd',
  },
  {
    key: 'sequence',
    title: 'Sequence diagrams',
    blurb:
      'Trace a request across services with lifelines and messages, ordered top to bottom the way the call actually runs.',
    sketch: 'sequence',
  },
];

const FALLBACK = USE_CASES[0] as UseCase;

export function UseCaseCarousel() {
  const [active, setActive] = useState(0);
  const n = USE_CASES.length;
  // Bounded indexing; the `?? FALLBACK` keeps the type non-optional under
  // noUncheckedIndexedAccess without a non-null assertion.
  const pick = (i: number): UseCase => USE_CASES[((i % n) + n) % n] ?? FALLBACK;
  const featured = pick(active);
  const side = [pick(active + 1), pick(active + 2)];

  const go = (delta: number) => setActive((i) => (i + delta + n) % n);

  return (
    <section className="border-t border-slate-800 bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-400">
            One canvas, many jobs
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            What will you draw first?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            From a quick flowchart to a full system map, the same canvas stretches to whatever you
            need. Browse a few of the things teams build with it.
          </p>
        </div>

        <div className="mt-14 flex items-stretch gap-4">
          <CarouselArrow direction="prev" onClick={() => go(-1)} />

          <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
            {/* Featured card. Keyed on the active index so it replays its
                entrance whenever the selection changes. */}
            <article
              key={featured.key}
              className="uc-pop flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/70 p-6 shadow-xl"
            >
              <div className="flex-1 overflow-hidden rounded-xl bg-slate-950/40 p-4">
                <Sketch kind={featured.sketch} featured />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{featured.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{featured.blurb}</p>
            </article>

            {/* Two smaller cards. Clicking one promotes it to featured. */}
            <div className="grid grid-rows-2 gap-4">
              {side.map((uc) => (
                <button
                  key={uc.key}
                  type="button"
                  onClick={() => setActive(USE_CASES.indexOf(uc))}
                  className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/40 p-3 text-left transition hover:border-brand-400 hover:bg-slate-800/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                >
                  <span className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-950/40 p-1.5">
                    <Sketch kind={uc.sketch} />
                  </span>
                  <span className="block min-w-0 truncate text-sm font-semibold text-white">
                    {uc.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <CarouselArrow direction="next" onClick={() => go(1)} />
        </div>

        {/* Dot indicators double as a position read-out. */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {USE_CASES.map((uc, i) => (
            <button
              key={uc.key}
              type="button"
              aria-label={`Show ${uc.title}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={
                'h-1.5 rounded-full transition-all ' +
                (i === active ? 'w-6 bg-brand-400' : 'w-1.5 bg-slate-600 hover:bg-slate-500')
              }
            />
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <a
            href="/new"
            className="inline-flex items-center justify-center rounded-md bg-brand-500 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            Start drawing
          </a>
        </div>
      </div>
    </section>
  );
}

function CarouselArrow({
  direction,
  onClick,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
}) {
  const prev = direction === 'prev';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={prev ? 'Previous use case' : 'Next use case'}
      className="hidden shrink-0 items-center justify-center self-center rounded-full border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:border-brand-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 sm:flex"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {prev ? <path d="M15 6 L9 12 L15 18" /> : <path d="M9 6 L15 12 L9 18" />}
      </svg>
    </button>
  );
}
