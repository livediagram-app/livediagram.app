// The Chart Data dialog's hero art (each app's docs/specs/009-elements, the line chart): a row per category, a
// column per series, typed in or brought in from a CSV. A grid fades in from the title's side, the chart's own
// graph paper; in the bottom right a line chart rises from the edge: an axis, dashed rules, one series drawn back
// in the muted stroke and one in the accent, a point on each category, the accent series' peak ringed, its ring
// spreading twice. The title's side stays plain paper. The title mark is a line climbing over a pair of axes.
// Every app's Chart Data draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/line-data).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A line climbing over a pair of axes, in the accent. */
export const LINE_DATA_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3.5v13h14" />
    <path d="m6.5 12.5 3-3.5 2.8 2.2 4.2-5.2" />
  </g>
);

// The categories' x positions and each series' values at them (y, down from the top of the box).
const XS = [10, 26, 42, 58, 74, 90];
const BACK = [22, 17, 20, 12, 15, 9];
const FRONT = [27, 21, 23, 14, 6, 11];
const PEAK = 4;

const path = (ys: number[]) => ys.map((y, i) => `${i === 0 ? 'M' : 'L'}${XS[i]} ${y}`).join('');

function points(ys: number[], stroke: string) {
  return ys.map((y, i) => (
    <circle
      key={XS[i]}
      cx={XS[i]}
      cy={y}
      r="2"
      fill="var(--hero-plate)"
      stroke={stroke}
      strokeWidth="1.5"
    />
  ));
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    // The peak's ring spreads past the box; the band still clips at its own edge.
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The value axis and its rules. */}
    <path d="M2.5 1v29" stroke="var(--hero-mark)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5 6h89M5 15h89M5 24h89" stroke="var(--hero-line)" strokeDasharray="2 3" />
    {/* The series behind. */}
    <path
      d={path(BACK)}
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
    {points(BACK, 'var(--hero-mark)')}
    {/* The series in front, its peak ringed. */}
    <path
      d={path(FRONT)}
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {points(FRONT, 'var(--hero-accent)')}
    <circle
      cx={XS[PEAK]}
      cy={FRONT[PEAK]}
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx={XS[PEAK]} cy={FRONT[PEAK]} r="2.75" fill="var(--hero-accent)" />
  </svg>
);

export const lineDataHeroArt: HeroArt = {
  name: 'line-data',
  glyph: LINE_DATA_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
