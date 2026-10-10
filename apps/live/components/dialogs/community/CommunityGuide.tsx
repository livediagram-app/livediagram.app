'use client';

import type { ReactNode } from 'react';

// The Share dialog's Community tab opens with what Community is and what publishing means
// (docs/specs/025-community/community.md "Publishing"; docs/specs/007-editor/live-app.md "Share dialog"), drawn as
// three steps and a few plain facts, so an owner knows what happens before the Share to Community button below it.
// The illustrations are inline SVG in the theme's colours: no asset to load, and they follow dark mode.

const STEP_CAPTION = 'text-[11px] leading-snug text-slate-500 dark:text-slate-400';

// A small board: a card with a few stickies on it, the shape every illustration builds on.
function Board({ x, y, accent }: { x: number; y: number; accent: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width="44"
        height="32"
        rx="4"
        className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
        strokeWidth="1.2"
      />
      <rect
        x="6"
        y="6"
        width="10"
        height="9"
        rx="1.5"
        className="fill-amber-200 dark:fill-amber-300/70"
      />
      <rect x="19" y="6" width="10" height="9" rx="1.5" className={accent} />
      <rect
        x="6"
        y="18"
        width="10"
        height="9"
        rx="1.5"
        className="fill-sky-200 dark:fill-sky-300/60"
      />
      <rect
        x="19"
        y="18"
        width="19"
        height="2.5"
        rx="1.25"
        className="fill-slate-200 dark:fill-slate-600"
      />
      <rect
        x="19"
        y="23"
        width="13"
        height="2.5"
        rx="1.25"
        className="fill-slate-200 dark:fill-slate-600"
      />
    </g>
  );
}

function PublishArt() {
  return (
    <svg viewBox="0 0 96 64" className="h-16 w-24" aria-hidden>
      <Board x={8} y={18} accent="fill-emerald-200 dark:fill-emerald-300/60" />
      {/* The globe it goes out to. */}
      <g
        transform="translate(66 22)"
        className="stroke-brand-500 dark:stroke-brand-400"
        fill="none"
        strokeWidth="1.5"
      >
        <circle r="13" cx="13" cy="13" className="fill-brand-50 dark:fill-brand-500/15" />
        <ellipse cx="13" cy="13" rx="5.5" ry="13" />
        <path d="M0 13h26M2.5 6.5h21M2.5 19.5h21" />
      </g>
      <path
        d="M54 34h8m-3-3 3 3-3 3"
        className="stroke-slate-400 dark:stroke-slate-500"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DiscoverArt() {
  return (
    <svg viewBox="0 0 96 64" className="h-16 w-24" aria-hidden>
      {/* The gallery: three boards in a row, the middle one liked. */}
      <g opacity="0.55">
        <Board x={2} y={18} accent="fill-violet-200 dark:fill-violet-300/60" />
      </g>
      <g opacity="0.55">
        <Board x={50} y={18} accent="fill-rose-200 dark:fill-rose-300/60" />
      </g>
      <g transform="translate(-2 -6)">
        <Board x={28} y={16} accent="fill-emerald-200 dark:fill-emerald-300/60" />
      </g>
      <path
        d="M48 50.5c-4.5-3-7-5.3-7-8a3.6 3.6 0 0 1 7-1.2 3.6 3.6 0 0 1 7 1.2c0 2.7-2.5 5-7 8Z"
        className="fill-rose-500 dark:fill-rose-400"
      />
    </svg>
  );
}

function CopyArt() {
  return (
    <svg viewBox="0 0 96 64" className="h-16 w-24" aria-hidden>
      <Board x={6} y={16} accent="fill-emerald-200 dark:fill-emerald-300/60" />
      <g transform="translate(46 16)">
        <rect
          width="44"
          height="32"
          rx="4"
          className="fill-white stroke-brand-400 dark:fill-slate-800 dark:stroke-brand-400"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
        <rect
          x="6"
          y="6"
          width="10"
          height="9"
          rx="1.5"
          className="fill-amber-200 dark:fill-amber-300/70"
        />
        <rect
          x="19"
          y="6"
          width="10"
          height="9"
          rx="1.5"
          className="fill-emerald-200 dark:fill-emerald-300/60"
        />
        <path
          d="M30 20v8m-4-4h8"
          className="stroke-brand-500 dark:stroke-brand-400"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

const STEPS: { art: ReactNode; title: string; caption: string }[] = [
  {
    art: <PublishArt />,
    title: 'Publish',
    caption: 'Give it a title, a short description, a category and a few tags.',
  },
  {
    art: <DiscoverArt />,
    title: 'People discover it',
    caption: 'Anyone can find it in the gallery, open it to look around and like it.',
  },
  {
    art: <CopyArt />,
    title: 'They make it theirs',
    caption: 'One click copies it as a starting point of their own. Yours is untouched.',
  },
];

const FACTS: { title: string; body: string }[] = [
  {
    title: 'Always up to date',
    body: 'Community shows your latest saved version, every tab, so edits you make later appear there too.',
  },
  {
    title: 'Anonymous by default',
    body: 'Your name and picture only show if you turn Share Anonymously off.',
  },
  {
    title: 'Private stays private',
    body: 'Comments, passes and the people you shared with are never shown.',
  },
  {
    title: 'Yours to take back',
    body: 'Edit the listing or remove it at any time. Copies people already made are theirs to keep.',
  },
];

export function CommunityGuide() {
  return (
    <section aria-labelledby="community-guide-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3
          id="community-guide-heading"
          className="text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          Show your board to the world
        </h3>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Community is livediagram&rsquo;s public gallery of boards people are proud of. Publishing
          this document lets anyone, with or without an account, find it, learn from it and reuse
          it.
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5 sm:flex-col sm:items-start sm:gap-1.5 dark:bg-slate-800/50"
          >
            <span className="shrink-0">{step.art}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                <span className="mr-1 text-brand-600 dark:text-brand-300">{i + 1}.</span>
                {step.title}
              </span>
              <span className={STEP_CAPTION}>{step.caption}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">
          Good to know
        </p>
        <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {FACTS.map((fact) => (
            <li key={fact.title} className="flex gap-2">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400"
              />
              <span className="flex flex-col">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {fact.title}
                </span>
                <span className={STEP_CAPTION}>{fact.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
