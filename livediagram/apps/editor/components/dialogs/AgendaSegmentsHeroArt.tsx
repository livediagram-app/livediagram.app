// The Segments dialog's hero art (docs/specs/012-collaboration/agenda.md "The Segments dialog"), drawn in the dialog
// hero header's tokens: the baseline grid fading out toward the title, a ruled running order; and in the bottom
// right the meeting as a strip of segments rising off the band's foot, each as long as its minutes, the one being
// run in the accent, a clock on its corner whose ring spreads twice. No centre piece: the dialog is never wide
// enough to show one. The title mark is a clock over a list.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// The strip's segments: where each starts and how long it runs.
const SEGMENTS = [
  { x: 6, w: 14, now: false },
  { x: 22, w: 26, now: true },
  { x: 50, w: 10, now: false },
  { x: 62, w: 18, now: false },
];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="88"
    height="30"
    viewBox="0 0 88 30"
    className={HERO_PLACE.bottomRight}
    data-agenda-segments-art=""
  >
    <rect
      x="1"
      y="9"
      width="86"
      height="30"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {SEGMENTS.map(({ x, w, now }) => (
      <rect
        key={x}
        x={x}
        y="15"
        width={w}
        height="8"
        rx="3"
        fill={now ? 'var(--hero-accent)' : 'var(--hero-mark)'}
        opacity={now ? 1 : 0.5}
      />
    ))}
    {/* The clock on the running segment's corner. */}
    <circle
      cx="48"
      cy="11"
      r="8"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle
      cx="48"
      cy="11"
      r="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
    />
    <path
      d="M48 7.5V11l2.4 1.6"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const agendaSegmentsHeroArt: HeroArt = {
  name: 'agenda-segments',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7" cy="7" r="4" />
      <path d="M7 5v2l1.4 1" strokeWidth="1.4" />
      <path d="M13.5 5.5H17" />
      <path d="M3.5 13h13.5" />
      <path d="M3.5 16.5h9" />
    </g>
  ),
  texture: heroTexture('baseline'),
  pieces: PIECES,
};
