// Live miniatures for the animation sets that predate the per-kind sets: icon glyph
// motion (docs/specs/028-animation/element-animations.md
// "The menu"). Each renders the canvas's own renderer (or its own classes) at tile size, so a tile
// shows exactly what picking it does; AnimationPreviewTile freezes it and plays it on hover.

import type { IconAnimation } from '@livehuddle/document';
import { IconGlyph } from '@/components/primitives/icon-glyph';
import { BRAND_RAMP } from '@livehuddle/ui';

// The tiles' own art wears the app's brand (brand-500), as the palette around them does.
const ACCENT = BRAND_RAMP[500];
// Icon motions that move the glyph: they rest over a faint ghost of where it started.
const ICON_MOVES = new Set<IconAnimation>([
  'spin',
  'bounce',
  'wiggle',
  'tada',
  'flip',
  'jump',
  'swing',
  'float',
]);

/** A line-art star wearing the icon animation. */
export function IconAnimationPreview({ animation }: { animation: IconAnimation | null }) {
  return (
    <span className="relative block h-[24px] w-[24px]" style={{ color: ACCENT }}>
      {animation && ICON_MOVES.has(animation) ? (
        <span className="absolute inset-0 opacity-25">
          <IconGlyph iconId="star" stroke="currentColor" />
        </span>
      ) : null}
      <IconGlyph
        iconId="star"
        stroke="currentColor"
        animation={animation ?? undefined}
        animationSpeed="normal"
      />
    </span>
  );
}
