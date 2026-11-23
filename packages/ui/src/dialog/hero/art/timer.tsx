// The Timer popover's hero art (livediagram/docs/specs/012-collaboration/session-tools.md "The Session strip"): time
// kept for the room. Rings spread from the bottom right, where a stopwatch's dial rises from the band's edge, its
// ticks around it and its hand, in the accent, a quarter round; beside it a chip with the time left, its dot's ring
// spreading twice, motion allowing. The title mark is a stopwatch.
// livediagram's and liveplanner's Timer use it, so it lives here (@liveworkspace/ui/dialog-hero-art/timer).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A stopwatch: its dial, its crown and its hand, in the accent. */
export const TIMER_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="10" cy="11.5" r="6" />
    <path d="M8 2.75h4M10 2.75V5.5M10 8.5v3l2 1.5" />
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
    <circle cx="70" cy="27" r="19" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <path
      d="M70 11.5v3M56.6 19.25l2.6 1.5M83.4 19.25l-2.6 1.5M54.5 27h3M85.5 27h-3"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path d="M70 27V16.5" stroke="var(--hero-accent)" strokeWidth="2" strokeLinecap="round" />
    <path d="M70 27l7.5-4.5" stroke="var(--hero-mark)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="70" cy="27" r="2.25" fill="var(--hero-accent)" />
    <rect
      x="6"
      y="13"
      width="38"
      height="24"
      rx="6"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
    />
    <circle
      cx="15"
      cy="22"
      r="3.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="15" cy="22" r="3.5" fill="var(--hero-accent)" />
    <rect x="23" y="20.25" width="6" height="3.5" rx="1.75" fill="var(--hero-mark)" />
    <rect x="32" y="20.25" width="7" height="3.5" rx="1.75" fill="var(--hero-mark)" />
  </svg>
);

export const timerHeroArt: HeroArt = {
  name: 'timer',
  glyph: TIMER_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
