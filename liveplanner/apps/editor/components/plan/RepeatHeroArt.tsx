// Repeat's hero art (docs/specs/026-plan/items.md, a card's Repeat: a fresh copy of the card on each day its rule
// names), drawn in the dialog hero header's tokens: rings spreading from the bottom right, time going round; and
// there three cards rising off the band's foot in a row, the card and its copies: an arrow in the accent arching from
// the first to the second, a dashed one on to the third, the copy still to come, which is dashed itself and bobs
// twice, motion allowing. No centre piece. The title mark is the repeat's two arrows going round.
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

const ARC = {
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const PIECES = (
  // The card, its copy, and the copy still to come.
  <svg
    {...HERO_SVG}
    width="92"
    height="30"
    viewBox="0 0 92 30"
    className={HERO_PLACE.bottomRight}
    data-repeat-copies=""
  >
    {[4, 34].map((x) => (
      <g key={x}>
        <rect
          x={x}
          y="13"
          width="24"
          height="24"
          rx="4.5"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <path d={`M${x + 5} 20h9M${x + 5} 25.5h14`} {...LINES} />
      </g>
    ))}
    {/* The copy to come. */}
    <g className={HERO_MOTION.float}>
      <rect
        x="64"
        y="13"
        width="24"
        height="24"
        rx="4.5"
        fill="var(--hero-soft)"
        stroke="var(--hero-mark)"
        strokeDasharray="3 3"
      />
      <path d="M69 20h9M69 25.5h14" {...LINES} />
    </g>
    {/* Made again: an arrow from the card to its copy, a dashed one on to the next. */}
    <path d="M16 9.5C21 1.5 41 1.5 46 9.5" {...ARC} stroke="var(--hero-accent)" />
    <path d="M41.6 8.4l4.4 1.1 1.1-4.4" {...ARC} stroke="var(--hero-accent)" />
    <path
      d="M50 6.2C56 2 70 2.5 76 9.5"
      {...ARC}
      stroke="var(--hero-mark)"
      strokeDasharray="2.5 3"
    />
  </svg>
);

export const repeatHeroArt: HeroArt = {
  name: 'repeat',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2.5l3 3-3 3M3 9.5v-1a3 3 0 0 1 3-3h11" />
      <path d="M6 17.5l-3-3 3-3M17 10.5v1a3 3 0 0 1-3 3H3" />
    </g>
  ),
  texture: heroTexture('rings'),
  pieces: PIECES,
};
