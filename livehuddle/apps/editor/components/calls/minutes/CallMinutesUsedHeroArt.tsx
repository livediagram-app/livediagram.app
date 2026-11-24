// The Call Minutes Used dialog's hero art (docs/specs/012-collaboration/call-minutes.md "What people see", "Used"),
// drawn in the dialog hero header's tokens: the month's minutes run out, calls paused. Faint rings spread from the
// bottom right, where a meter rises off the band's foot filled to its end, beside a dial whose sweep has come all the
// way round; on the dial's shoulder the pause badge, in the accent, spreads its ring twice, motion allowing. The
// title mark is a pause in a circle.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A pause in a circle, in the accent. */
const CALL_MINUTES_USED_GLYPH = (
  <>
    <circle cx="10" cy="10" r="7.25" fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" />
    <path
      d="M8 7.25v5.5M12 7.25v5.5"
      stroke="var(--hero-accent)"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  </>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {/* The meter: a small clock, then the bar filled to its end. */}
    <rect
      x="2"
      y="14"
      width="50"
      height="20"
      rx="6"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
    />
    <circle cx="11" cy="22" r="3.75" fill="none" stroke="var(--hero-mark)" strokeWidth="1.25" />
    <path
      d="M11 20.25V22l1.25 1"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
    <rect x="18" y="20" width="28" height="4" rx="2" fill="var(--hero-mark)" />
    {/* The dial, its sweep come all the way round. */}
    <circle cx="72" cy="27" r="18" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <circle
      cx="72"
      cy="27"
      r="12"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="72" cy="27" r="2" fill="var(--hero-mark)" />
    {/* Paused: the badge on its shoulder. */}
    <circle
      cx="86"
      cy="12"
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="86" cy="12" r="5.5" fill="var(--hero-accent)" />
    <path
      d="M84.25 9.75v4.5M87.75 9.75v4.5"
      stroke="var(--hero-plate)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const callMinutesUsedHeroArt: HeroArt = {
  name: 'call-minutes-used',
  glyph: CALL_MINUTES_USED_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
