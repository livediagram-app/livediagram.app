'use client';

// How a poll's answers are shaped, as a grid of DRAWN tiles (spec/88).
//
// There are two places you compose a poll — the Session Studio and a Session
// button's own `…` menu — and they used to disagree about what this question
// looks like. The Studio drew each shape: two pills for Yes / No, five dots for
// a rating, ruled lines for free text. The `…` menu listed the same six styles
// as a column of bordered rectangles, each with a title and a grey subtitle,
// which is six near-identical boxes you have to READ to tell apart, stacked
// inside a menu that is already a column of bordered rectangles.
//
// So the drawing moved here and both surfaces use it. A rating is recognisable
// by its five dots without reading a word, the picker takes about a third of
// the height it did, and the two composers can no longer drift into describing
// one product two ways — the exact drift POLL_STYLE_LABEL's own comment warns
// about.
//
// The art is CSS boxes rather than icons on purpose: each tile is a small
// picture of the answers themselves, so it stays truthful when a style's
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

// A thumbnail of the answer shape. Keyed on the style union, so a new style
// cannot ship without one.
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

export function PollStyleTile({
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
      className={`flex h-full min-h-[3.75rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border px-1 py-2 text-center transition ${
        selected
          ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/60 dark:bg-brand-500/15 dark:text-brand-200'
          : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      <span className="flex h-4 w-8 items-center justify-center">{STYLE_ART[style]}</span>
      <span className="text-[10px] font-semibold leading-tight">{POLL_STYLE_LABEL[style]}</span>
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
      className="grid grid-cols-3 gap-1 [grid-auto-rows:1fr]"
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

/** The picker with the `…` menu's own label above it. */
export function PollAnswerStyleRow({
  style,
  onChange,
}: {
  style: PollStyle;
  onChange: (next: PollStyle) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-3 pt-2">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Answers</span>
      <PollStyleTiles style={style} onChange={onChange} />
    </div>
  );
}
