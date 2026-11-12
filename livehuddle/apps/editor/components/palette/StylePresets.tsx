'use client';

// One-click style presets for the selected-element context menu (docs/specs/010-palette/style-presets.md):
//   - ShapePresets: theme-derived style looks in hierarchical tiers (theme /
//     neutral / border treatments / semantic status), each a complete style:
//     colour + a matching border weight and pattern (never the radius:
//     that's the user's own silhouette choice) + a reset.
// Purely presentational: every apply is a callback prop. Shape presets are
// theme-derived (passed in). The tile label, the swatch outline's weights and dashes and the
// reset are the shared presets' (@liveworkspace/workbench/components/palette/StylePresets); this
// editor's swatch is a plain box rather than the selected shape's silhouette.

import type { ShapeColorPreset } from '@/lib/themes';
import { SizeButton } from '@/components/palette/palette-controls';
import { ShapeGlyph } from '@/components/primitives/shape-icon';
import {
  onMouseHover,
  useRevertOnUnmount,
} from '@liveworkspace/workbench/components/primitives/hover-preview';
import {
  BORDER_WIDTH_SVG,
  PresetLabel,
  ResetButton,
  svgBorderDash,
} from '@liveworkspace/workbench/components/palette/StylePresets';

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
