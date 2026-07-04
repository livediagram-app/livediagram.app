// The DATA-shape context-menu rows (spec/46 progress, spec/51 rails,
// rating, pie / chart): the inline editors (point stepper, star picker,
// percent slider), their category glyphs, and the shared AnimTiles
// grid the three per-kind animation pickers ride. Split from
// context-menu-rows.tsx (which re-exports everything here) so that file
// keeps the generic look-and-feel rows.

import { type ReactNode } from 'react';
import {
  clampPercent,
  PIE_ANIMS,
  PROGRESS_ANIMS,
  RAIL_MAX_POINTS,
  RAIL_MIN_POINTS,
  RATING_ANIMS,
  RATING_MAX,
  type AnimationSpeed,
  type PieAnim,
  type ProgressAnim,
  type RatingAnim,
} from '@livediagram/diagram';
import { MenuToggleRow } from './context-menu-input-rows';

// The "None" tile glyph — a dashed empty circle, sized to match a marker glyph.
export function NoMarkerGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="3 3"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}
import { SizeButton } from '@/components/palette/palette-controls';
import { ProgressAnimKindGlyph } from '@/components/palette/context-menu-icons';
import { SpeedTiles, TileLabel, withNone } from '@/components/palette/context-menu-tiles';

// Progress percentage slider (spec/46). Mirrors OpacityRow but on a 0–100
// integer scale.
// Timeline-rail point count (spec/51): a − / value / + stepper. The canvas
// "+" affordance adds points too; this also removes them.
export function RailPointsRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const stepBtn =
    'flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 transition enabled:cursor-pointer enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60';
  return (
    <div className="px-3 py-1.5">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Points</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          className={stepBtn}
          disabled={value <= RAIL_MIN_POINTS}
          onClick={() => onChange(Math.max(RAIL_MIN_POINTS, value - 1))}
          aria-label="Fewer points"
        >
          −
        </button>
        <span className="w-8 text-center text-xs font-medium tabular-nums text-slate-700 dark:text-slate-200">
          {value}
        </span>
        <button
          type="button"
          className={stepBtn}
          disabled={value >= RAIL_MAX_POINTS}
          onClick={() => onChange(Math.min(RAIL_MAX_POINTS, value + 1))}
          aria-label="More points"
        >
          +
        </button>
      </div>
    </div>
  );
}

