// Rotate's hero art (docs/specs/031-photo/photo-pages.md "Changing the size"), drawn in the dialog hero header's
// tokens: rings spreading from the bottom right, the sweep of a turn; and there the photo turned clockwise about
// its centre over the dashed outline of where it stood, an arrow in the accent arcing round its corner. The
// centre it turns about is a dot in the accent whose ring spreads twice, motion allowing. The title mark is an
// arrow turning clockwise.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';
import { heroShot } from './photo-hero-shot';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={HERO_PLACE.bottomRight}
    data-photo-rotate-art=""
  >
    {/* Where it stood. */}
    <rect
      x="30"
      y="8"
      width="40"
      height="26"
      rx="3"
      fill="none"
      stroke="var(--hero-mark)"
      strokeDasharray="4 3"
    />
    <g transform="rotate(14 50 21)">{heroShot(30, 8, 40, 26)}</g>
    {/* The turn. */}
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M71.4 3A28 28 0 0 1 78 21" />
      <path d="M75.1 16.9L78 21L80.9 16.9" />
    </g>
    <circle
      cx="50"
      cy="21"
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="50" cy="21" r="2.5" fill="var(--hero-accent)" />
  </svg>
);

export const photoRotateHeroArt: HeroArt = {
  name: 'photo-rotate',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 10a6 6 0 1 1-1.76-4.24L16 7.5" />
      <path d="M16 3.5v4h-4" />
    </g>
  ),
  texture: heroTexture('rings'),
  pieces: PIECES,
};
