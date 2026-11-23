// Select and Mask's hero art (docs/specs/031-photo/photo-tools.md "Smart selections" Refining), drawn in the
// dialog hero header's tokens: a faint grid fading out toward the title; and in the bottom right the subject cut
// out over the checkerboard, a head and shoulders rising off the band's foot with the selection's dashed edge
// round them in the accent. Loose strands of hair stray past the edge, and over them is the Refine Edge brush, a
// ring in the accent spreading twice, motion allowing. The title mark is a mask: a frame with the shape cut from
// it.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// The checkerboard behind the cut-out: 8px squares over a 72 x 32 plate at (4, 3), every other one shaded.
const CHECKS = [0, 1, 2, 3].flatMap((row) =>
  [0, 1, 2, 3, 4, 5, 6, 7, 8]
    .filter((col) => (row + col) % 2 === 1)
    .map((col) => ({ x: 4 + col * 8, y: 3 + row * 8 })),
);

const SHOULDERS = 'M22 34C22 25 30 21.5 40 21.5C50 21.5 58 25 58 34Z';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="80"
    height="30"
    viewBox="0 0 80 30"
    className={HERO_PLACE.bottomRight}
    data-select-and-mask-art=""
  >
    <rect x="4" y="3" width="72" height="32" rx="3" fill="var(--hero-plate)" />
    {CHECKS.map(({ x, y }) => (
      <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" fill="var(--hero-soft)" />
    ))}
    <rect x="4" y="3" width="72" height="32" rx="3" fill="none" stroke="var(--hero-line)" />
    {/* The subject, and the selection's edge round it. */}
    <g fill="var(--hero-line)">
      <path d={SHOULDERS} />
      <circle cx="40" cy="13" r="7" />
    </g>
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
    >
      <path d={SHOULDERS} />
      <circle cx="40" cy="13" r="7" />
    </g>
    {/* The hair the edge missed, and the brush over it. */}
    <path
      d="M45.5 7.5l4.5-3.5M46.8 10.2l5.7-2.4M47 13.2h5.5"
      fill="none"
      stroke="var(--hero-mark)"
      strokeLinecap="round"
    />
    <circle
      cx="50.5"
      cy="9"
      r="6"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
  </svg>
);

export const selectAndMaskHeroArt: HeroArt = {
  name: 'select-and-mask',
  glyph: (
    <g stroke="var(--hero-accent)" strokeLinejoin="round">
      <rect
        x="2.5"
        y="3.5"
        width="15"
        height="13"
        rx="2.5"
        fill="var(--hero-wash)"
        strokeWidth="1.7"
      />
      <circle
        cx="10"
        cy="10"
        r="3.4"
        fill="var(--hero-paper)"
        strokeWidth="1.4"
        strokeDasharray="2.2 1.8"
        strokeLinecap="round"
      />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
