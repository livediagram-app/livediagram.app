// The Magnifier popover's hero art (docs/specs/008-canvas/magnifier.md "The settings popover"): a little map of
// boxes and arrows with a lens over one of them, the box inside the lens drawn larger, its ring spreading twice,
// motion allowing. The title mark is the mode's glyph, a magnifying glass with a plus.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A magnifying glass with a plus, in the accent. */
export const MAGNIFIER_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M12.6 12.6l4.4 4.4" strokeWidth="2.2" />
    <path d="M8.5 6v5M6 8.5h5" />
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
      x="3"
      y="18"
      width="12"
      height="8"
      rx="2"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
    />
    <rect
      x="25"
      y="18"
      width="12"
      height="8"
      rx="2"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
    />
    <path d="M15 22h10" stroke="var(--hero-line)" />
    <path d="M37 22h12" stroke="var(--hero-line)" strokeDasharray="2.5 2.5" />
    {/* The lens: a ring of glass with the next box inside it, drawn twice the size. */}
    <circle
      cx="66"
      cy="15"
      r="13.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-mark)"
      strokeWidth="1.6"
    />
    <rect
      x="56"
      y="9"
      width="20"
      height="13"
      rx="3"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
    />
    <path d="M60 15.5h12" stroke="var(--hero-line)" />
    <path d="M75.6 24.6l6.4 5" stroke="var(--hero-mark)" strokeWidth="2.4" strokeLinecap="round" />
    <circle
      cx="66"
      cy="15"
      r="13.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
  </svg>
);

export const magnifierHeroArt: HeroArt = {
  name: 'magnifier',
  glyph: MAGNIFIER_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
