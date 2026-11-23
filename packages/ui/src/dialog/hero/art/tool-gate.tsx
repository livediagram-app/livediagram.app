// The Tools gate's hero art (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Always there"): a tool that
// opens once the person signs in or the item is synced. Rings spread from the bottom right, where an archway rises
// from the edge, a padlock in the accent hanging in it (its ring spreading twice), and beside it the way through: a
// cloud with an arrow rising into it, a dashed line leading to the arch. The title mark is a padlock.
// Every editor's Tools draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/tool-gate).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A padlock, in the accent. */
export const TOOL_GATE_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4.25" y="9" width="11.5" height="8" rx="2.25" />
    <path d="M7 9V6.8a3 3 0 0 1 6 0V9" />
    <path d="M10 12.6v1.2" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The way through: sync (the cloud), then on to the arch. */}
    <path
      d="M17 26.5a4.5 4.5 0 0 1 .6-9 6 6 0 0 1 11.5 1.2 4 4 0 0 1-.6 7.8Z"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    <path
      d="M23 24.2v-5M20.8 21.2l2.2-2.2 2.2 2.2"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M34 22h14"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeDasharray="3 3"
    />
    {/* The arch and what it keeps. */}
    <path d="M50 31V19a17 17 0 0 1 34 0v12Z" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <path d="M55 31V19a12 12 0 0 1 24 0v12Z" fill="var(--hero-soft)" stroke="var(--hero-line)" />
    <circle
      cx="67"
      cy="19.5"
      r="8"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <path
      d="M64 17v-2.2a3 3 0 0 1 6 0V17"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <rect x="61.5" y="16.5" width="11" height="8.5" rx="2.25" fill="var(--hero-accent)" />
    <circle cx="67" cy="20.75" r="1.3" fill="var(--hero-plate)" />
  </svg>
);

export const toolGateHeroArt: HeroArt = {
  name: 'tool-gate',
  glyph: TOOL_GATE_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
