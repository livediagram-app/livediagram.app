'use client';

// One-click style presets for the selected-element context menu (docs/specs/010-palette/style-presets.md).
// Two surfaces:
//   - ShapePresets — theme-derived style looks in hierarchical tiers (theme /
//     neutral / border treatments / semantic status), each a complete style:
//     colour + a matching border weight and pattern (never the radius —
//     that's the user's own silhouette choice) + a reset.
//   - ArrowPresets — line looks in tiers (solid weights, patterns, animated
//     flows) + a reset.
//   - CodeThemePresets: a code block's colour scheme (docs/specs/009-elements/code-block.md), the one
//     style choice that element has: it paints its own card and takes no
//     element colours, so there is nothing to reset it TO but another scheme.
//   - TablePresets: a table's four surfaces (cells, grid, header band, header
//     text) plus the banding, which only read well in combination.
//   - ChartPalettePresets: a chart's categorical ramp (docs/specs/009-elements/pie-chart.md).
// Purely presentational: every apply is a callback prop. Shape presets are
// theme-derived (passed in); arrow presets are the static table below. Lives in
// its own file so EditorContextMenu doesn't accrete more large categories
// inline (see the no-god-files principle).

import {
  ARROW_THICKNESS_PX,
  CHART_PALETTES,
  CODE_THEMES,
  DEFAULT_CODE_THEME,
  type ChartPalette,
  type ChartPaletteId,
  type CodeTheme,
  type CodeThemeId,
  type TablePreset,
  type ArrowFlow,
  type ArrowThickness,
  type BorderStyle,
  type BorderStroke,
  type ShapeKind,
} from '@livediagram/diagram';
import type { ShapeColorPreset } from '@/lib/themes';
import { SizeButton } from '@/components/palette/palette-controls';
import { MenuActionButton } from '@/components/primitives/PortalMenu';
import { ShapeGlyph } from '@/components/primitives/shape-icon';
import { onMouseHover, useRevertOnUnmount } from '@/components/primitives/hover-preview';

// ── Static preset table ─────────────────────────────────────────────────

// Arrow presets: line pattern × thickness × optional flow animation, so the
// user can grab a dashed animated arrow, a travelling-dot arrow, etc. in one
// click. Ordered hierarchically so the grid reads as tiers: solid weights
// (fine → bold), then patterns (with their weight variants), then the
// animated flows.
export type ArrowPreset = {
  name: string;
  style: BorderStyle;
  thickness: ArrowThickness;
  flow?: ArrowFlow;
};
const ARROW_PRESETS: readonly ArrowPreset[] = [
  // ── Solid weights, lightest → heaviest ──
  { name: 'Fine', style: 'solid', thickness: 'thin' },
  { name: 'Plain', style: 'solid', thickness: 'medium' },
  { name: 'Bold', style: 'solid', thickness: 'thick' },
  // ── Patterns ──
  { name: 'Fine Dash', style: 'dashed', thickness: 'thin' },
  { name: 'Dashed', style: 'dashed', thickness: 'medium' },
  { name: 'Bold Dash', style: 'dashed', thickness: 'thick' },
  { name: 'Dotted', style: 'dotted', thickness: 'medium' },
  // ── Animated flows ──
  { name: 'Flow', style: 'solid', thickness: 'medium', flow: 'dashes' },
  { name: 'Dash Flow', style: 'dashed', thickness: 'medium', flow: 'dashes' },
  { name: 'Dot Flow', style: 'solid', thickness: 'medium', flow: 'dots' },
  { name: 'Signal', style: 'solid', thickness: 'medium', flow: 'signal' },
  { name: 'Pulse', style: 'solid', thickness: 'medium', flow: 'pulse' },
];

// ── Preview-style mappings ──────────────────────────────────────────────

