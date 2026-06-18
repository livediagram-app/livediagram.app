'use client';

// One-click style presets for the selected-element context menu (spec/48).
// ShapePresets renders eight theme-derived colour looks + up to eight border
// looks (weight × pattern × radius) + a reset, combined freely. Purely
// presentational: every apply is a callback prop. Colour presets are
// theme-derived (passed in); border presets are the static table below. Lives
// in its own file so EditorContextMenu doesn't accrete a third large category
// inline (see the no-god-files principle).

import type { BorderRadius, BorderStyle, BorderStroke } from '@livediagram/diagram';
import type { ShapeColorPreset } from '@/lib/themes';
import { SizeButton } from '@/components/palette-controls';

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
// CSS border-style for the preview. dash-dot / long-dash / dash-dot-dot have
// no native CSS equivalent, so they fall back to dashed (the shape presets
// only use solid / dotted / dashed anyway).
function cssBorderStyle(style: BorderStyle): string {
  if (style === 'dotted') return 'dotted';
  if (style === 'solid') return 'solid';
  return 'dashed';
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
        borderStyle: cssBorderStyle(preset.style),
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
      <div className="px-0 pb-1 pt-1.5">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}
