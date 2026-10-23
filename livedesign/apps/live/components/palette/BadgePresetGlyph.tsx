'use client';

// A badge preset's palette tile drawn as the badge it adds (docs/specs/009-elements/badge.md "Badge presets"): its
// own text in its own look and colours, so the tile is what lands on the canvas. The colours are the canvas's
// (chipColours over the tab theme's element colours, else the Default theme's), and a preset's own colour (the
// Warning's rose) wins, as on the canvas.
import { chipColours, type ChipLook } from '@livedesign/design';
import { usePaletteTint } from './PaletteIconButton';

// A fresh shape's colours on the Default theme, as the canvas draws one (its stroke, fill and label ink).
const DEFAULT_ACCENT = '#0ea5e9';
const DEFAULT_SURFACE = '#f0f9ff';
const DEFAULT_INK = '#075985';

// The tile's drawing box: a pill as wide as the tile's icon slot, half as tall.
const W = 48;
const H = 24;
const INSET = 1;

export function BadgePresetGlyph({
  label,
  look,
  accent,
}: {
  label: string;
  look: ChipLook;
  // The preset's own colour (the Warning's rose); absent, the theme's.
  accent?: string;
}) {
  const tint = usePaletteTint();
  const badgeTint = tint?.shapeColors?.badge;
  const c = chipColours(look, {
    accent: accent ?? badgeTint?.stroke ?? tint?.stroke ?? DEFAULT_ACCENT,
    surface: badgeTint?.fill ?? tint?.fill ?? DEFAULT_SURFACE,
    ink: tint?.text ?? DEFAULT_INK,
  });
  const rx = (H - INSET * 2) / 2;
  const pill = { x: INSET, y: INSET, width: W - INSET * 2, height: H - INSET * 2, rx };
  return (
    <svg
      aria-hidden
      data-badge-glyph={look}
      width={30}
      height={15}
      viewBox={`0 0 ${W} ${H}`}
      className="block"
    >
      {c.base ? <rect {...pill} fill={c.base} /> : null}
      <rect {...pill} fill={c.fill} stroke={c.border ?? 'none'} strokeWidth={c.border ? 2 : 0} />
      <text
        x={W / 2}
        y={H / 2}
        fill={c.text}
        fillOpacity={c.textOpacity}
        fontSize={13}
        fontWeight={700}
        fontFamily="system-ui, sans-serif"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {label}
      </text>
    </svg>
  );
}
