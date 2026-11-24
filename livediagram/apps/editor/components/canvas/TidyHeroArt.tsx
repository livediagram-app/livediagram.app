// The Tidy popover's hero art (docs/specs/008-canvas/layout-cleanup.md): a scattered tab put in order. A grid fades
// in from the title's side, the lines things snap to; in the bottom right two boxes lie askew, as they were, a
// dashed arrow leading from them to three standing in a row on one line, the accent's sparkle over them, its ring
// spreading twice, motion allowing. The title mark is a sparkle over aligned lines.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** Lines brought level under a sparkle, in the accent. */
export const TIDY_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 12h7M3.5 16h11" />
    <path d="M13.5 2.75l1.1 2.65 2.65 1.1-2.65 1.1-1.1 2.65-1.1-2.65-2.65-1.1 2.65-1.1z" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    <rect
      x="4"
      y="17"
      width="13"
      height="10"
      rx="2.5"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
      transform="rotate(-14 10 22)"
    />
    <rect
      x="15"
      y="8"
      width="11"
      height="8"
      rx="2.5"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
      transform="rotate(11 20 12)"
    />
    <path
      d="M29 19h10M36 16l3 3-3 3"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="2.5 2.5"
    />
    <path d="M44 27.5h50" stroke="var(--hero-line)" strokeDasharray="3 3" />
    <rect
      x="46"
      y="15"
      width="13"
      height="12"
      rx="2.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect
      x="63"
      y="15"
      width="13"
      height="12"
      rx="2.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect
      x="80"
      y="15"
      width="13"
      height="12"
      rx="2.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <circle
      cx="69.5"
      cy="6"
      r="5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <path d="M69.5 0.5l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="var(--hero-accent)" />
  </svg>
);

export const tidyHeroArt: HeroArt = {
  name: 'tidy',
  glyph: TIDY_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
