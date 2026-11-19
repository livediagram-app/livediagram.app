'use client';

// The per-tab controls of the Tab Style dialog's Room panel (docs/specs/011-theme/canvas-and-theme-dialog.md
// "Room panel"): the floors (docs/specs/011-theme/floors.md) drawn for real in a carousel, the canvas colour, the
// strength and size sliders, and the walls the 3D view stands up (docs/specs/008-canvas/3d-view.md "Themes"). A seasonal look's motif is the one thing on a canvas that still inks the tab's
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

// The plaster the walls wear while the tab sets no colour (space-3d.css --space-wall), shown on the swatch.
const PLASTER = '#ddd3c3';

/** The tab's wall colour and its setter (undefined puts the plaster back). */
type WallsControl = { color: string | undefined; onSet: (color: string | undefined) => void };

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
  walls,
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
  // The walls row; left out where nothing sets the tab (a test, a surface with no editor).
  walls?: WallsControl | undefined;
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
      {walls ? (
        <>
          <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Walls
          </p>
          <div className="mt-1 flex items-stretch gap-1">
            <HoverCard
              title="Wall colour"
              description="The colour of the walls round the rooms in the 3D view. Plaster until you pick one."
            >
              <ColorSwatch label="Walls" value={walls.color ?? PLASTER} onChange={walls.onSet} />
            </HoverCard>
            {walls.color ? (
              <button
                type="button"
                onClick={() => walls.onSet(undefined)}
                className="cursor-pointer rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
              >
                Plaster
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
