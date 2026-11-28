// New Follow-up's hero art (docs/specs/026-plan/session-tabs.md "Sprint Review"), drawn in the dialog hero header's
// tokens: the reviewed card with its presentation mark, a dashed link out to a new card being added, its plus ringed,
// motion allowing. The title mark is a card with a plus.
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
    data-follow-up-art=""
  >
    {/* The reviewed card. */}
    <path
      d="M8 31V12a5 5 0 0 1 5-5h28a5 5 0 0 1 5 5v19Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="14" y="14" width="22" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.45" />
    <rect x="14" y="21" width="15" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.3" />
    {/* The link out to the follow-up. */}
    <path
      d="M47 20h11"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="2 3"
    />
    {/* The new card, lit. */}
    <path
      d="M60 31V12a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v19Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeDasharray="3 2"
    />
    <rect x="66" y="21" width="12" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.35" />
    {/* The plus, on the new card's corner. */}
    <circle
      cx="88"
      cy="8"
      r="6.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="88" cy="8" r="6.5" fill="var(--hero-accent)" />
    <path d="M88 5v6M85 8h6" stroke="var(--hero-plate)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const followUpHeroArt: HeroArt = {
  name: 'session-follow-up',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="14" height="12" rx="2.5" />
      <path d="M10 7.5v5M7.5 10h5" />
    </g>
  ),
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
