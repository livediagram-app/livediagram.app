// The Card Types popover's hero art (docs/specs/026-plan/item-types.md "The Card Types panel"): the kinds of card a
// plan holds. A grid of dots fades in from the title's side; in the bottom right three cards rise from the band's
// edge, fanned, each led by its type's tile (a square, a diamond, a circle), the one in front holding the accent's
// tile and bobbing twice, motion allowing. The title mark is a card with its type's tile.
import type { ReactNode } from 'react';
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A card led by its type's tile, in the accent. */
export const CARD_TYPES_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.75" y="4" width="14.5" height="12" rx="2.25" />
    <rect x="5.75" y="7" width="3.5" height="3.5" rx="0.75" />
    <path d="M12 8.75h2.5M5.75 13.25h8.75" />
  </g>
);

// A card rising from the foot, top left at (x, y), 30 wide, led by its type's `tile`.
function card(x: number, y: number, tile: ReactNode) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width="30"
        height="36"
        rx="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      {tile}
      <rect x={x + 14} y={y + 6} width="11" height="2.5" rx="1.25" fill="var(--hero-mark)" />
      <rect x={x + 5} y={y + 15} width="20" height="2" rx="1" fill="var(--hero-line)" />
      <rect x={x + 5} y={y + 19.5} width="14" height="2" rx="1" fill="var(--hero-line)" />
    </>
  );
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    <g transform="rotate(-8 20 24)">
      {card(4, 12, <rect x="9" y="16" width="6.5" height="6.5" rx="1.5" fill="var(--hero-mark)" />)}
    </g>
    <g transform="rotate(8 78 24)">
      {card(62, 12, <circle cx="70.25" cy="19.25" r="3.25" fill="var(--hero-mark)" />)}
    </g>
    <g className={HERO_MOTION.float}>
      {card(33, 5, <path d="M41.25 8.5l3.5 3.75-3.5 3.75-3.5-3.75z" fill="var(--hero-accent)" />)}
    </g>
  </svg>
);

export const cardTypesHeroArt: HeroArt = {
  name: 'card-types',
  glyph: CARD_TYPES_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
