'use client';

// Leaf presentational building blocks for the editor context menu (rows,
// tiles, glyphs, and the small inline data-element editors), extracted from
// EditorContextMenu.tsx to keep that file focused on the menu's structure.
// Each is purely presentational: props in, JSX out, with every action a
// callback. Siblings of context-menu-tiles.tsx / context-menu-icons.tsx.
import { type ReactNode } from 'react';
import { SHAPE_MARKERS, type ShapeMarker, type TextSize } from '@livediagram/diagram';

import { SizeButton } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { DotsIcon, ScaleIcon } from '@/components/palette/palette-icons';

import { MARKER_LABELS, ShapeMarkerGlyph } from '@/components/canvas/ShapeMarker';
import { withNone } from '@/components/palette/context-menu-tiles';

// Stable no-op for ColourRow callers that don't supply a preview-end handler,
// so useRevertOnUnmount has a constant reference.

// Colour / icon-position / toggle input rows live in their own module;
// re-exported here so the context-menu row imports stay a single source.
import { ColourRow, IconPositionGrid, MenuToggleRow } from './context-menu-input-rows';
import { NoMarkerGlyph, PercentSliderRow } from './context-menu-data-rows';

// Data-shape rows (rail / rating / pie / progress editors + AnimTiles)
// live in context-menu-data-rows.tsx; re-exported so importers keep
// resolving.
export { LineDataSummary, PieDataEditor } from './context-menu-data-editors';
export {
  ChartMenuGlyph,
  DataMenuGlyph,
  PieAnimTiles,
  ProgressAnimTiles,
  ProgressRow,
  RailPointsRow,
  RatingAnimTiles,
  RatingMenuGlyph,
  RatingPickerRow,
  type AnimTilesProps,
} from './context-menu-data-rows';
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
