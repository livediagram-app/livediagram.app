// An adjustment's hero art (docs/specs/031-photo/photo-adjustments.md "The Adjust tab"), drawn in the dialog hero
// header's tokens: a faint grid fading out toward the title, the graph paper a curve is drawn on; and in the
// bottom right the photo's histogram rising off the band's foot, a tone curve drawn over it in the accent from
// the shadows up to the highlights, the ring of the point being dragged spreading twice, motion allowing. The
// title mark is two sliders set apart.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// The histogram's bars, left (shadows) to right (highlights): two humps.
const BARS = [6, 9, 13, 18, 22, 25, 23, 19, 15, 12, 10, 13, 17, 20, 16, 11, 7, 5];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={HERO_PLACE.bottomRight}
    data-photo-adjust-art=""
  >
    {BARS.map((h, i) => (
      <rect
        key={i}
        x={3 + i * 5}
        y={30 - h}
        width="3.5"
        height={h + 2}
        rx="1.25"
        fill={i < 6 ? 'var(--hero-mark)' : 'var(--hero-line)'}
        opacity={i < 6 ? 0.55 : 1}
      />
    ))}
    {/* The tone curve and the point on it. */}
    <path
      d="M2 27.5C24 27 34 21 48 14S74 4.5 94 3"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="48"
      cy="14"
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle
      cx="48"
      cy="14"
      r="2.75"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
    />
  </svg>
);

export const photoAdjustHeroArt: HeroArt = {
  name: 'photo-adjust',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.7" strokeLinecap="round">
      <path d="M3 6.5h4.5M12.5 6.5H17M3 13.5h7.5M15.5 13.5H17" />
      <circle cx="10" cy="6.5" r="2.5" fill="var(--hero-wash)" />
      <circle cx="13" cy="13.5" r="2.5" fill="var(--hero-wash)" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
