'use client';

// One-click style presets for the selected-element context menu (docs/specs/010-palette/style-presets.md):
//   - ShapePresets: theme-derived style looks in hierarchical tiers (theme /
//     neutral / border treatments / semantic status), each a complete style:
//     colour + a matching border weight and pattern (never the radius:
//     that's the user's own silhouette choice) + a reset.
// Purely presentational: every apply is a callback prop. Shape presets are
// theme-derived (passed in). Lives in
// its own file so EditorContextMenu doesn't accrete more large categories
// inline (see the no-god-files principle).

import { type BorderStyle, type BorderStroke } from '@livehuddle/document';
import type { ShapeColorPreset } from '@/lib/themes';
import { SizeButton } from '@/components/palette/palette-controls';
import { MenuActionButton } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { ShapeGlyph } from '@/components/primitives/shape-icon';
import {
  onMouseHover,
  useRevertOnUnmount,
} from '@liveworkspace/workbench/components/primitives/hover-preview';

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
// ── Tiles ───────────────────────────────────────────────────────────────

function PresetLabel({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      {children}
      <span className="text-[9px] capitalize leading-none">{name}</span>
    </span>
  );
}

// The colour swatch: a box filled with the preset fill + stroked with its
// border colour, an "A" in the text colour overlaid for the label.
function ColorPresetSwatch({ preset }: { preset: ShapeColorPreset }) {
  return (
    <span className="relative flex h-5 w-7 items-center justify-center" aria-hidden>
      <ShapeGlyph
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
  colorPresets,
  current,
  onApplyColor,
  onPreviewColor,
  onPreviewEnd,
  onReset,
}: {
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
              <ColorPresetSwatch preset={p} />
            </PresetLabel>
          </SizeButton>
        ))}
      </div>
      <ResetButton onReset={onReset} />
    </div>
  );
}

// Shared "Reset to Default" button beneath the preset grids.
function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <div className="px-0 pb-1 pt-1.5">
      <MenuActionButton label="Reset to Default" onClick={onReset} />
    </div>
  );
}
