'use client';

// The per-tab canvas-style controls: the static pattern grid (with the
// "Show more patterns" toggle), a separate Animated pattern grid, the
// Canvas + Pattern colour swatches, and the opacity + size sliders. Lifted
// out of TabSection so the same block renders in both the palette's Canvas
// accordion AND the Canvas tab of the right-click CanvasThemeDialog
// (spec/42) — the two can't drift.
//
// Purely presentational: every change is a callback prop applied live to
// the active tab. The "Show more" expansion is local UI state owned here.

import { isAnimatedPattern, type BackgroundPattern } from '@livediagram/diagram';
import { useShowMoreList } from '@/hooks/ui/useShowMoreList';
import {
  ColorSwatch,
  PATTERNS,
  PatternButton,
  type PatternEntry,
} from '@/components/palette/palette-controls';
import { ShowMoreButton } from '@/components/primitives/ShowMoreButton';
import { Tooltip } from '@/components/primitives/Tooltip';

// Static vs animated split (spec/09): the two render as separate, labelled
// sections so the catalogue reads clearly. Computed once from the single
// PATTERNS source so adding a pattern still needs no edits here.
const STATIC_PATTERNS = PATTERNS.filter((p) => !isAnimatedPattern(p.id));
const ANIMATED_PATTERNS = PATTERNS.filter((p) => isAnimatedPattern(p.id));

function PatternGrid({
  patterns,
  gridClass,
  active,
  onPick,
}: {
  patterns: PatternEntry[];
  gridClass: string;
  active: BackgroundPattern;
  onPick: (pattern: BackgroundPattern) => void;
}) {
  return (
    <div className={gridClass}>
      {patterns.map((p) => (
        <Tooltip key={p.id} title={p.label} description={p.description}>
          <PatternButton active={active === p.id} onClick={() => onPick(p.id)} label={p.shortLabel}>
            <p.icon />
          </PatternButton>
        </Tooltip>
      ))}
    </div>
  );
}

export function CanvasStyleControls({
  backgroundPattern,
  backgroundColor,
  patternColor,
  backgroundOpacity,
  backgroundPatternScale,
  onSetBackgroundPattern,
  onSetBackgroundColor,
  onSetPatternColor,
  onSetBackgroundOpacity,
  onSetBackgroundPatternScale,
  patternColumns = 4,
  showAllPatterns = false,
}: {
  backgroundPattern: BackgroundPattern;
  backgroundColor: string;
  patternColor: string;
  backgroundOpacity: number;
  backgroundPatternScale: number;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetBackgroundPatternScale: (scale: number) => void;
  // Pattern-grid density. The narrow palette accordion uses 4; the wide
  // dialog passes 7 so the tiles aren't marooned with empty gutters.
  // Discrete values keep the class names static for Tailwind.
  patternColumns?: 4 | 7;
  // Render every pattern at once with no "Show more" toggle. The narrow
  // accordion keeps the toggle (compact for first-time users); the wide
  // dialog has the room to show them all.
  showAllPatterns?: boolean;
}) {
  // The "Show more" toggle applies to the STATIC patterns only; the
  // animated set is small and shown in full so it stays discoverable.
  // Auto-expands when the active static pattern sits behind the toggle so
  // the current selection is always visible. Still called unconditionally
  // (hooks rule) even when showAllPatterns bypasses its visible list.
  const staticList = useShowMoreList(STATIC_PATTERNS, (p) => p.id === backgroundPattern);
  const visibleStatic = showAllPatterns ? STATIC_PATTERNS : staticList.visible;
  const patternGridClass =
    patternColumns === 7
      ? 'mt-1 grid grid-cols-4 gap-1 sm:grid-cols-7'
      : 'mt-1 grid grid-cols-4 gap-1';

  return (
    <>
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">Pattern</p>
      <PatternGrid
        patterns={visibleStatic}
        gridClass={patternGridClass}
        active={backgroundPattern}
        onPick={onSetBackgroundPattern}
      />
      {!showAllPatterns && staticList.hasMore && !staticList.showAll ? (
        <ShowMoreButton label="Show more patterns" onClick={staticList.reveal} />
      ) : null}
      <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Animated
      </p>
      <PatternGrid
        patterns={ANIMATED_PATTERNS}
        gridClass={patternGridClass}
        active={backgroundPattern}
        onPick={onSetBackgroundPattern}
      />
      <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Colours
      </p>
      <div className="mt-1 flex items-stretch gap-1">
        <Tooltip title="Canvas colour" description="The colour of the canvas background.">
          <ColorSwatch label="Canvas" value={backgroundColor} onChange={onSetBackgroundColor} />
        </Tooltip>
        <Tooltip title="Pattern colour" description="The colour of the grid dots or ruled lines.">
          <ColorSwatch label="Pattern" value={patternColor} onChange={onSetPatternColor} />
        </Tooltip>
      </div>
      <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Opacity</p>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
            {Math.round(backgroundOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={backgroundOpacity}
          onChange={(e) => onSetBackgroundOpacity(parseFloat(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Size</p>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
            {Math.round(backgroundPatternScale * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={backgroundPatternScale}
          onChange={(e) => onSetBackgroundPatternScale(parseFloat(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
      </div>
    </>
  );
}
