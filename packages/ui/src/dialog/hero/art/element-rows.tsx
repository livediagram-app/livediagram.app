// The rows dialog's hero art (each product's docs/specs/008-canvas/canvas-and-palette.md "A category that opens a
// dialog"): an element's rows, added, removed and put in order. Dots fade in from the title's side; in the bottom
// right a stack of three rows rises from the edge, the middle one in the accent lifted out of line on its way up,
// bobbing twice, an arrow at its side showing the way. The title mark is three rows with arrows up and down.
// Worn by the rows of a stat row, a process, a header's links, a concept graphic and a card's tags, in every app,
// so it lives here (@liveworkspace/ui/dialog-hero-art/element-rows).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const PIECES = (
  <svg {...HERO_SVG} width="84" height="30" viewBox="0 0 84 30" className={HERO_PLACE.bottomRight}>
    <rect
      x="1"
      y="3"
      width="62"
      height="9"
      rx="3"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="6" y="6" width="22" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.5" />
    <rect
      x="1"
      y="25"
      width="62"
      height="9"
      rx="3"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="6" y="28" width="30" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.5" />
    {/* The row on the move. */}
    <g className={HERO_MOTION.float}>
      <rect x="9" y="13" width="62" height="9" rx="3" fill="var(--hero-accent)" />
      <rect x="14" y="16" width="26" height="3" rx="1.5" fill="var(--hero-plate)" />
    </g>
    <path
      d="M78 22V9m0 0-3.5 3.5M78 9l3.5 3.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const elementRowsHeroArt: HeroArt = {
  name: 'element-rows',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5.5h8M3 10h8M3 14.5h8" />
      <path
        d="M15.5 8.5V4.5m0 0-1.8 1.8m1.8-1.8 1.8 1.8M15.5 11.5v4m0 0-1.8-1.8m1.8 1.8 1.8-1.8"
        strokeWidth="1.4"
      />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
