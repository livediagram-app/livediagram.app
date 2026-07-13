// Renders a Technology (brand) icon: a brand-coloured rounded tile + the
// icon's white line-art glyph (spec/41). Shared by the canvas element
// (BoxedElementView, for shape==='icon' when the id is a tech icon) and the
// palette Technology picker so the on-canvas mark and the picker thumbnail
// can't drift.
//
// Unlike IconGlyph (single-colour line art tinted by the element's stroke
// colour), a brand mark carries FIXED colours and is never recoloured. So
// this paints the tile fill from the catalogue and the glyph in white,
// ignoring the element's stroke colour entirely.

import {
  DEFAULT_ICON_SIZE,
  ICON_SIZE_PX,
  type AnimationSpeed,
  type IconAnimation,
  type IconSize,
  type TextAlignX,
  type TextAlignY,
} from '@livediagram/diagram';

import { iconAnimationClass, iconAnimationStyle } from '@/lib/icons';
import { getTechIcon, isTechIconId } from '@/lib/tech-icons';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { iconBandClass } from '@/components/primitives/icon-band';

// The white line-art group the glyph markup sits in. A bare path/circle in
// the markup strokes white; a filled mark sets fill="#fff" stroke="none"
// itself. non-scaling-stroke keeps the glyph weight crisp at any element
// size — matching the line-art icons.
const GLYPH_GROUP = {
  fill: 'none',
  stroke: '#fff',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

// The tile + glyph in a 0..24 coordinate space, with no outer <svg>. The
// caller owns the <svg> + viewBox so the same art renders at catalogue
// thumbnail size and at element size.
export function TechIconArt({ iconId }: { iconId: string | undefined }) {
  // The colour/glyph data lives in the async catalogue chunk
  // (lib/icon-registry.ts); subscribe so the brand mark pops in the moment it
  // lands (and kick the load if this is the first icon surface to mount).
  const catalogsLoaded = useIconCatalogs();
  const icon = getTechIcon(iconId);
  if (!icon) {
    // `isTechIconId` answers from a lightweight id set that is always in the
    // first-load bundle, so we can tell the two undefined cases apart: a KNOWN
    // tech id whose data is still in flight gets a muted skeleton tile (the
    // same rounded-square silhouette as the real mark, so nothing jumps when
    // the brand colours arrive); a genuinely unknown id stays null, leaving
    // the caller's line-art-placeholder fallback in charge, exactly as before.
    return !catalogsLoaded && isTechIconId(iconId) ? (
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="4.5"
        className="fill-slate-300 dark:fill-slate-600"
      />
    ) : null;
  }
  return (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill={icon.color} />
      {/* The glyph markup is our own authored SVG from the catalogue, not
          user content — safe to inject. */}
      <g {...GLYPH_GROUP} dangerouslySetInnerHTML={{ __html: icon.glyph }} />
    </>
  );
}

// Brand-icon overlay for a shape==='icon' element whose id is a tech icon.
// The mark renders at a FIXED pixel size (spec/41): `size` is the element's
// `iconSize` preset (default 'md' = 48px), so resizing the element gives
// the caption room without inflating the chip; the tile clamps to the box
// via max-width/height when the box is smaller than the preset. When the
// icon carries a label the mark centres in the band OPPOSITE the label's
// vertical alignment — bottom-aligned caption (the default) puts the mark
// in the top ~64%, a top- or middle-aligned label sends it to the bottom
// band — so moving the text never stacks it over the mark. With no label
// it centres in the whole box.
export function TechIconGlyph({
  iconId,
  hasLabel = false,
  size,
  labelAlignX = 'center',
  labelAlignY = 'bottom',
  animation,
  animationSpeed,
  animationRepeat,
}: {
  iconId: string | undefined;
  hasLabel?: boolean;
  // Fixed tile size preset (spec/41); undefined = the default ('md').
  size?: IconSize;
  // The label's alignment; the mark takes the opposite band (see
  // techIconMarkBounds, whose numbers these CSS bands mirror).
  labelAlignX?: TextAlignX;
  labelAlignY?: TextAlignY;
  // Per-icon looping animation (spec/09); undefined = static. Wraps the whole
  // tile + glyph so a brand mark spins / beats as one.
  animation?: IconAnimation;
  // Loop speed for the animation; undefined = the shared 'slow' default.
  animationSpeed?: AnimationSpeed;
  // false = play the animation once and hold; undefined / true loops.
  animationRepeat?: boolean;
}) {
  const animClass = iconAnimationClass(animation);
  const px = ICON_SIZE_PX[size ?? DEFAULT_ICON_SIZE];
  const band = iconBandClass(labelAlignX, labelAlignY);
  return (
    <div
      className={`pointer-events-none absolute flex items-center justify-center ${
        hasLabel ? band : 'inset-0'
      }`}
      aria-hidden
    >
      <svg
        className="overflow-visible"
        style={{ width: px, height: px, maxWidth: '100%', maxHeight: '100%' }}
        viewBox="0 0 24 24"
        preserveAspectRatio="xMidYMid meet"
      >
        {animClass ? (
          <g className={animClass} style={iconAnimationStyle(animationSpeed, animationRepeat)}>
            <TechIconArt iconId={iconId} />
          </g>
        ) : (
          <TechIconArt iconId={iconId} />
        )}
      </svg>
    </div>
  );
}
