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

import type { AnimationSpeed, IconAnimation } from '@livediagram/diagram';

import { iconAnimationClass, iconAnimationSpeedStyle } from '@/lib/icons';
import { getTechIcon } from '@/lib/tech-icons';

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
  const icon = getTechIcon(iconId);
  if (!icon) return null;
  return (
    <>
      <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill={icon.color} />
      {/* The glyph markup is our own authored SVG from the catalogue, not
          user content — safe to inject. */}
      <g {...GLYPH_GROUP} dangerouslySetInnerHTML={{ __html: icon.glyph }} />
    </>
  );
}

// Full-box brand-icon overlay for a shape==='icon' element whose id is a
// tech icon. When the icon carries a label the art is pinned to the TOP of
// a taller viewBox (0..24 art in a 0..24..40 box ≈ top 60%) so the
// bottom-aligned label drops into a clear band beneath it — the same
// label-room trick IconGlyph uses, so coloured and line-art icons caption
// identically.
export function TechIconGlyph({
  iconId,
  hasLabel = false,
  animation,
  animationSpeed,
}: {
  iconId: string | undefined;
  hasLabel?: boolean;
  // Per-icon looping animation (spec/09); undefined = static. Wraps the whole
  // tile + glyph so a brand mark spins / beats as one.
  animation?: IconAnimation;
  // Loop speed for the animation (slow / normal / fast); undefined = normal.
  animationSpeed?: AnimationSpeed;
}) {
  const animClass = iconAnimationClass(animation);
  // With a label, pin the art to the TOP ~62% band (leaving the bottom for the
  // bottom-aligned label) rather than letterboxing a tall viewBox across the
  // whole box — the latter scaled the icon only by height, so widening the
  // element left the icon the same size. A percentage-height band scales with
  // the element in both axes.
  return (
    <svg
      className={`pointer-events-none absolute overflow-visible ${
        hasLabel ? 'inset-x-0 top-[6%] h-[58%] w-full' : 'inset-0 h-full w-full'
      }`}
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {animClass ? (
        <g className={animClass} style={iconAnimationSpeedStyle(animationSpeed)}>
          <TechIconArt iconId={iconId} />
        </g>
      ) : (
        <TechIconArt iconId={iconId} />
      )}
    </svg>
  );
}
