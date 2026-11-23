// Flatten Image's hero art (docs/specs/031-photo/photo-layers.md "Layer operations" Flatten), drawn in the dialog
// hero header's tokens: the baseline grid fading out toward the title, everything ruled level; and in the bottom
// right three layers stacked one over another, a dashed arrow, and the one layer they become, outlined in the
// accent, settling twice onto the dashed place it will lie, motion allowing. The title mark is a layer over two
// more.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// A layer seen from above and to one side: a flat diamond about (cx, cy).
const layer = (cx: number, cy: number) =>
  `M${cx - 17} ${cy}L${cx} ${cy - 5.5}L${cx + 17} ${cy}L${cx} ${cy + 5.5}Z`;

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={HERO_PLACE.bottomRight}
    data-photo-flatten-art=""
  >
    <g stroke="var(--hero-line)" strokeLinejoin="round">
      <path d={layer(20, 22.5)} fill="var(--hero-wash)" />
      <path d={layer(20, 15.5)} fill="var(--hero-soft)" />
      <path d={layer(20, 8.5)} fill="var(--hero-plate)" stroke="var(--hero-mark)" />
    </g>
    {/* Into one. */}
    <g
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M42 15.5h9" strokeDasharray="2.5 2.5" />
      <path d="M49.5 12.5l3.5 3-3.5 3" />
    </g>
    <path
      d={layer(75, 22.5)}
      fill="none"
      stroke="var(--hero-line)"
      strokeDasharray="3 2.5"
      strokeLinejoin="round"
    />
    <path
      d={layer(75, 17)}
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinejoin="round"
      className={HERO_MOTION.float}
    />
  </svg>
);

export const photoFlattenHeroArt: HeroArt = {
  name: 'photo-flatten',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3l7 3.75-7 3.75-7-3.75z" fill="var(--hero-wash)" />
      <path d="M3.5 10.5l6.5 3.5 6.5-3.5" />
      <path d="M3.5 14l6.5 3.5 6.5-3.5" opacity="0.6" />
    </g>
  ),
  texture: heroTexture('baseline'),
  pieces: PIECES,
};
