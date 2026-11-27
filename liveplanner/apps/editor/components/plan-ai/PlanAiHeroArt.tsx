// Plan AI's hero art (docs/specs/026-plan/plan-ai.md "The panel"): asked and done. A grid fades in from the title's
// side; in the bottom right a card lifts from the band's edge with a tick on it, three lines of a request beside it, and
// the accent's sparkle over its corner, bobbing twice, motion allowing. The title mark is a sparkle.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A four-pointed sparkle with a small one beside it, in the accent. */
export const PLAN_AI_GLYPH = (
  <g fill="var(--hero-accent)">
    <path d="M9 2.5c.4 2.9 1.6 4.1 4.5 4.5-2.9.4-4.1 1.6-4.5 4.5-.4-2.9-1.6-4.1-4.5-4.5 2.9-.4 4.1-1.6 4.5-4.5z" />
    <path d="M14.5 11c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5z" />
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
    <rect x="8" y="12" width="26" height="2.5" rx="1.25" fill="var(--hero-mark)" />
    <rect x="12" y="18" width="22" height="2" rx="1" fill="var(--hero-line)" />
    <rect x="16" y="23" width="18" height="2" rx="1" fill="var(--hero-line)" />
    <g transform="rotate(-6 62 18)">
      <rect
        x="44"
        y="6"
        width="36"
        height="30"
        rx="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect x="50" y="12" width="14" height="2.5" rx="1.25" fill="var(--hero-mark)" />
      <rect x="50" y="18" width="22" height="2" rx="1" fill="var(--hero-line)" />
      <circle cx="70" cy="27" r="4.5" fill="var(--hero-soft)" stroke="var(--hero-line)" />
      <path
        d="M68 27l1.4 1.4 2.6-2.8"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <g className={HERO_MOTION.float}>
      <path
        d="M82 -2c.5 3.6 2 5.1 5.6 5.6-3.6.5-5.1 2-5.6 5.6-.5-3.6-2-5.1-5.6-5.6 3.6-.5 5.1-2 5.6-5.6z"
        fill="var(--hero-accent)"
      />
    </g>
  </svg>
);

export const planAiHeroArt: HeroArt = {
  name: 'plan-ai',
  glyph: PLAN_AI_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