// Border weight in 16-unit viewBox units, for the shape-matched swatch outline.
const BORDER_WIDTH_SVG: Record<BorderStroke, number> = {
  none: 0,
  thin: 1,
  medium: 1.6,
  thick: 2.4,
  'extra-thick': 3.2,
};
// stroke-dasharray (16-unit units) for the swatch outline, one per border
// pattern so a Dash-Dot tile previews as dash-dot rather than as dashed.
const SVG_BORDER_DASH: Record<BorderStyle, string | undefined> = {
  solid: undefined,
  dashed: '3 2',
  dotted: '0.6 2',
  'long-dash': '5 2',
  'dash-dot': '3 1.5 0.6 1.5',
  'dash-dot-dot': '3 1.5 0.6 1.5 0.6 1.5',
};
function svgBorderDash(style: BorderStyle): string | undefined {
  return SVG_BORDER_DASH[style];
}
// SVG stroke-dasharray for an arrow-line preview, scaled to the stroke width.
function svgDash(style: BorderStyle, w: number): string | undefined {
  if (style === 'dotted') return `0.1 ${w * 2.5}`;
  if (style === 'solid') return undefined;
  return `${w * 3} ${w * 2.5}`;
}

// ── Tiles ───────────────────────────────────────────────────────────────

function PresetLabel({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      {children}
      <span className="text-[9px] capitalize leading-none">{name}</span>
    </span>
  );
}

// The colour swatch previews on the user's actual shape (a circle as a circle,
// not a square): the silhouette filled with the preset fill + stroked with its
// border colour, an "A" in the text colour overlaid for the label.
function ColorPresetSwatch({ preset, shape }: { preset: ShapeColorPreset; shape: ShapeKind }) {
  return (
    <span className="relative flex h-5 w-7 items-center justify-center" aria-hidden>
      <ShapeGlyph
        kind={shape}
        fill={preset.fill}
        stroke={preset.stroke}
        strokeWidth={BORDER_WIDTH_SVG[preset.borderStroke]}
        dash={svgBorderDash(preset.borderStyle)}
        size={20}
      />
      <span className="absolute text-[9px] font-bold leading-none" style={{ color: preset.text }}>
        A
      </span>
    </span>
  );
}

export function ShapePresets({
  shape,
  colorPresets,
  current,
  onApplyColor,
  onPreviewColor,
  onPreviewEnd,
  onReset,
}: {
  // The selected shape's kind, so the preview tiles match it.
  shape: ShapeKind;
  colorPresets: ShapeColorPreset[];
  // The shape's current style, to highlight a preset that matches it.
  current: {
    fillColor?: string;
    strokeColor?: string;
    textColor?: string;
    // The bound preset id (docs/specs/010-palette/style-presets.md), when the shape was styled from a preset —
    // the robust way to highlight the active tile across themes.
    colorPreset?: string;
  };
  onApplyColor: (preset: ShapeColorPreset) => void;
  // Hover preview (desktop pointer only): show the preset live, revert on leave.
  onPreviewColor: (preset: ShapeColorPreset) => void;
  onPreviewEnd: () => void;
  onReset: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd);
  const eq = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  // Bound by preset id when the shape carries one (tracks across themes);
  // otherwise fall back to an exact colour-triple match.
  const isActive = (p: ShapeColorPreset) =>
    current.colorPreset
      ? current.colorPreset === p.id
      : eq(current.fillColor, p.fill) &&
        eq(current.strokeColor, p.stroke) &&
        eq(current.textColor, p.text);
  return (
    <div className="px-2 py-1">
      <div className="mb-1.5 grid grid-cols-4 gap-1">
        {colorPresets.map((p) => (
          <SizeButton
            key={p.id}
            active={isActive(p)}
            onClick={() => onApplyColor(p)}
            onPointerEnter={onMouseHover(() => onPreviewColor(p))}
            onPointerLeave={onMouseHover(onPreviewEnd)}
          >
            <PresetLabel name={p.name}>
              <ColorPresetSwatch preset={p} shape={shape} />
            </PresetLabel>
          </SizeButton>
        ))}
      </div>
      <ResetButton onReset={onReset} />
    </div>
  );
}

// ── Arrow presets ───────────────────────────────────────────────────────

