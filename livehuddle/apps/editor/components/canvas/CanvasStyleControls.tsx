'use client';

// The per-tab canvas controls of the Tab Style dialog's Canvas panel (docs/specs/011-theme/canvas-and-theme-dialog.md
// "Canvas panel"): the floors (docs/specs/011-theme/floors.md) drawn for real in a carousel, the canvas colour, and
// the strength and size sliders. A seasonal look's motif is the one thing on a canvas that still inks the tab's
// pattern colour, so its swatch shows only while one is worn.
//
// Purely presentational: every change is a callback prop applied live to the active tab.

import { isSeasonalPattern, spacePattern, type BackgroundPattern } from '@livehuddle/document';
import { PatternCarousel } from './PatternCarousel';
import { ColorSwatch, PATTERNS } from '@/components/palette/palette-controls';
import { HoverCard } from '@livehuddle/ui';
import { RANGE_SLIDER } from '@liveworkspace/workbench/components/primitives/surface-classes';
import type { TabStyleControl } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';

// Nothing left out: the dialog's default.
const NONE_HIDDEN: ReadonlySet<TabStyleControl> = new Set();

// A motif is ink on the canvas, so the strong tone only.
const PATTERN_TONES = ['strong'] as const;

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
  hidden = NONE_HIDDEN,
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
  // The controls the Tab Style surface leaves out (liveworkspace/docs/specs/011-workbench/tab-style.md "The profile").
  // A floor never moves, so there is no animation speed to leave out.
  hidden?: ReadonlySet<TabStyleControl>;
}) {
  // What the canvas draws: a retired diagram pattern is picked as the floor it shows as.
  const drawn = spacePattern(backgroundPattern);
  return (
    <>
      <PatternCarousel
        heading="Floor"
        patterns={PATTERNS}
        active={drawn}
        onPick={onSetBackgroundPattern}
        backgroundColor={backgroundColor}
        patternColor={patternColor}
      />
      <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Colours
      </p>
      <div className="mt-1 flex items-stretch gap-1">
        <HoverCard
          title="Canvas colour"
          description="The colour under the floor: all of the canvas with None, and showing through a floor below full strength."
        >
          <ColorSwatch label="Canvas" value={backgroundColor} onChange={onSetBackgroundColor} />
        </HoverCard>
        {isSeasonalPattern(drawn) && !hidden.has('patternColor') ? (
          <HoverCard title="Pattern colour" description="The colour of the seasonal motif.">
            <ColorSwatch
              label="Pattern"
              value={patternColor}
              onChange={onSetPatternColor}
              tones={PATTERN_TONES}
            />
          </HoverCard>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Strength</p>
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
      {hidden.has('patternScale') ? null : (
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
      )}
    </>
  );
}
