'use client';

// Leaf presentational building blocks for the editor context menu (rows,
// tiles, glyphs, and the small inline data-element editors), extracted from
// EditorContextMenu.tsx to keep that file focused on the menu's structure.
// Each is purely presentational: props in, JSX out, with every action a
// callback. Siblings of context-menu-tiles.tsx / context-menu-icons.tsx.
import { type ReactNode } from 'react';
import {
  clampPercent,
  PIE_ANIMS,
  PROGRESS_ANIMS,
  RAIL_MAX_POINTS,
  RAIL_MIN_POINTS,
  RATING_ANIMS,
  RATING_MAX,
  SHAPE_MARKERS,
  type AnimationSpeed,
  type PieAnim,
  type ProgressAnim,
  type RatingAnim,
  type ShapeMarker,
  type TextSize,
} from '@livediagram/diagram';

import { SizeButton } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { DotsIcon, ScaleIcon } from '@/components/palette/palette-icons';
import { ProgressAnimKindGlyph } from '@/components/palette/context-menu-icons';

import { MARKER_LABELS, ShapeMarkerGlyph } from '@/components/canvas/ShapeMarker';
import { SpeedTiles, TileLabel, withNone } from '@/components/palette/context-menu-tiles';

// Stable no-op for ColourRow callers that don't supply a preview-end handler,
// so useRevertOnUnmount has a constant reference.

// Colour / icon-position / toggle input rows live in their own module;
// re-exported here so the context-menu row imports stay a single source.
import { ColourRow, IconPositionGrid, MenuToggleRow } from './context-menu-input-rows';
export { ColourRow, IconPositionGrid, MenuToggleRow };
export function BorderGrid({
  label,
  cols,
  children,
}: {
  label: string;
  cols: 3 | 4 | 5;
  children: ReactNode;
}) {
  const colClass = cols === 5 ? 'grid-cols-5' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className={`grid gap-1 ${colClass}`}>{children}</div>
    </div>
  );
}

// The "Markers" category glyph — a small filled status dot.
export function MarkersMenuGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="8" cy="8" r="4.5" />
    </svg>
  );
}

// The "None" tile glyph — a dashed empty circle, sized to match a marker glyph.
function NoMarkerGlyph() {
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

// Markers control (spec/49): a None option + one illustrated tile per marker,
// then a Size row (Scale / S / M / L, mirroring the Text size control) once a
// marker is chosen. 'scale' tracks the element's text size.
export function MarkerTiles({
  marker,
  size,
  onSet,
  onSetSize,
  onPreview,
  onPreviewSize,
  onPreviewEnd,
}: {
  marker: ShapeMarker | null;
  size: TextSize;
  onSet: (v: ShapeMarker | null) => void;
  onSetSize: (v: TextSize) => void;
  // Optional hover-preview pair (spec/48 flow) for the marker tiles and the
  // Size row: hovering shows the marker live, leaving reverts.
  onPreview?: (v: ShapeMarker | null) => void;
  onPreviewSize?: (v: TextSize) => void;
  onPreviewEnd?: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
        {withNone(SHAPE_MARKERS).map((v) => (
          <SizeButton
            key={v ?? 'none'}
            active={marker === v}
            onClick={() => onSet(v)}
            onPointerEnter={onPreview ? onMouseHover(() => onPreview(v)) : undefined}
            onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
          >
            <span className="flex flex-col items-center gap-0.5">
              {v ? <ShapeMarkerGlyph marker={v} size={18} /> : <NoMarkerGlyph />}
              <span className="text-[9px] leading-none">{v ? MARKER_LABELS[v] : 'None'}</span>
            </span>
          </SizeButton>
        ))}
      </div>
      {marker ? (
        <>
          <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Size
          </p>
          <TextSizeTiles
            current={size}
            onSet={onSetSize}
            onPreview={onPreviewSize}
            onPreviewEnd={onPreviewEnd}
          />
        </>
      ) : null}
    </>
  );
}

// Grid wrapper for MenuTiles. Literal column classes so Tailwind keeps them.

// Opacity slider row inside the context menu. Doesn't close the menu on
// interaction (it isn't a MenuItem): dragging fires pointer events inside
// the menu, so the ContextMenu's outside-click guard keeps it open.
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
function PercentSliderRow({
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

export function OpacityRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (opacity: number) => void;
}) {
  return (
    <PercentSliderRow
      label="Opacity"
      pct={Math.round(value * 100)}
      onPct={(p) => onChange(p / 100)}
    />
  );
}

// A square toggle for the arrow Text category (B / I / U / S).
export function TextToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

// The four-up text-size picker (Scale / Small / Medium / Large) shown in the
// Text categories. `current` is the already-resolved size to highlight (the
// caller decides its default), so the single-element + multi menus share one
// grid.
export function TextSizeTiles({
  current,
  onSet,
  onPreview,
  onPreviewEnd,
}: {
  current: TextSize | undefined;
  onSet: (size: TextSize) => void;
  // Optional hover-preview pair (spec/48 flow): hovering a tile shows the
  // size live, leaving reverts. Callers without preview (table cells) omit.
  onPreview?: (size: TextSize) => void;
  onPreviewEnd?: () => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 px-2 pb-1.5">
      {(
        [
          ['scale', <ScaleIcon key="s" />],
          ['sm', <DotsIcon key="1" count={1} />],
          ['md', <DotsIcon key="2" count={2} />],
          ['lg', <DotsIcon key="3" count={3} />],
        ] as const
      ).map(([size, glyph]) => (
        <SizeButton
          key={size}
          active={current === size}
          onClick={() => onSet(size)}
          onPointerEnter={onPreview ? onMouseHover(() => onPreview(size)) : undefined}
          onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
        >
          {glyph}
        </SizeButton>
      ))}
    </div>
  );
}
