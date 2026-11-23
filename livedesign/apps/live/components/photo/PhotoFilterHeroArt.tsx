// A photo filter's hero art (docs/specs/031-photo/photo-adjustments.md "Filters"), drawn in the dialog hero
// header's tokens: dots fading out toward the title; and in the bottom right the photo rising off the band's
// foot, split down the middle as a before and after. The left half is the photo as it was; the right half is
// worked into a halftone, its dots swelling toward the edge. The divider is in the accent, its grip's ring
// spreading twice, motion allowing. The title mark is three lenses overlapping.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';
import { heroShot } from './photo-hero-shot';

// The halftone: columns from the divider to the photo's edge, each column's dots larger than the last.
const COLUMNS = [42, 48, 54, 60, 66];
const ROWS = [8, 14, 20, 26];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="76"
    height="30"
    viewBox="0 0 76 30"
    className={HERO_PLACE.bottomRight}
    data-photo-filter-art=""
  >
    {heroShot(3, 3, 70, 32, { ground: 30 })}
    {/* The half the effect has reached. */}
    <path d="M37 3.5h33a2.5 2.5 0 0 1 2.5 2.5v24H37z" fill="var(--hero-soft)" />
    {COLUMNS.map((x, c) =>
      ROWS.map((y, r) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y + (c % 2 ? 3 : 0)}
          r={0.9 + c * 0.42}
          fill="var(--hero-mark)"
          opacity={r === 0 && c % 2 === 0 ? 0.6 : 1}
        />
      )),
    )}
    {/* The before and after divider and its grip. */}
    <path d="M37 3v27" stroke="var(--hero-accent)" strokeWidth="1.5" />
    <circle
      cx="37"
      cy="16"
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle
      cx="37"
      cy="16"
      r="3"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
    />
  </svg>
);

export const photoFilterHeroArt: HeroArt = {
  name: 'photo-filter',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.6">
      <circle cx="10" cy="7" r="4.5" />
      <circle cx="6.75" cy="12.5" r="4.5" />
      <circle cx="13.25" cy="12.5" r="4.5" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