// A small star glyph for the Rating controls (filled = scored, else outline).
function StarGlyph({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.6l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.85 6.6 19.23l1.03-6.02L3.26 8.95l6.04-.88z"
        fill={filled ? '#f59e0b' : 'none'}
        stroke={filled ? '#f59e0b' : 'currentColor'}
        strokeWidth={filled ? 0 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The "Rating" category glyph.
export function RatingMenuGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.6l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.85 6.6 19.23l1.03-6.02L3.26 8.95l6.04-.88z" />
    </svg>
  );
}

// Rating star picker (spec/52): click a star to set the 1..RATING_MAX score.
export function RatingPickerRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="px-2 py-1.5">
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">Stars</p>
      <div className="flex items-center justify-center gap-1 text-slate-400 dark:text-slate-500">
        {Array.from({ length: RATING_MAX }, (_, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className="cursor-pointer rounded p-0.5 transition hover:scale-110"
            >
              <StarGlyph filled={n <= value} size={20} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Rating animation tiles (spec/52): None + the star-specific animations, then a
// Shared body for the per-element animation pickers (Progress / Rating / Pie):
// a None-prepended tile grid, then a Speed row + a Repeat toggle once an
// animation is picked. Each kind passes only its own anim list + tile glyph;
// everything else (speed, repeat, the play-once-vs-loop copy) is identical.
// `header` adds the "Animation" label (Progress omits it, as the category
// title already reads "Animation").
export type AnimTilesProps<T extends string> = {
  anim: T | null;
  speed: AnimationSpeed;
  repeat: boolean;
  onSet: (v: T | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
  onSetRepeat: (v: boolean) => void;
};
function AnimTiles<T extends string>({
  anims,
  glyphFor,
  header = true,
  anim,
  speed,
  repeat,
  onSet,
  onSetSpeed,
  onSetRepeat,
}: AnimTilesProps<T> & {
  anims: readonly T[];
  glyphFor: (v: T | null) => ReactNode;
  header?: boolean;
}) {
  return (
    <>
      {header ? (
        <p className="px-3 pb-1 pt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Animation
        </p>
      ) : null}
      <div className={`grid grid-cols-4 gap-1 px-2 ${header ? 'pb-1.5' : 'py-1.5'}`}>
        {withNone(anims).map((v) => (
          <SizeButton key={v ?? 'none'} active={anim === v} onClick={() => onSet(v)}>
            <TileLabel glyph={glyphFor(v)} label={v ?? 'None'} />
          </SizeButton>
        ))}
      </div>
      {anim ? (
        <>
          <SpeedTiles value={speed} onSet={onSetSpeed} />
          <MenuToggleRow
            label="Repeat"
            description="Loop the animation instead of playing it once."
            checked={repeat}
            onToggle={() => onSetRepeat(!repeat)}
          />
        </>
      ) : null}
    </>
  );
}

export function RatingAnimTiles(props: AnimTilesProps<RatingAnim>) {
  return (
    <AnimTiles
      {...props}
      anims={RATING_ANIMS}
      glyphFor={(v) => <StarGlyph filled={!!v} size={16} />}
    />
  );
}

// A small pie glyph for the Data category + its animation tiles.
function PieGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#0ea5e9" />
      <path d="M12 12 L12 3 A9 9 0 0 1 20.5 15 Z" fill="#f59e0b" />
      <path d="M12 12 L20.5 15 A9 9 0 0 1 7 20.2 Z" fill="#22c55e" />
    </svg>
  );
}
// Monochrome pie outline — the "Data" category glyph. The other category
// glyphs are all single-colour (currentColor), so the colourful PieGlyph (used
// for the animation tiles) would stand out; this matches them.
export function DataMenuGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12 L12 3 M12 12 L20.5 15" />
    </svg>
  );
}

// Bars-in-a-frame — the "Chart" (display options) category glyph.
export function ChartMenuGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4 V20 H20" />
      <path d="M8 16 V13 M12 16 V9 M16 16 V11" />
    </svg>
  );
}

// Pie / line chart data editors live in their own module; re-exported here
// so the context-menu row imports stay a single source.
export { LineDataSummary, PieDataEditor } from './context-menu-data-editors';

// Pie slice animation tiles (spec/53): None + the chart animations, then Speed
// + Repeat once one is picked (mirrors ProgressAnimTiles / RatingAnimTiles).
export function PieAnimTiles(props: AnimTilesProps<PieAnim>) {
  return (
    <AnimTiles
      {...props}
      anims={PIE_ANIMS}
      glyphFor={(v) => (v ? <PieGlyph size={16} /> : <NoMarkerGlyph />)}
    />
  );
}

// A labelled 0–100 range slider with a right-aligned `{pct}%` readout. Shared
// by the Progress percentage + the Layer opacity rows; each owns its own
// value<->pct conversion and passes the already-resolved pct in.
export function PercentSliderRow({
  label,
  pct,
  onPct,
}: {
  label: string;
  pct: number;
  onPct: (pct: number) => void;
}) {
  return (
    <div className="px-3 py-1.5">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => onPct(Number(e.target.value))}
          aria-label={label}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
        <span className="w-10 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
          {pct}%
        </span>
      </div>
    </div>
  );
}

export function ProgressRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <PercentSliderRow label="Percentage" pct={clampPercent(value)} onPct={onChange} />;
}

// Progress fill-animation tiles (spec/46): None / Fill / Pulse / Stripes, plus
// a Speed row + a Repeat toggle once an animation is picked. `fill` defaults to
// playing once and holding (Repeat off); pulse / stripes default to looping.
// No header (the Progress category title already reads "Animation").
export function ProgressAnimTiles(props: AnimTilesProps<ProgressAnim>) {
  return (
    <AnimTiles
      {...props}
      anims={PROGRESS_ANIMS}
      header={false}
      glyphFor={(v) => <ProgressAnimKindGlyph kind={v} />}
    />
  );
}
