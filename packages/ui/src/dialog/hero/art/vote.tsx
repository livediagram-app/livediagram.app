// The Vote popover's hero art (livediagram/docs/specs/012-collaboration/session-tools.md "The Session strip"): dots
// spent on what matters. A grid of dots fades in from the title's side; in the bottom right three cards rise from the
// band's edge at their own heights, each holding the dots cast on it, the tallest's in the accent with one more dot
// landing on it, its ring spreading twice, motion allowing. The title mark is a ballot's tick in a circle.
// livediagram's and liveplanner's Vote use it, so it lives here (@liveworkspace/ui/dialog-hero-art/vote).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A vote cast: a tick in a circle, in the accent. */
export const VOTE_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="10" cy="10" r="7" />
    <path d="M6.75 10.25l2.25 2.25 4.25-4.75" />
  </g>
);

// A card rising from the foot, top left at (x, y), 24 wide, with `dots` cast on it in `fill`.
function card(x: number, y: number, dots: number, fill: string) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width="24"
        height="34"
        rx="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect x={x + 4} y={y + 5} width="12" height="2.5" rx="1.25" fill="var(--hero-line)" />
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} cx={x + 6 + i * 6} cy={y + 14} r="2.25" fill={fill} />
      ))}
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
    {card(6, 16, 1, 'var(--hero-mark)')}
    {card(36, 5, 3, 'var(--hero-accent)')}
    {card(66, 12, 2, 'var(--hero-mark)')}
    <circle
      cx="60"
      cy="5"
      r="4.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="60" cy="5" r="4.5" fill="var(--hero-accent)" />
    <path
      d="M57.9 5.1l1.5 1.5 2.7-3"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const voteHeroArt: HeroArt = {
  name: 'vote',
  glyph: VOTE_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
