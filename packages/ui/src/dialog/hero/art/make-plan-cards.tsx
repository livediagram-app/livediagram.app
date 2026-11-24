// Make Plan Cards' hero art (livediagram/docs/specs/013-workspace/make-plan-cards.md "The preview"): shapes become
// cards. A faint grid fades in from the title's side; in the bottom right two shapes joined by an arrow stand on the
// left, and on the right two cards rise from the band's edge, an accent badge between them holding a plus, its ring
// spreading twice, motion allowing. The title mark is a shape with an arrow into a card.
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A square shape, an arrow, and a card with two lines, in the accent. */
export const MAKE_PLAN_CARDS_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="6.5" width="6" height="6" rx="1.2" />
    <path d="M8 9.5h3.5M10 8l1.5 1.5L10 11" />
    <rect x="12" y="3.5" width="6" height="13" rx="1.5" />
    <path d="M14 7h2M14 10h2" />
  </g>
);

// A card standing up from the band's foot, top left at (x, y), with a title bar and a line.
function card(x: number, y: number, fill: string) {
  return (
    <>
      <rect x={x} y={y} width="24" height="34" rx="3.5" fill={fill} stroke="var(--hero-line)" />
      <rect x={x + 4} y={y + 6} width="14" height="2.5" rx="1.25" fill="var(--hero-mark)" />
      <rect x={x + 4} y={y + 11} width="10" height="2.5" rx="1.25" fill="var(--hero-line)" />
    </>
  );
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="132"
    height="34"
    viewBox="0 0 132 34"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {/* The drawing: a diamond and a box joined by an arrow. */}
    <path
      d="M14 8l9 9-9 9-9-9Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    <rect
      x="34"
      y="10"
      width="16"
      height="14"
      rx="3"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    <path d="M24 17h8" stroke="var(--hero-mark)" strokeWidth="1.25" strokeLinecap="round" />
    <path
      d="M30 15l2 2-2 2"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The badge between the drawing and its cards. */}
    <path
      d="M54 17h12"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 3"
      strokeLinecap="round"
    />
    <circle
      cx="72"
      cy="17"
      r="7"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="72" cy="17" r="7" fill="var(--hero-accent)" />
    <path d="M72 14v6M69 17h6" stroke="var(--hero-plate)" strokeWidth="1.4" strokeLinecap="round" />
    {/* The cards, leaning a little. */}
    <g transform="rotate(-5 94 22)">{card(82, 6, 'var(--hero-plate)')}</g>
    <g transform="rotate(5 118 22)">{card(106, 8, 'var(--hero-wash)')}</g>
  </svg>
);

export const makePlanCardsHeroArt: HeroArt = {
  name: 'make-plan-cards',
  glyph: MAKE_PLAN_CARDS_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
