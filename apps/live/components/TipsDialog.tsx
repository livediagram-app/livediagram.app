'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEscape } from '@/hooks/useEscape';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { CloseIcon } from './CloseIcon';

// Tips carousel (spec/43). A user-invoked modal that highlights powerful but
// easy-to-miss features one card at a time. Opened from the footer lightbulb.
// Navigation: Prev / Next buttons, clickable dots, Left / Right arrow keys,
// and horizontal swipe (so it works on touch). Adding a tip is one entry in
// the TIPS array below.

type Tip = {
  // Large line-art illustration shown in the card's tinted disc.
  art: ReactNode;
  title: string;
  body: string;
  // Optional "how to reach it" hint, rendered as a subtle pill.
  how?: string;
};

const TIPS: Tip[] = [
  {
    art: <KeyboardArt />,
    title: 'Keyboard shortcuts',
    body: 'There is a shortcut for almost everything: tools, adding shapes, undo, zoom, grouping and more. Hold Cmd / Ctrl to see shortcut hints on the toolbar.',
    how: 'Footer ⌨ button',
  },
  {
    art: <SearchArt />,
    title: 'Search everything',
    body: 'Jump straight to any diagram, tab, or element across your whole workspace. The search panel matches names and element text as you type.',
    how: 'Footer 🔍 button',
  },
  {
    art: <PointerArt />,
    title: 'Right-click for more',
    body: 'Every element and the canvas itself has a context menu with the full set of actions: colours, borders, layering, alignment, theme and more.',
    how: 'Right-click • or press-and-hold on touch',
  },
  {
    art: <FrameArt />,
    title: 'Group with Frames',
    body: 'Drop a Frame around related shapes to make a labelled section (a zone or swimlane). Move the frame and everything inside travels with it.',
    how: 'Palette → Frame',
  },
  {
    art: <TeamArt />,
    title: 'Work as a team',
    body: 'Create a team to share a workspace with teammates. Invite by email, with Admin and Member roles, and everyone collaborates live on the same canvas.',
    how: 'Explorer → Teams',
  },
  {
    art: <SessionArt />,
    title: 'Run live sessions',
    body: 'Facilitate a workshop right on the tab: start a countdown timer, or open a dot-vote so everyone can prioritise together.',
    how: 'Right-click canvas → Session',
  },
  {
    art: <PencilArt />,
    title: 'Sketch freehand',
    body: 'Grab the Pencil to draw freehand strokes, annotate, or let shape-recognition snap your sketch into a clean shape.',
    how: 'Press F • or the Pencil tool',
  },
  {
    art: <ConnectArt />,
    title: 'Build out from a shape',
    body: 'Select a shape and a + button appears on each side. Click one to fan out quick actions: duplicate the shape, draw an arrow, sketch, or add a caption, each attached to that side.',
    how: 'Select a shape → click a + button',
  },
];

