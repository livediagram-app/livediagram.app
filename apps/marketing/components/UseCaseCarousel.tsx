'use client';

import { useState, type ReactNode } from 'react';

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

/* ───────────────────────────── Sketches ──────────────────────────────
 * Small abstract motifs per use case, built from the same brand-blue
 * shape/arrow vocabulary as the rest of the site. Drawn into a 200x120
 * viewBox and scaled by the container, so the same sketch reads at both
 * featured and thumbnail sizes. */

type SketchKind =
  | 'flowchart'
  | 'architecture'
  | 'mindmap'
  | 'orgchart'
  | 'kanban'
  | 'retro'
  | 'wireframe'
  | 'journey'
  | 'timeline'
  | 'fishbone'
  | 'moodboard';

const FILL = '#1e3a5f';
const STROKE = '#38bdf8';
const SOFT = '#0ea5e9';

function Sketch({ kind, featured = false }: { kind: SketchKind; featured?: boolean }) {
  return (
    <svg
      viewBox="0 0 200 120"
      className={featured ? 'h-full max-h-44 w-full' : 'h-full w-full'}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <g fill={FILL} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        {SKETCHES[kind]}
      </g>
    </svg>
  );
}

const SKETCHES: Record<SketchKind, ReactNode> = {
  flowchart: (
    <>
      <rect x="78" y="8" width="44" height="20" rx="10" />
      <rect x="78" y="50" width="44" height="20" rx="3" />
      <polygon points="100,82 124,100 100,118 76,100" />
      <path d="M100 28 L100 50 M94 44 L100 50 L106 44" fill="none" />
      <path d="M100 70 L100 82 M94 76 L100 82 L106 76" fill="none" />
    </>
  ),
  architecture: (
    <>
      <rect x="12" y="46" width="40" height="24" rx="3" />
      <rect x="80" y="14" width="40" height="24" rx="3" />
      <rect x="80" y="78" width="40" height="24" rx="3" />
      <rect x="148" y="46" width="40" height="24" rx="3" />
      <path d="M52 58 L80 30 M52 58 L80 86 M120 26 L148 54 M120 90 L148 62" fill="none" />
    </>
  ),
  mindmap: (
    <>
      <circle cx="100" cy="60" r="16" />
      <circle cx="36" cy="24" r="10" />
      <circle cx="36" cy="96" r="10" />
      <circle cx="164" cy="28" r="10" />
      <circle cx="166" cy="92" r="10" />
      <path d="M86 52 L46 30 M86 68 L46 90 M114 52 L154 32 M114 68 L156 86" fill="none" />
    </>
  ),
  orgchart: (
    <>
      <rect x="78" y="8" width="44" height="20" rx="3" />
      <rect x="28" y="64" width="44" height="20" rx="3" />
      <rect x="128" y="64" width="44" height="20" rx="3" />
      <path d="M100 28 L100 46 M50 46 L150 46 M50 46 L50 64 M150 46 L150 64" fill="none" />
    </>
  ),
  kanban: (
    <>
      <rect x="10" y="10" width="52" height="100" rx="4" fill={FILL} stroke={STROKE} />
      <rect x="74" y="10" width="52" height="100" rx="4" fill={FILL} stroke={STROKE} />
      <rect x="138" y="10" width="52" height="100" rx="4" fill={FILL} stroke={STROKE} />
      <g fill={SOFT} stroke="none">
        <rect x="16" y="20" width="40" height="14" rx="2" />
        <rect x="16" y="40" width="40" height="14" rx="2" />
        <rect x="80" y="20" width="40" height="14" rx="2" />
        <rect x="144" y="20" width="40" height="14" rx="2" />
        <rect x="144" y="40" width="40" height="14" rx="2" />
        <rect x="144" y="60" width="40" height="14" rx="2" />
      </g>
    </>
  ),
  retro: (
    <>
      <line x1="100" y1="8" x2="100" y2="112" stroke={STROKE} />
      <g fill={SOFT} stroke="none">
        <rect x="14" y="16" width="32" height="26" rx="3" />
        <rect x="54" y="22" width="32" height="26" rx="3" />
        <rect x="116" y="16" width="32" height="26" rx="3" />
        <rect x="156" y="28" width="30" height="26" rx="3" />
        <rect x="20" y="64" width="32" height="26" rx="3" />
        <rect x="120" y="70" width="32" height="26" rx="3" />
      </g>
    </>
  ),
  wireframe: (
    <>
      <rect x="14" y="14" width="96" height="92" rx="4" />
      <line x1="14" y1="30" x2="110" y2="30" stroke={STROKE} />
      <g fill={SOFT} stroke="none">
        <rect x="22" y="40" width="34" height="24" rx="2" />
        <rect x="62" y="40" width="40" height="24" rx="2" />
        <rect x="22" y="72" width="80" height="22" rx="2" />
      </g>
      <rect x="130" y="20" width="44" height="80" rx="7" />
      <g fill={SOFT} stroke="none">
        <rect x="138" y="30" width="28" height="6" rx="2" />
        <rect x="138" y="42" width="28" height="16" rx="2" />
        <rect x="138" y="64" width="28" height="16" rx="2" />
      </g>
    </>
  ),
  journey: (
    <>
      <path
        d="M14 88 L60 52 L106 70 L152 30 L188 48"
        fill="none"
        stroke={STROKE}
        strokeWidth="2.5"
      />
      <g fill={FILL} stroke={STROKE}>
        <circle cx="14" cy="88" r="7" />
        <circle cx="60" cy="52" r="7" />
        <circle cx="106" cy="70" r="7" />
        <circle cx="152" cy="30" r="7" />
        <circle cx="188" cy="48" r="7" />
      </g>
      <line x1="8" y1="104" x2="194" y2="104" stroke={SOFT} strokeWidth="1.5" />
    </>
  ),
  timeline: (
    <>
      <line x1="12" y1="60" x2="188" y2="60" stroke={STROKE} strokeWidth="2.5" />
      <g fill={FILL} stroke={STROKE}>
        <circle cx="34" cy="60" r="7" />
        <circle cx="84" cy="60" r="7" />
        <circle cx="134" cy="60" r="7" />
        <circle cx="180" cy="60" r="7" />
      </g>
      <g fill={SOFT} stroke="none">
        <rect x="20" y="24" width="28" height="14" rx="2" />
        <rect x="70" y="82" width="28" height="14" rx="2" />
        <rect x="120" y="24" width="28" height="14" rx="2" />
        <rect x="166" y="82" width="28" height="14" rx="2" />
      </g>
    </>
  ),
  fishbone: (
    <>
      <line x1="10" y1="60" x2="170" y2="60" stroke={STROKE} strokeWidth="2.5" />
      <polygon points="170,52 190,60 170,68" fill={FILL} stroke={STROKE} />
      <path
        d="M50 60 L36 26 M50 60 L36 94 M110 60 L96 26 M110 60 L96 94"
        fill="none"
        stroke={SOFT}
      />
      <g fill={FILL} stroke={STROKE}>
        <circle cx="34" cy="24" r="5" />
        <circle cx="34" cy="96" r="5" />
        <circle cx="94" cy="24" r="5" />
        <circle cx="94" cy="96" r="5" />
      </g>
    </>
  ),
  moodboard: <MoodBoardSketch />,
};

