// The Attendance dialog's hero art (docs/specs/012-collaboration/tab-attendance.md "Where it shows"), drawn in the
// dialog hero header's tokens: who was in the tab and when. Faint dots fade in from the title's side; in the bottom
// right a register rises off the band's foot, a row per person with their disc and the stretch of time they
// stayed, against a dashed line for now. The top visit, in the accent, still runs up to that line and its disc
// spreads a ring twice, motion allowing. The title mark is a person beside a clock.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// The visits that have ended: the row's centre, where the stay starts and how long it ran.
const VISITS = [
  { y: 20, from: 26, length: 30, opacity: 1 },
  { y: 29, from: 48, length: 22, opacity: 0.5 },
];

const NOW_X = 85;

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={HERO_PLACE.bottomRight}
    data-tab-attendance-art=""
  >
    <rect
      x="1"
      y="2"
      width="94"
      height="36"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {/* Now. */}
    <path d={`M${NOW_X} 6v30`} stroke="var(--hero-mark)" strokeDasharray="2 2.5" opacity="0.7" />
    {VISITS.map(({ y, from, length, opacity }) => (
      <g key={y} opacity={opacity}>
        <circle cx="12" cy={y} r="3.25" fill="var(--hero-mark)" />
        <rect x={from} y={y - 2} width={length} height="4" rx="2" fill="var(--hero-mark)" />
      </g>
    ))}
    {/* Here now: the visit still open. */}
    <rect x="38" y="9" width={NOW_X - 38} height="4" rx="2" fill="var(--hero-accent)" />
    <circle
      cx="12"
      cy="11"
      r="6"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="12" cy="11" r="3.5" fill="var(--hero-accent)" />
  </svg>
);

export const tabAttendanceHeroArt: HeroArt = {
  name: 'tab-attendance',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7.5" cy="6.5" r="2.9" />
      <path d="M2.5 16c.4-3.1 2.4-4.9 5-4.9.7 0 1.4.1 2 .4" />
      <circle cx="14" cy="13.5" r="3.6" strokeWidth="1.6" />
      <path d="M14 11.9v1.8l1.2.8" strokeWidth="1.3" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
