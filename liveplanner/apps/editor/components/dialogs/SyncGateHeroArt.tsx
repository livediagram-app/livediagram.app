// The sync gate's hero art (docs/specs/006-project/offline-mode.md "Sharing a project in This Browser": a plan kept
// in This Browser is synced before it can be shared or automated), drawn in the dialog hero header's tokens: rings
// spreading from the bottom right; and there this browser, a window rising off the band's foot with the plan's card
// in it, a dashed arrow leaving it for the cloud beside it, edged in the accent with an arrow going up, its ring
// spreading twice, motion allowing. No centre piece. The title mark is a cloud with an arrow going up into it.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const ACCENT = {
  fill: 'none',
  stroke: 'var(--hero-accent)',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const PIECES = (
  // This browser, and the cloud the plan goes up to.
  <svg
    {...HERO_SVG}
    width="90"
    height="30"
    viewBox="0 0 90 30"
    className={HERO_PLACE.bottomRight}
    data-sync-gate-art=""
  >
    {/* The window: its bar, the plan's card inside. */}
    <rect
      x="2"
      y="8"
      width="40"
      height="30"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M2 15.5h40" stroke="var(--hero-line)" />
    <circle cx="7.5" cy="11.75" r="1.2" fill="var(--hero-line)" />
    <circle cx="11.5" cy="11.75" r="1.2" fill="var(--hero-line)" />
    <rect x="8" y="20" width="17" height="14" rx="3" fill="var(--hero-wash)" />
    <path d="M12 25h8" stroke="var(--hero-mark)" strokeWidth="2" strokeLinecap="round" />
    {/* Leaving for the cloud. */}
    <path d="M45.5 18h8" {...ACCENT} stroke="var(--hero-mark)" strokeDasharray="2.5 3" />
    <path d="M53 15l3.2 3-3.2 3" {...ACCENT} stroke="var(--hero-mark)" />
    {/* The cloud, the plan going up into it. */}
    <circle cx="72.5" cy="13" r="5.5" {...ACCENT} className={HERO_MOTION.ring} />
    <path
      d="M66 22a5.5 5.5 0 0 1-.6-10.97A8 8 0 0 1 80.6 12.2 5 5 0 0 1 80 22Z"
      {...ACCENT}
      fill="var(--hero-plate)"
    />
    <path d="M72.5 18.5v-7M69.5 14.3l3-3 3 3" {...ACCENT} />
  </svg>
);

export const syncGateHeroArt: HeroArt = {
  name: 'sync-gate',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.75 15.25a3.75 3.75 0 0 1-.4-7.48 5.25 5.25 0 0 1 10.1.9 3.3 3.3 0 0 1-.45 6.58Z" />
      <path d="M10 13.25v-4.25M8 10.75l2-2 2 2" />
    </g>
  ),
  texture: heroTexture('rings'),
  pieces: PIECES,
};
