'use client';

// A Plan tab with no board (docs/specs/025-plan/plan-mode.md "Starting a board"): the middle of the canvas
// offers the board types, as a new infographic page offers its layouts. Choosing one places that board,
// empty, in the middle of the view. Gone once the tab has a board; never shown to someone who may only
// view.
import { PLAN_BOARD_PRESETS } from '@livediagram/items';
import { PLAN_BOARD_TILES } from '@/components/palette/palette-plan-tiles';
import { PlanBoardTileArt } from './plan-tile-art';

export function PlanBoardPicker({ onPick }: { onPick: (preset: string) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[var(--z-panel)] flex items-center justify-center p-4">
      <section
        aria-labelledby="plan-board-picker-title"
        className="pointer-events-auto w-full max-w-xl animate-fade-in rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
      >
        <h2
          id="plan-board-picker-title"
          className="text-[15px] font-semibold text-slate-900 dark:text-slate-50"
        >
          Start with a Board
        </h2>
        <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
          Pick the board that fits the work. You can add more from the palette&rsquo;s Boards.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PLAN_BOARD_TILES.map((t) => (
            <button
              key={t.preset}
              type="button"
              onClick={() => onPick(t.preset)}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-slate-700 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10"
            >
              <span className="text-slate-700 dark:text-slate-200">
                <PlanBoardTileArt size={26} preset={t.preset} />
              </span>
              <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {PLAN_BOARD_PRESETS[t.preset].label.replace(/ Board$/, '')}
              </span>
              <span className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {t.description}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
