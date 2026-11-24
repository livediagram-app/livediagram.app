// The Snapshots dialog's hero art (liveworkspace/docs/specs/014-snapshots/snapshots.md "In History"): save points, the
// latest few kept. A faint grid of dots fades in from the title's side; in the bottom right five frames stand in a
// row along the edge, each a little taller than the one before: the oldest only a dashed outline, about to give up its
// place, and the newest lifted in the accent, its shutter's ring spreading twice. The title mark is a viewfinder: four
// corners about a solid dot.
// Every app's Snapshots draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/snapshots).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A viewfinder: four corners about a solid dot, in the accent. */
export const SNAPSHOTS_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 7V5.5a2 2 0 0 1 2-2H7M13 3.5h1.5a2 2 0 0 1 2 2V7M16.5 13v1.5a2 2 0 0 1-2 2H13M7 16.5H5.5a2 2 0 0 1-2-2V13" />
    <circle cx="10" cy="10" r="2.6" fill="var(--hero-accent)" stroke="none" />
  </g>
);

// The three kept between the oldest and the newest: where each stands and how high it rises.
const KEPT = [
  { x: 27, y: 17 },
  { x: 42, y: 14.5 },
  { x: 57, y: 12 },
];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The oldest, about to give up its place. */}
    <rect
      x="12"
      y="19.5"
      width="12"
      height="20"
      rx="3"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 3"
    />
    {KEPT.map(({ x, y }) => (
      <g key={x}>
        <rect
          x={x}
          y={y}
          width="12"
          height="24"
          rx="3"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <rect x={x + 2.5} y={y + 3.5} width="7" height="2" rx="1" fill="var(--hero-line)" />
        <rect x={x + 2.5} y={y + 7.5} width="4.5" height="2" rx="1" fill="var(--hero-line)" />
      </g>
    ))}
    {/* The newest. */}
    <rect
      x="72.5"
      y="7"
      width="18"
      height="28"
      rx="3.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
    />
    <rect x="76.5" y="23" width="10" height="2" rx="1" fill="var(--hero-mark)" />
    <circle
      cx="81.5"
      cy="15"
      r="4"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="81.5" cy="15" r="3.5" fill="var(--hero-accent)" />
  </svg>
);

export const snapshotsHeroArt: HeroArt = {
  name: 'snapshots',
  glyph: SNAPSHOTS_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
