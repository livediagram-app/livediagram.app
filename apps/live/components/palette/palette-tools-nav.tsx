// The Tools tab's two-level navigation (spec/09 "Sub-categories"): a grid of
// big square CATEGORY tiles you click to open, and a breadcrumb to get back.
//
// This replaces a stack of accordion headers. Seven collapsed headers meant the
// tools themselves were never visible until you opened one, every open group
// pushed the rest off the bottom, and the thing you were looking at was a list
// of words rather than the pictures the palette otherwise trades in. Drilling
// in shows one screen at a time: pick a category, see its tools, breadcrumb
// back.
//
// Category artwork is the FIRST tile in the group, so a category always looks
// like what it contains and no separate icon set can drift from the tiles.

import type { ReactNode } from 'react';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';
import { Tooltip } from '@/components/primitives/Tooltip';

export type ToolsCategory = {
  id: string;
  label: string;
  // Representative glyph: the group's first tile.
  icon: ReactNode;
  // What's inside, in one line — the tooltip's job is to answer "is the thing
  // I want in here?", which a tool count never does.
  //
  // Optional, because that question only needs answering when the label
  // doesn't. "Blocks" is worth a sentence; the Icons tab's "People" and the
  // Technology tab's "AWS" are not, and a tooltip restating the label is
  // noise you have to wait for.
  description?: string;
};

export function ToolsCategoryGrid({
  categories,
  onOpen,
}: {
  categories: ToolsCategory[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {categories.map((category) => {
        const tile = (
          <button
            type="button"
            onClick={() => onOpen(category.id)}
            // Short and wide rather than square: a category tile only has to be
            // a comfortable target, and seven squares pushed the tools below
            // the fold — the thing the drill-in was meant to fix. The count
            // lives in the tooltip instead of costing a third line.
            className="flex h-[58px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:-translate-y-px hover:border-brand-300 hover:text-brand-700 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-200"
          >
            {/* The tile's own glyph, scaled up for a category-sized target. */}
            <span className="flex items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {category.icon}
            </span>
            <span className="px-1 text-center text-[11px] font-medium leading-tight">
              {category.label}
            </span>
          </button>
        );
        // No description, no tooltip: a tooltip that only repeats the label
        // already under the glyph is a delay in exchange for nothing.
        return category.description ? (
          <Tooltip key={category.id} title={category.label} description={category.description}>
            {tile}
          </Tooltip>
        ) : (
          <div key={category.id}>{tile}</div>
        );
      })}
    </div>
  );
}

// "Tools › Write", where Tools goes back. Also the label for where you are, so
// a drilled-in palette never leaves you guessing which set you're looking at.
// `root` is the tab's own name, since Icons and Technology drill in the same
// way ("Icons › People").
export function ToolsBreadcrumb({
  root = 'Tools',
  label,
  onBack,
}: {
  root?: string;
  label: string;
  onBack: () => void;
}) {
  return (
    // A bar, not a line of small print: the "back" half is the most-used
    // control on this screen, so it gets a surface, a full-height target, and
    // a hover state you can see coming.
    <div className="mb-2 flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-800/70">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 font-medium text-slate-600 transition hover:bg-white hover:text-brand-700 hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-brand-200"
      >
        {/* The shared disclosure chevron, turned to point back. */}
        <span className="rotate-90">
          <ChevronIcon open={false} />
        </span>
        {root}
      </button>
      <span aria-hidden className="text-slate-400 dark:text-slate-500">
        ›
      </span>
      <span className="px-1 font-semibold text-slate-800 dark:text-slate-100">{label}</span>
    </div>
  );
}
