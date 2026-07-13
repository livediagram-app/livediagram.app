'use client';

// One-click style presets for the selected-element context menu (spec/48).
// Two surfaces:
//   - ShapePresets — theme-derived style looks in hierarchical tiers (theme /
//     emphasis ramp / border treatments / semantic status), each a complete
//     style: colour + a matching border weight and pattern (never the radius —
//     that's the user's own silhouette choice) + a reset.
//   - ArrowPresets — line looks in tiers (solid weights, patterns, animated
//     flows) + a reset.
// Purely presentational: every apply is a callback prop. Shape presets are
// theme-derived (passed in); arrow presets are the static table below. Lives in
// its own file so EditorContextMenu doesn't accrete more large categories
// inline (see the no-god-files principle).

import {
  ARROW_THICKNESS_PX,
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
// stroke-dasharray (16-unit units) for the dotted / dashed swatch outline.
function svgBorderDash(style: BorderStyle): string | undefined {
  if (style === 'dotted') return '0.6 2';
  if (style === 'solid') return undefined;
  return '3 2';
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
    // The bound preset id (spec/48), when the shape was styled from a preset —
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
  return (
    <div className="px-2 py-1">
      <div className="mb-1.5 grid grid-cols-4 gap-1">
        {colorPresets.map((p) => (
          <SizeButton
            key={p.id}
            active={
              // Bound by preset id when the shape carries one (tracks across
              // themes); otherwise fall back to an exact colour-triple match.
              current.colorPreset
                ? current.colorPreset === p.id
                : eq(current.fillColor, p.fill) &&
                  eq(current.strokeColor, p.stroke) &&
                  eq(current.textColor, p.text)
            }
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

// Shared "Reset to default" button beneath the preset grids.
function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <div className="px-0 pb-1 pt-1.5">
      <MenuActionButton label="Reset to default" onClick={onReset} />
    </div>
  );
}