// Mood board: a grid of image tiles collaborators fill in, some already
// uploaded (pastel photos), some still empty drop-zones (dashed + an
// image-placeholder glyph). Echoes the real mood-board template.
function MoodBoardSketch() {
  const tiles = [
    { x: 12, y: 12, sky: '#e0f2fe', hill: '#7dd3fc' },
    { x: 73, y: 12, sky: '#fce7f3', hill: '#f9a8d4' },
    { x: 134, y: 12, empty: true },
    { x: 12, y: 64, empty: true },
    { x: 73, y: 64, sky: '#ede9fe', hill: '#c4b5fd' },
    { x: 134, y: 64, sky: '#dcfce7', hill: '#86efac' },
  ];
  return (
    <>
      <rect x="3" y="3" width="194" height="114" rx="6" fill="none" stroke={SOFT} opacity="0.35" />
      {tiles.map((t, i) =>
        t.empty ? (
          <g key={i}>
            <rect
              x={t.x}
              y={t.y}
              width="54"
              height="44"
              rx="3"
              fill={FILL}
              stroke={SOFT}
              strokeWidth="1.3"
              strokeDasharray="4 3"
            />
            <g stroke={SOFT} strokeWidth="1.3" fill="none">
              <rect x={t.x + 19} y={t.y + 14} width="16" height="13" rx="2" />
              <circle cx={t.x + 23} cy={t.y + 19} r="1.5" />
              <path
                d={`M${t.x + 19} ${t.y + 27} L${t.x + 25} ${t.y + 21} L${t.x + 29} ${t.y + 24} L${t.x + 35} ${t.y + 18}`}
              />
            </g>
          </g>
        ) : (
          <g key={i}>
            <rect
              x={t.x}
              y={t.y}
              width="54"
              height="44"
              rx="3"
              fill={t.sky}
              stroke={STROKE}
              strokeWidth="1.3"
            />
            <circle cx={t.x + 13} cy={t.y + 14} r="4.5" fill="#fcd34d" stroke="none" />
            <path
              d={`M${t.x + 1} ${t.y + 44} L${t.x + 16} ${t.y + 27} L${t.x + 28} ${t.y + 38} L${t.x + 40} ${t.y + 28} L${t.x + 53} ${t.y + 44} Z`}
              fill={t.hill}
              stroke="none"
            />
          </g>
        ),
      )}
    </>
  );
}
