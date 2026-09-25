'use client';

// The answer-shape picker: a grid of drawn tiles, one per poll style.
//
// Rendered wherever a poll is composed — the Session Studio pane, a poll
// element's `…` popover, and that element's right-click Session category —
// because those are one composer now (spec/39). It has been three things on
// the way here, and each was wrong for a reason worth keeping:
//
//   - a column of bordered cards with a title and a grey subtitle each, which
//     is six near-identical boxes you have to READ to tell apart, stacked
//     inside a popover that is already a column of boxes;
//   - these tiles at THREE across, which fitted the Studio pane and not a
//     240px popover: `Collaborators` filled its box edge to edge and
//     `Rating 1-5` broke at its hyphen, so text sat outside the tile;
//   - plain menu rows, which fitted everywhere and said nothing — choosing
//     between six different SHAPES of answer is a visual question.
//
// So: tiles, TWO across, at one width everywhere. Two columns give each label
// ~98px, which is a single line for the longest of them in the narrowest place
// this renders. There is no `columns` prop, deliberately — the whole point of
// the surfaces sharing a composer is that they are the same UI, and a knob for
// how it looks in each is how they drifted apart before.
//
// The art is CSS boxes rather than icons: each tile is a
// small picture of the answers themselves, so it stays truthful when a style's
// answers change, and a new style has to draw what it actually offers rather
// than pick a glyph that gestures at it.

import type { ReactNode } from 'react';
import { POLL_STYLES, POLL_STYLE_LABEL, type PollStyle } from '@livediagram/diagram';

function PillRow({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-2 w-3 rounded-full bg-current opacity-50" />
      ))}
    </span>
  );
}

// Keyed on the style union, so a new style cannot ship without a drawing.
const STYLE_ART: Record<PollStyle, ReactNode> = {
  yesNo: <PillRow count={2} />,
  yesNoAbstain: <PillRow count={3} />,
  choice: (
    <span className="flex w-full flex-col gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex items-center gap-0.5">
          <span className="h-1 w-1 rounded-full bg-current opacity-70" />
          <span className="h-1 flex-1 rounded-full bg-current opacity-30" />
        </span>
      ))}
    </span>
  ),
  // Three heads in a row: people, not answers — and deliberately unlike the
  // rating's evenly-spaced dots, which are the same shape at the same size.
  collaborators: (
    <span className="flex items-end justify-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex flex-col items-center gap-[1px]">
          <span className="h-1 w-1 rounded-full bg-current opacity-70" />
          <span className="h-[3px] w-2 rounded-t-full bg-current opacity-40" />
        </span>
      ))}
    </span>
  ),
  rating: (
    <span className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      ))}
    </span>
  ),
  text: (
    <span className="flex w-full flex-col items-center gap-[3px]">
      <span className="h-1 w-7 rounded-full bg-current opacity-40" />
      <span className="h-1 w-5 rounded-full bg-current opacity-30" />
    </span>
  ),
};

function PollStyleTile({
  style,
  selected,
  onPick,
}: {
  style: PollStyle;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      // `h-full` + the grid's equal rows below, `justify-center`, and room for
      // TWO lines of label. Labels are not all short — "Collaborators" nearly
      // fills the tile and "Rating 1-5" wraps at its hyphen — and with
      // `leading-none` and content-sized rows a wrapped one collided with
      // itself and pushed past the border, leaving text sitting outside its
      // box. Sized for the worst label rather than the ones that happen to fit.
      // `overflow-hidden` + a truncating label: the tile is the box, and text
      // must never leave it. At the widths both callers use nothing truncates
      // today — this is the guarantee, not the everyday behaviour.
      className={`flex h-full min-h-[3.5rem] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-1.5 py-2 text-center transition ${
        selected
          ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/60 dark:bg-brand-500/15 dark:text-brand-200'
          : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      <span className="flex h-4 w-8 items-center justify-center">{STYLE_ART[style]}</span>
      <span className="w-full truncate text-[10px] font-semibold leading-tight">
        {POLL_STYLE_LABEL[style]}
      </span>
    </button>
  );
}

/** Every style as a three-across grid. The shared picker both composers use. */
export function PollStyleTiles({
  style,
  onChange,
}: {
  style: PollStyle;
  onChange: (next: PollStyle) => void;
}) {
  return (
    // Equal rows: a tile whose label wraps cannot make its row taller than the
    // one above and leave the grid ragged.
    <div
      className="grid grid-cols-2 gap-1 [grid-auto-rows:1fr]"
      role="radiogroup"
      aria-label="Answer style"
    >
      {POLL_STYLES.map((option) => (
        <PollStyleTile
          key={option}
          style={option}
          selected={style === option}
          onPick={() => onChange(option)}
        />
      ))}
    </div>
  );
}
