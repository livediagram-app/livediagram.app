// The Edit Outline dialog's hero art (docs/specs/009-elements/mind-node.md "Edit Outline"), drawn in the dialog
// hero header's tokens: the map edited as a list. Over a baseline grid, in the bottom right, a small mind map (its
// root in the accent, three branches curving off it) stands beside the same map as an outline on a sheet rising off
// the band's foot: the root's row, then its children indented under a guide line. The root row's bullet spreads a
// ring twice, motion allowing. The title mark is an indented list.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// The map's three branches: where each child pill sits, and the curve from the root to it.
const BRANCHES = [
  { y: 3, d: 'M18 15.5C24 15.5 22 6 28 6' },
  { y: 12.5, d: 'M18 15.5h10' },
  { y: 22, d: 'M18 15.5C24 15.5 22 25 28 25' },
];

// The outline's child rows: the row's centre and how long its text runs.
const ROWS = [
  { y: 16.5, w: 20 },
  { y: 23, w: 13 },
  { y: 29.5, w: 17 },
];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={HERO_PLACE.bottomRight}
    data-mind-outline-art=""
  >
    {/* The map. */}
    {BRANCHES.map(({ y, d }) => (
      <g key={y}>
        <path d={d} fill="none" stroke="var(--hero-mark)" strokeWidth="1.25" />
        <rect x="28" y={y} width="13" height="6" rx="3" fill="var(--hero-mark)" />
      </g>
    ))}
    <rect x="1" y="10.5" width="17" height="10" rx="5" fill="var(--hero-accent)" />
    {/* The same map as an outline. */}
    <rect
      x="50"
      y="2"
      width="45"
      height="36"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="62" y="7.75" width="18" height="3.5" rx="1.75" fill="var(--hero-mark)" />
    <path d="M57 13.5v20" stroke="var(--hero-line)" />
    {ROWS.map(({ y, w }) => (
      <g key={y}>
        <circle cx="64" cy={y} r="1.5" fill="var(--hero-mark)" opacity="0.55" />
        <rect
          x="68.5"
          y={y - 1.5}
          width={w}
          height="3"
          rx="1.5"
          fill="var(--hero-mark)"
          opacity="0.55"
        />
      </g>
    ))}
    <circle
      cx="57"
      cy="9.5"
      r="4.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="57" cy="9.5" r="2.25" fill="var(--hero-accent)" />
  </svg>
);

export const mindOutlineHeroArt: HeroArt = {
  name: 'mind-outline',
  glyph: (
    <g fill="var(--hero-accent)">
      <path
        d="M7 5.5h9.5M10.5 10h6M10.5 14.5h4"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="3.9" cy="5.5" r="1.2" />
      <circle cx="7.4" cy="10" r="1.2" />
      <circle cx="7.4" cy="14.5" r="1.2" />
    </g>
  ),
  texture: heroTexture('baseline'),
  pieces: PIECES,
};
