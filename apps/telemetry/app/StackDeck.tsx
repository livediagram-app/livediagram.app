'use client';

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

// The deck frame of a stack's head card (spec/22): one or two faux-card
// layers stepping out behind it so it reads as a deck (the Timeline stack's
// look, spec/138 §2.1), plus the toggle behaviour. It doesn't know what the
// head shows; MetricStackCard fills it with the combined chart.
//
// Clicking it opens its members in a modal over the page (StackModal). While
// that is open it stays in its cell, its layers gone and ringed. The caller
// renders it unconditionally so opening never remounts it and replays its
// arrival.
//
// A div with role="button" rather than a <button>: bodies hold Tooltip
// triggers (a chart's hover columns), and interactive content inside a
// <button> is invalid.
export function StackDeck({
  title,
  noun,
  count,
  accent,
  aside,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  noun: string; // what the members are, plural: "charts", "rankings"
  count: number; // members, for the subtitle and the layers
  // The stack's category hue (stack-colours.ts), tinting its icon tile the
  // way a metric card's tile wears its category.
  accent: string;
  aside?: ReactNode; // top-right, e.g. the combined count
  expanded: boolean;
  // Hands back the head element, which gets focus back when the modal closes.
  onToggle: (anchor: HTMLElement) => void;
  children: ReactNode;
}) {
  // Two layers at three or more, one at two, as on the Timeline.
  const deep = count >= 3 && !expanded;
  const layer =
    'pointer-events-none absolute inset-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onToggle(e.currentTarget);
  };
  const onClick = (e: MouseEvent<HTMLElement>) => onToggle(e.currentTarget);

  return (
    // The layers step down and right into the grid gap; `mb-2 mr-2` keeps
    // the deepest one inside this cell rather than under the next. Kept while
    // open too, though the layers are gone: dropping it would widen the head
    // as it opens, and opening a stack must not move or resize anything.
    <div className="tl-fan-out-up relative mb-2 mr-2 flex h-full flex-col">
      {deep && <div aria-hidden className={`${layer} translate-x-2 translate-y-2 opacity-50`} />}
      {!expanded && (
        <div aria-hidden className={`${layer} translate-x-1 translate-y-1 opacity-75`} />
      )}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={`relative flex flex-1 cursor-pointer flex-col rounded-2xl border bg-white p-5 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:bg-slate-900 dark:hover:border-slate-600 ${
          expanded
            ? 'border-sky-300 ring-4 ring-sky-100 dark:border-sky-700 dark:ring-sky-950'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accent}1a`, color: accent }}
            >
              <StackGlyph />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
              <p className="text-xs text-slate-400">
                {count} {count === 1 ? noun.replace(/s$/, '') : noun} · click to open
              </p>
            </div>
          </div>
          {aside}
        </div>
        {children}
      </div>
    </div>
  );
}

// Three offset cards: the stack itself, rather than any one member's event.
function StackGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="13" height="10" rx="2" />
      <path d="M7 17h11a2 2 0 0 0 2-2V8" />
      <path d="M11 21h8" opacity="0.6" />
    </svg>
  );
}
