'use client';

// The per-tab canvas-style controls: the static pattern grid (with the
// "Show more patterns" toggle), a separate Animated pattern grid, the
// Canvas + Pattern colour swatches, and the opacity + size sliders. Lifted
// out of TabSection so the same block renders in both the palette's Canvas
// accordion AND the Canvas tab of the right-click CanvasThemeDialog
// (docs/specs/011-theme/canvas-and-theme-dialog.md) — the two can't drift.
//
// Purely presentational: every change is a callback prop applied live to
// the active tab. The "Show more" expansion is local UI state owned here.

import type { CSSProperties, ReactNode } from 'react';
import { isAnimatedPattern, type BackgroundPattern } from '@livediagram/document';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { useShowMoreList } from '@/hooks/ui/useShowMoreList';
import {
  ColorSwatch,
  PATTERNS,
  PatternButton,
  type PatternEntry,
} from '@/components/palette/palette-controls';
import { ShowMoreButton } from '@/components/primitives/ShowMoreButton';
import { HoverCard } from '@livediagram/ui';
import { RANGE_SLIDER } from '@/components/primitives/surface-classes';

// Static vs animated split (docs/specs/008-canvas/canvas-and-palette.md): the two render as separate, labelled
// sections so the catalogue reads clearly. Computed once from the single
// PATTERNS source so adding a pattern still needs no edits here.
const STATIC_PATTERNS = PATTERNS.filter((p) => !isAnimatedPattern(p.id));
const ANIMATED_PATTERNS = PATTERNS.filter((p) => isAnimatedPattern(p.id));

function PatternGrid({
  patterns,
  gridClass,
  active,
  onPick,
  preview,
}: {
  patterns: PatternEntry[];
  gridClass: string;
  active: BackgroundPattern;
  onPick: (pattern: BackgroundPattern) => void;
  // Large tiles drawing each pattern for real in the tab's colours, rather than its small icon.
  preview?: { backgroundColor: string; patternColor: string; animated: boolean };
}) {
  if (preview) {
    return (
      <div className={gridClass}>
        {patterns.map((p) => (
          <HoverCard key={p.id} title={p.label} description={p.description}>
            <PatternPreviewTile
              active={active === p.id}
              label={p.shortLabel}
              onClick={() => onPick(p.id)}
              style={
                preview.animated
                  ? { backgroundColor: preview.backgroundColor, color: preview.patternColor }
                  : tabBackgroundStyle(
                      p.id,
                      { x: 0, y: 0 },
                      preview.backgroundColor,
                      preview.patternColor,
                    )
              }
            >
              {preview.animated ? <p.icon /> : null}
            </PatternPreviewTile>
          </HoverCard>
        ))}
      </div>
    );
  }
  return (
    <div className={gridClass}>
      {patterns.map((p) => (
        <HoverCard key={p.id} title={p.label} description={p.description}>
          <PatternButton active={active === p.id} onClick={() => onPick(p.id)} label={p.shortLabel}>
            <p.icon />
          </PatternButton>
        </HoverCard>
      ))}
    </div>
  );
}

// A large pattern option (the Tab Style Canvas panel, docs/specs/011-theme/canvas-and-theme-dialog.md
// "Canvas panel"): the pattern drawn for real on the tab's canvas colour, its name beneath.
function PatternPreviewTile({
  active,
  label,
  onClick,
  style,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  style: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`flex w-full cursor-pointer flex-col gap-1 rounded-lg p-1 text-left transition ${
        active
          ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      <span
        aria-hidden
        className="flex h-14 w-full items-center justify-center rounded-md border border-slate-200 dark:border-slate-700"
        style={style}
      >
        {children}
      </span>
      <span className="w-full truncate px-0.5 text-center text-[11px] font-medium">{label}</span>
    </button>
  );
}

// The pattern is ink on the canvas: lines and dots, so the strong tone only.
const PATTERN_TONES = ['strong'] as const;

export function CanvasStyleControls({
  backgroundPattern,
  backgroundColor,
  patternColor,
  backgroundOpacity,
  backgroundPatternScale,
  backgroundAnimationSpeed,
  onSetBackgroundPattern,
  onSetBackgroundColor,
  onSetPatternColor,
  onSetBackgroundOpacity,
  onSetBackgroundPatternScale,
  onSetBackgroundAnimationSpeed,
  showAllPatterns = false,
  previewTiles = false,
}: {
  backgroundPattern: BackgroundPattern;
  backgroundColor: string;
  patternColor: string;
  backgroundOpacity: number;
  backgroundPatternScale: number;
  // Motion rate for an ANIMATED pattern (docs/specs/008-canvas/canvas-and-palette.md), 1 = normal. The Speed
  // slider renders only while an animated pattern is active.
  backgroundAnimationSpeed: number;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetPatternColor: (color: string) => void;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetBackgroundPatternScale: (scale: number) => void;
  onSetBackgroundAnimationSpeed: (speed: number) => void;
  // Render every pattern at once with no "Show more" toggle. The narrow
  // accordion keeps the toggle (compact for first-time users); the wide
  // dialog has the room to show them all.
  showAllPatterns?: boolean;
  // Large tiles drawing each pattern for real in this tab's colours (the dialog's Canvas panel), instead of the
  // compact icon grid the narrow accordion uses.
  previewTiles?: boolean;
}) {
  // The "Show more" toggle applies to the STATIC patterns only; the
  // animated set is small and shown in full so it stays discoverable.
  // Auto-expands when the active static pattern sits behind the toggle so
  // the current selection is always visible. Still called unconditionally
  // (hooks rule) even when showAllPatterns bypasses its visible list.
  const staticList = useShowMoreList(STATIC_PATTERNS, (p) => p.id === backgroundPattern);
  const visibleStatic = showAllPatterns ? STATIC_PATTERNS : staticList.visible;
  const patternGridClass = previewTiles
    ? 'mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4'
    : 'mt-1 grid grid-cols-4 gap-1';
  const preview = (animated: boolean) =>
    previewTiles ? { backgroundColor, patternColor, animated } : undefined;

  return (
    <>
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">Pattern</p>
      <PatternGrid
        patterns={visibleStatic}
        gridClass={patternGridClass}
        active={backgroundPattern}
        onPick={onSetBackgroundPattern}
        preview={preview(false)}
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
        preview={preview(true)}
      />
      <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Colours
      </p>
      <div className="mt-1 flex items-stretch gap-1">
        <HoverCard title="Canvas colour" description="The colour of the canvas background.">
          <ColorSwatch label="Canvas" value={backgroundColor} onChange={onSetBackgroundColor} />
        </HoverCard>
        <HoverCard title="Pattern colour" description="The colour of the grid dots or ruled lines.">
          <ColorSwatch
            label="Pattern"
            value={patternColor}
            onChange={onSetPatternColor}
            tones={PATTERN_TONES}
          />
        </HoverCard>
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
          className={RANGE_SLIDER}
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
          className={RANGE_SLIDER}
        />
      </div>
      {/* Motion speed (docs/specs/008-canvas/canvas-and-palette.md) — only meaningful for an ANIMATED pattern,
          so the row appears exactly when one is active. A rate multiplier:
          100% is each pattern's own tuned pace. */}
      {isAnimatedPattern(backgroundPattern) ? (
        <div className="mt-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Speed</p>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
              {Math.round(backgroundAnimationSpeed * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.25}
            value={backgroundAnimationSpeed}
            onChange={(e) => onSetBackgroundAnimationSpeed(parseFloat(e.target.value))}
            className={RANGE_SLIDER}
          />
        </div>
      ) : null}
    </>
  );
}