export function TipsDialog({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  // Which way the last navigation went (1 = forward, -1 = back), so the
  // entering card slides in from the matching side.
  const [dir, setDir] = useState(1);
  const last = TIPS.length - 1;
  const tip = TIPS[index]!;

  const step = (delta: 1 | -1) => {
    setDir(delta);
    setIndex((i) => Math.max(0, Math.min(last, i + delta)));
  };
  const goTo = (target: number) => {
    setDir(target >= index ? 1 : -1);
    setIndex(Math.max(0, Math.min(last, target)));
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useEscape(onClose);

  // Left / Right arrow keys step between cards.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // step is stable enough (only reads setState); re-binding per render is fine
    // but unnecessary, so bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  // Horizontal swipe (touch / pointer drag past a slop threshold).
  const swipeStart = useRef<number | null>(null);
  const onSwipeDown = (e: React.PointerEvent) => {
    swipeStart.current = e.clientX;
  };
  const onSwipeUp = (e: React.PointerEvent) => {
    if (swipeStart.current === null) return;
    const dx = e.clientX - swipeStart.current;
    swipeStart.current = null;
    if (dx <= -40) step(1);
    else if (dx >= 40) step(-1);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-slate-950/60"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tips"
        tabIndex={-1}
        className="pointer-events-auto flex w-[26rem] max-w-[92%] animate-fly-up-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-500 dark:text-brand-300">
            <BulbGlyph />
            Tips
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>

        {/* The card. Keyed on index so each tip fades in as it becomes active.
            Swipe handlers live here so a drag anywhere on the card navigates. */}
        <div
          className="flex touch-pan-y flex-col items-center px-7 pb-2 pt-3 text-center"
          onPointerDown={onSwipeDown}
          onPointerUp={onSwipeUp}
        >
          <div
            key={index}
            className={`flex flex-col items-center ${dir > 0 ? 'animate-tip-next' : 'animate-tip-prev'}`}
            aria-live="polite"
          >
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 ring-1 ring-brand-200/70 dark:from-brand-500/15 dark:to-brand-500/5 dark:text-brand-300 dark:ring-brand-500/25">
              {tip.art}
            </div>
            <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {tip.title}
            </h2>
            <p className="mt-2 min-h-[4.5rem] text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {tip.body}
            </p>
            {tip.how ? (
              <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {tip.how}
              </span>
            ) : null}
          </div>
        </div>

        {/* Dots: jump to any tip. */}
        <div className="flex items-center justify-center gap-1.5 py-3">
          {TIPS.map((t, i) => (
            <button
              key={t.title}
              type="button"
              aria-label={`Go to tip ${i + 1}: ${t.title}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? 'w-5 bg-brand-500 dark:bg-brand-400'
                  : 'w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={index === 0}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-0 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronGlyph dir="left" />
            Back
          </button>
          <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
            {index + 1} / {TIPS.length}
          </span>
          {index === last ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Got it
            </button>
          ) : (
            <button
              type="button"
              onClick={() => step(1)}
              className="flex items-center gap-1 rounded-md bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Next
              <ChevronGlyph dir="right" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Glyphs + tip illustrations -------------------------------------------
// 40px line art (currentColor) sized for the card disc; chrome glyphs are
// small. Kept inline so the carousel is self-contained.

function svgProps(size = 40) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 40 40',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

function BulbGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 11.5a4 4 0 1 1 4 0V13H6z" />
      <path d="M6.5 14.5h3" />
    </svg>
  );
}

function ChevronGlyph({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: dir === 'left' ? 'rotate(180deg)' : 'none' }}
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

function KeyboardArt() {
  return (
    <svg {...svgProps()}>
      <rect x="5" y="12" width="30" height="18" rx="3" />
      <path d="M10 18h.01M15 18h.01M20 18h.01M25 18h.01M30 18h.01M12 24h16" />
    </svg>
  );
}

function SearchArt() {
  return (
    <svg {...svgProps()}>
      <circle cx="17" cy="17" r="9" />
      <path d="M24 24l8 8" />
    </svg>
  );
}

function PointerArt() {
  return (
    <svg {...svgProps()}>
      <path d="M12 10l16 7-7 2.5-2.5 7z" />
      <path d="M22 22l8 8" />
    </svg>
  );
}

function FrameArt() {
  return (
    <svg {...svgProps()}>
      <path d="M8 14V9h5M27 9h5v5M32 26v5h-5M13 31H8v-5" />
      <rect x="16" y="16" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function TeamArt() {
  return (
    <svg {...svgProps()}>
      <circle cx="15" cy="15" r="4.5" />
      <path d="M7 31a8 8 0 0 1 16 0" />
      <path d="M26 12.5a4 4 0 0 1 0 8M27 23a8 8 0 0 1 6 8" />
    </svg>
  );
}

function SessionArt() {
  return (
    <svg {...svgProps()}>
      <circle cx="20" cy="22" r="11" />
      <path d="M20 16v6l4 3M16 8h8" />
    </svg>
  );
}

function PencilArt() {
  return (
    <svg {...svgProps()}>
      <path d="M27 8l5 5-16 16-6 1 1-6z" />
      <path d="M24 11l5 5" />
    </svg>
  );
}

function ConnectArt() {
  return (
    <svg {...svgProps()}>
      <rect x="6" y="14" width="11" height="11" rx="2" />
      <rect x="25" y="20" width="9" height="9" rx="2" />
      <path d="M17 18h6.5M21 15l3 3-3 3" />
    </svg>
  );
}
