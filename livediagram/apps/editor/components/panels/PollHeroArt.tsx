// The Poll popover's hero art (docs/specs/012-collaboration/live-poll.md): the room's answers, counted. A grid fades
// in from the title's side; in the bottom right four bars rise from the band's edge, the tally so far, the leading
// one in the accent and bobbing twice as answers land, motion allowing, a question's bubble beside them. The title
// mark is a bar chart.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A tally: three bars on a baseline, in the accent. */
export const POLL_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 16.5h14M6 16.5v-5M10 16.5V4.5M14 16.5V8.5" />
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
      x="42"
      y="18"
      width="10"
      height="20"
      rx="3"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    <rect
      x="68"
      y="12"
      width="10"
      height="26"
      rx="3"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    <rect
      x="81"
      y="21"
      width="10"
      height="17"
      rx="3"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    <g className={HERO_MOTION.float}>
      <rect x="55" y="4" width="10" height="40" rx="3" fill="var(--hero-accent)" />
    </g>
    <path
      d="M10 9h20a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H19l-5 4v-4h-4a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    <path
      d="M17.5 15a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.8-1.1 1.6M20 22v.2"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const pollHeroArt: HeroArt = {
  name: 'poll',
  glyph: POLL_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
