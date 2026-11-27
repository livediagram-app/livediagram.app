// Close Bug's hero art (docs/specs/026-plan/session-tabs.md "Bug Triage", "Closing a bug"), drawn in the dialog hero
// header's tokens: rings spreading from the bottom right, where the closed card sits, its line struck through and a
// cross on its corner, joined by a dashed link to the card it may duplicate, whose ring spreads twice, motion
// allowing. The title mark is a circle with a cross.
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
    data-close-art=""
  >
    {/* The closed card: its line struck through. */}
    <path
      d="M8 31V12a5 5 0 0 1 5-5h28a5 5 0 0 1 5 5v19Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="14" y="14" width="22" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.45" />
    <rect x="14" y="21" width="15" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.3" />
    <path d="M12 15.5h28" stroke="var(--hero-accent)" strokeWidth="1.5" strokeLinecap="round" />
    {/* The link to the card it duplicates. */}
    <path
      d="M47 20h11"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2 3"
    />
    {/* The card it duplicates, lit. */}
    <path
      d="M60 31V12a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v19Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
    />
    <rect x="66" y="14" width="18" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.5" />
    <rect x="66" y="21" width="12" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.35" />
    {/* The cross, on the closed card's corner. */}
    <circle
      cx="9"
      cy="8"
      r="6.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="9" cy="8" r="6.5" fill="var(--hero-accent)" />
    <path
      d="M6.8 5.8l4.4 4.4M11.2 5.8l-4.4 4.4"
      stroke="var(--hero-plate)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const closeHeroArt: HeroArt = {
  name: 'session-close',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="7.25" />
      <path d="M7.4 7.4l5.2 5.2M12.6 7.4l-5.2 5.2" />
    </g>
  ),
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
