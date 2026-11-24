// The card picker's hero art (docs/specs/026-plan/items.md "Where it shows", item-types.md "Link Existing"), worn by
// Add Thread to Card and Link Existing Card, drawn in the dialog hero header's tokens: a grid of dots fading out toward
// the title, so the words sit on plain paper; and in the bottom right a row of three cards rising off the band's
// foot, the middle one picked: taller, edged in the accent, a tick badge on its corner, lifting out of the row twice,
// motion allowing. No centre piece. The title mark is a card with a pointer on it.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const LINES = {
  fill: 'none',
  stroke: 'var(--hero-line)',
  strokeWidth: 2,
  strokeLinecap: 'round',
} as const;

const PIECES = (
  // Three cards in a row, the middle one picked.
  <svg
    {...HERO_SVG}
    width="88"
    height="30"
    viewBox="0 0 88 30"
    className={HERO_PLACE.bottomRight}
    data-card-picker-row=""
  >
    {[2, 62].map((x) => (
      <g key={x}>
        <rect
          x={x}
          y="15"
          width="24"
          height="22"
          rx="4.5"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <path d={`M${x + 5} 21.5h9M${x + 5} 26.5h14`} {...LINES} />
      </g>
    ))}
    <g className={HERO_MOTION.float}>
      <rect
        x="30"
        y="9"
        width="28"
        height="30"
        rx="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
      />
      <path d="M35.5 16.5h10M35.5 22h17M35.5 27.5h13" {...LINES} stroke="var(--hero-mark)" />
      <circle cx="56" cy="10.5" r="5.5" fill="var(--hero-accent)" />
      <path
        d="M53.4 10.6l1.9 1.9 3.3-3.8"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export const cardPickerHeroArt: HeroArt = {
  name: 'card-picker',
  glyph: (
    <>
      <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.75" strokeLinecap="round">
        <rect x="2.5" y="3" width="13" height="10.5" rx="2.75" />
        <path d="M5.75 7h4.5" />
      </g>
      {/* The pointer, edged in the tile's wash so it stands off the card's corner. */}
      <path
        d="M10.5 9.5l7.5 3-3.1 1.3-1.3 3.2Z"
        fill="var(--hero-accent)"
        stroke="var(--hero-wash)"
        strokeLinejoin="round"
      />
    </>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
