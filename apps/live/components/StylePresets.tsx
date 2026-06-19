'use client';

// One-click style presets for the selected-element context menu (spec/48).
// Two surfaces:
//   - ShapePresets — eight theme-derived colour looks + up to eight border
//     looks (weight × pattern × radius) + a reset, combined freely.
//   - ArrowPresets — eight line looks (pattern × thickness × optional flow
//     animation, e.g. a dashed animated arrow) + a reset.
// Purely presentational: every apply is a callback prop. Colour presets are
// theme-derived (passed in); border + arrow presets are the static tables
// below. Lives in its own file so EditorContextMenu doesn't accrete more large
// categories inline (see the no-god-files principle).

import {
  ARROW_THICKNESS_PX,
  type ArrowFlow,
  type ArrowThickness,
  type BorderRadius,
  type BorderStyle,
  type BorderStroke,
} from '@livediagram/diagram';
import type { ShapeColorPreset } from '@/lib/themes';
import { SizeButton } from '@/components/palette-controls';
import { MenuActionButton } from '@/components/PortalMenu';
import { nearestCssBorderStyle } from '@/components/border-css';

// ── Static preset table ─────────────────────────────────────────────────

// Shape border presets: weight × pattern × radius, ordered to read as a
// spread of variety and emphasis — sharp through pill, dotted / dashed, and
// heavy / fine weights. The rounded preset uses the same `lg` radius the
// Border category exposes.
export type ShapeBorderPreset = {
  name: string;
  stroke: BorderStroke;
  style: BorderStyle;
  radius: BorderRadius;
};
const SHAPE_BORDER_PRESETS: readonly ShapeBorderPreset[] = [
  { name: 'Default', stroke: 'medium', style: 'solid', radius: 'sm' },
  { name: 'Sharp', stroke: 'medium', style: 'solid', radius: 'none' },
  { name: 'Rounded', stroke: 'medium', style: 'solid', radius: 'lg' },
  { name: 'Pill', stroke: 'medium', style: 'solid', radius: 'full' },
  { name: 'Dotted', stroke: 'medium', style: 'dotted', radius: 'sm' },
  { name: 'Dashed', stroke: 'medium', style: 'dashed', radius: 'md' },
  { name: 'Heavy', stroke: 'thick', style: 'solid', radius: 'none' },
  { name: 'Fine', stroke: 'thin', style: 'solid', radius: 'lg' },
];

// Arrow presets: line pattern × thickness × optional flow animation, so the
// user can grab a dashed animated arrow, a travelling-dot arrow, etc. in one
// click.
export type ArrowPreset = {
  name: string;
  style: BorderStyle;
  thickness: ArrowThickness;
  flow?: ArrowFlow;
};
const ARROW_PRESETS: readonly ArrowPreset[] = [
  { name: 'Plain', style: 'solid', thickness: 'medium' },
  { name: 'Bold', style: 'solid', thickness: 'thick' },
  { name: 'Fine', style: 'solid', thickness: 'thin' },
  { name: 'Dashed', style: 'dashed', thickness: 'medium' },
  { name: 'Dotted', style: 'dotted', thickness: 'medium' },
  { name: 'Flow', style: 'solid', thickness: 'medium', flow: 'dashes' },
  { name: 'Dash Flow', style: 'dashed', thickness: 'medium', flow: 'dashes' },
  { name: 'Dot Flow', style: 'solid', thickness: 'medium', flow: 'dots' },
];

// ── Preview-style mappings ──────────────────────────────────────────────

const BORDER_WIDTH_PX: Record<BorderStroke, number> = {
  none: 0,
  thin: 1,
  medium: 2,
  thick: 3,
  'extra-thick': 4,
};
// Preview corner radius (px on the small tile box). `full` clamps to a large
// value so the box reads as a pill.
const BORDER_RADIUS_PX: Record<BorderRadius, number> = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 7,
  full: 999,
};
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

function ColorPresetSwatch({ preset }: { preset: ShapeColorPreset }) {
  return (
    <span
      className="flex h-5 w-7 items-center justify-center rounded text-[10px] font-bold"
      style={{
        backgroundColor: preset.fill,
        borderColor: preset.stroke,
        borderWidth: 1.5,
        borderStyle: 'solid',
        color: preset.text,
      }}
      aria-hidden
    >
      A
    </span>
  );
}

function BorderPresetSwatch({ preset }: { preset: ShapeBorderPreset }) {
  // borderColor is left to currentColor so the preview adopts the button's
  // text tone (slate, brand when active).
  return (
    <span
      className="h-5 w-7"
      style={{
        borderWidth: BORDER_WIDTH_PX[preset.stroke],
        borderStyle: nearestCssBorderStyle(preset.style),
        borderRadius: BORDER_RADIUS_PX[preset.radius],
      }}
      aria-hidden
    />
  );
}

export function ShapePresets({
  colorPresets,
  current,
  onApplyColor,
  onApplyBorder,
  onReset,
}: {
  colorPresets: ShapeColorPreset[];
  // The shape's current style, to highlight a preset that matches it.
  current: {
    fillColor?: string;
    strokeColor?: string;
    textColor?: string;
    strokeWidth?: BorderStroke;
    strokeStyle?: BorderStyle;
    borderRadius?: BorderRadius;
  };
  onApplyColor: (preset: ShapeColorPreset) => void;
  onApplyBorder: (preset: ShapeBorderPreset) => void;
  onReset: () => void;
}) {
  const eq = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
  return (
    <div className="px-2 py-1">
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">Colour</p>
      <div className="mb-1.5 grid grid-cols-4 gap-1">
        {colorPresets.map((p) => (
          <SizeButton
            key={p.name}
            active={
              eq(current.fillColor, p.fill) &&
              eq(current.strokeColor, p.stroke) &&
              eq(current.textColor, p.text)
            }
            onClick={() => onApplyColor(p)}
          >
            <PresetLabel name={p.name}>
              <ColorPresetSwatch preset={p} />
            </PresetLabel>
          </SizeButton>
        ))}
      </div>
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">Border</p>
      <div className="grid grid-cols-4 gap-1">
        {SHAPE_BORDER_PRESETS.map((p) => (
          <SizeButton
            key={p.name}
            active={
              (current.strokeWidth ?? 'medium') === p.stroke &&
              (current.strokeStyle ?? 'solid') === p.style &&
              (current.borderRadius ?? 'sm') === p.radius
            }
            onClick={() => onApplyBorder(p)}
          >
            <PresetLabel name={p.name}>
              <BorderPresetSwatch preset={p} />
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
  onReset,
}: {
  // The arrow's current style, to highlight a matching preset.
  current: { strokeStyle?: BorderStyle; flow?: ArrowFlow };
  onApply: (preset: ArrowPreset) => void;
  onReset: () => void;
}) {
  return (
    <div className="px-2 py-1.5">
      <div className="grid grid-cols-4 gap-1">
        {ARROW_PRESETS.map((p) => (
          <SizeButton
            key={p.name}
            active={(current.strokeStyle ?? 'solid') === p.style && current.flow === p.flow}
            onClick={() => onApply(p)}
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

// Shared "Reset to default" button beneath the preset grids.
function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <div className="px-0 pb-1 pt-1.5">
      <MenuActionButton label="Reset to default" onClick={onReset} />
    </div>
  );
}
