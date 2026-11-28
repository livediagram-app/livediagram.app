// Mark Blocked's hero art (docs/specs/026-plan/session-tabs.md "Stand-up", "Running it"), drawn in the dialog hero
// header's tokens: rings spreading from the bottom right, where the card sits with a flag planted on its corner and a
// bar across its path, its ring spreading once, motion allowing. The title mark is a flag.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
    data-blocked-art=""
  >
    {/* The card. */}
    <path
      d="M20 31V12a5 5 0 0 1 5-5h34a5 5 0 0 1 5 5v19Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="26" y="14" width="24" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.45" />
    <rect x="26" y="21" width="16" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.3" />
    {/* The bar across its way on. */}
    <path
      d="M67 20h12"
      stroke="var(--hero-line)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2 3"
    />
    <path d="M82 12v19" stroke="var(--hero-accent)" strokeWidth="2" strokeLinecap="round" />
    {/* The flag on its corner. */}
    <circle
      cx="21"
      cy="8"
      r="6.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="21" cy="8" r="6.5" fill="var(--hero-accent)" />
    <path
      d="M18.5 11.5v-7M18.5 5h5l-1.2 1.6 1.2 1.6h-5"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const blockedHeroArt: HeroArt = {
  name: 'session-blocked',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 17.5V3" />
      <path d="M5 3.5h9.5l-2 3 2 3H5" />
    </g>
  ),
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
