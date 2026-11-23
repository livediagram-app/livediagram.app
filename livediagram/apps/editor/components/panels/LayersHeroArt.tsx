// The Layers popover's hero art (docs/specs/006-document/layers.md): the canvas as sheets, one over another. The
// canvas's dots fade in from the title's side; in the bottom right three sheets rise from the band's edge, stacked
// and seen from above their corner, the top one in the accent lifting off the stack twice, motion allowing. The
// title mark is the stack.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A stack of sheets seen from above their corner, in the accent. */
export const LAYERS_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 3l7 3.75-7 3.75-7-3.75z" />
    <path d="M3 10.25l7 3.75 7-3.75M3 13.75l7 3.75 7-3.75" />
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
    <path
      d="M58 20l30 9-30 9-30-9z"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    <path
      d="M58 13l30 9-30 9-30-9z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    <g className={HERO_MOTION.float}>
      <path d="M58 3l30 9-30 9-30-9z" fill="var(--hero-accent)" />
      <path
        d="M48 12l10-3 10 3"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export const layersHeroArt: HeroArt = {
  name: 'layers',
  glyph: LAYERS_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