function ArrowPresetSwatch({ preset }: { preset: ArrowPreset }) {
  const w = ARROW_THICKNESS_PX[preset.thickness];
  const dash = svgDash(preset.style, w);
  return (
    <svg width="34" height="14" viewBox="0 0 34 14" fill="none" aria-hidden>
      <path
        d="M2 7 H26"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap={preset.style === 'dotted' ? 'round' : 'butt'}
        strokeDasharray={dash}
        // Reuse the canvas arrow-flow march so animated presets preview live.
        className={preset.flow ? 'lvd-arrow-flow' : undefined}
      />
      <path
        d="M24 3 L30 7 L24 11"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowPresets({
  current,
  onApply,
  onPreview,
  onPreviewEnd,
  onReset,
}: {
  // The arrow's current style, to highlight a matching preset. strokeWidth
  // disambiguates the weight tiers (Fine / Plain / Bold share style + flow).
  current: { strokeStyle?: BorderStyle; strokeWidth?: number; flow?: ArrowFlow };
  onApply: (preset: ArrowPreset) => void;
  // Hover preview (desktop pointer only): show the preset live, revert on leave.
  onPreview: (preset: ArrowPreset) => void;
  onPreviewEnd: () => void;
  onReset: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd);
  return (
    <div className="px-2 py-1.5">
      <div className="grid grid-cols-4 gap-1">
        {ARROW_PRESETS.map((p) => (
          <SizeButton
            key={p.name}
            active={
              (current.strokeStyle ?? 'solid') === p.style &&
              current.flow === p.flow &&
              (current.strokeWidth ?? ARROW_THICKNESS_PX.medium) === ARROW_THICKNESS_PX[p.thickness]
            }
            onClick={() => onApply(p)}
            onPointerEnter={onMouseHover(() => onPreview(p))}
            onPointerLeave={onMouseHover(onPreviewEnd)}
          >
            <PresetLabel name={p.name}>
              <ArrowPresetSwatch preset={p} />
            </PresetLabel>
          </SizeButton>
        ))}
      </div>
      <ResetButton onReset={onReset} />
    </div>
  );
}

// ── Code-block schemes ──────────────────────────────────────────────────

// A miniature of the card itself: the surface + border, then three token-
// coloured bars standing in for a line of code. The tile has to answer "what
// will my block look like", and only the real colours can.
function CodeThemeSwatch({ theme }: { theme: CodeTheme }) {
  return (
    <svg width="28" height="18" viewBox="0 0 28 18" aria-hidden>
      <rect
        x="0.75"
        y="0.75"
        width="26.5"
        height="16.5"
        rx="2.5"
        fill={theme.surface}
        stroke={theme.border}
        strokeWidth="1.5"
      />
      <rect x="4" y="4.5" width="7" height="2" rx="1" fill={theme.keyword} />
      <rect x="12.5" y="4.5" width="9" height="2" rx="1" fill={theme.string} />
      <rect x="4" y="8.5" width="14" height="2" rx="1" fill={theme.text} />
      <rect x="4" y="12.5" width="10" height="2" rx="1" fill={theme.comment} />
    </svg>
  );
}

export function CodeThemePresets({
  current,
  onApply,
  onPreview,
  onPreviewEnd,
}: {
  // The block's stored scheme id; absent means the default card.
  current: string | undefined;
  onApply: (id: CodeThemeId) => void;
  onPreview: (id: CodeThemeId) => void;
  onPreviewEnd: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd);
  const active = current ?? DEFAULT_CODE_THEME;
  return (
    <div className="px-2 py-1">
      <div className="grid grid-cols-4 gap-1">
        {CODE_THEMES.map((theme) => (
          <SizeButton
            key={theme.id}
            active={active === theme.id}
            onClick={() => onApply(theme.id)}
            onPointerEnter={onMouseHover(() => onPreview(theme.id))}
            onPointerLeave={onMouseHover(onPreviewEnd)}
          >
            <PresetLabel name={theme.name}>
              <CodeThemeSwatch theme={theme} />
            </PresetLabel>
          </SizeButton>
        ))}
      </div>
    </div>
  );
}

// ── Table looks ─────────────────────────────────────────────────────────

// A miniature of the table: header band, grid lines, and a banded body row
// when the preset bands. The four surfaces only read well in combination, so
// the tile has to show the combination.
function TablePresetSwatch({ preset }: { preset: TablePreset }) {
  const cell = preset.fill === 'transparent' ? 'none' : preset.fill;
  return (
    <svg width="28" height="18" viewBox="0 0 28 18" aria-hidden>
      <rect x="0.75" y="0.75" width="26.5" height="16.5" rx="1.5" fill={cell} />
      <rect
        x="0.75"
        y="0.75"
        width="26.5"
        height="5"
        fill={preset.headerFill === 'transparent' ? 'none' : preset.headerFill}
      />
      {preset.zebra ? (
        <rect x="0.75" y="10.75" width="26.5" height="3.5" fill={preset.stroke} opacity="0.18" />
      ) : null}
      <g stroke={preset.stroke} strokeWidth="1" vectorEffect="non-scaling-stroke">
        <rect x="0.75" y="0.75" width="26.5" height="16.5" rx="1.5" fill="none" />
        <path d="M0.75 5.75 H27.25 M0.75 10.75 H27.25 M0.75 14.25 H27.25 M9.5 0.75 V17.25 M18.5 0.75 V17.25" />
      </g>
      <rect x="2.5" y="2.5" width="5" height="1.5" rx="0.75" fill={preset.headerText} />
    </svg>
  );
}

export function TablePresets({
  presets,
  current,
  onApply,
  onPreview,
  onPreviewEnd,
  onReset,
}: {
  presets: TablePreset[];
  // The table's current colours, to highlight a matching tile. A table has no
  // `colorPreset` binding field, so this matches on the colours themselves.
  current: { fillColor?: string; strokeColor?: string; headerFill?: string; zebra?: boolean };
  onApply: (preset: TablePreset) => void;
  onPreview: (preset: TablePreset) => void;
  onPreviewEnd: () => void;
  onReset: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd);
  const eq = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  const isActive = (p: TablePreset) =>
    eq(current.fillColor, p.fill) &&
    eq(current.strokeColor, p.stroke) &&
    eq(current.headerFill, p.headerFill) &&
    (current.zebra ?? false) === p.zebra;
  return (
    <div className="px-2 py-1">
      <div className="mb-1.5 grid grid-cols-4 gap-1">
        {presets.map((p) => (
          <SizeButton
            key={p.id}
            active={isActive(p)}
            onClick={() => onApply(p)}
            onPointerEnter={onMouseHover(() => onPreview(p))}
            onPointerLeave={onMouseHover(onPreviewEnd)}
          >
            <PresetLabel name={p.name}>
              <TablePresetSwatch preset={p} />
            </PresetLabel>
          </SizeButton>
        ))}
      </div>
      <ResetButton onReset={onReset} />
    </div>
  );
}

// ── Chart palettes ──────────────────────────────────────────────────────

// The ramp itself, as the stripe of colours a legend will run through. Four
// of the eight: enough to tell the palettes apart at tile size, where eight
// slivers would read as mud.
function ChartPaletteSwatch({ palette }: { palette: ChartPalette }) {
  return (
    <svg width="28" height="18" viewBox="0 0 28 18" aria-hidden>
      {palette.colors.slice(0, 4).map((color, i) => (
        <rect key={i} x={i * 7} y={1} width={7} height={16} fill={color} />
      ))}
      <rect
        x="0.5"
        y="1"
        width="27"
        height="16"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1"
      />
    </svg>
  );
}

export function ChartPalettePresets({
  current,
  onApply,
  onPreview,
  onPreviewEnd,
  onReset,
}: {
  // The chart's stored palette id; absent means it follows the tab theme.
  current: string | undefined;
  onApply: (id: ChartPaletteId) => void;
  onPreview: (id: ChartPaletteId) => void;
  onPreviewEnd: () => void;
  // Back to no palette, i.e. following the theme again. Unlike the other
  // grids this genuinely has something to reset TO.
  onReset: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd);
  return (
    <div className="px-2 py-1">
      <div className="mb-1.5 grid grid-cols-4 gap-1">
        {CHART_PALETTES.map((palette) => (
          <SizeButton
            key={palette.id}
            active={current === palette.id}
            onClick={() => onApply(palette.id)}
            onPointerEnter={onMouseHover(() => onPreview(palette.id))}
            onPointerLeave={onMouseHover(onPreviewEnd)}
          >
            <PresetLabel name={palette.name}>
              <ChartPaletteSwatch palette={palette} />
            </PresetLabel>
          </SizeButton>
        ))}
      </div>
      <ResetButton onReset={onReset} />
    </div>
  );
}

// Shared "Reset to default" button beneath the preset grids.
function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <div className="px-0 pb-1 pt-1.5">
      <MenuActionButton label="Reset to default" onClick={onReset} />
    </div>
  );
}
