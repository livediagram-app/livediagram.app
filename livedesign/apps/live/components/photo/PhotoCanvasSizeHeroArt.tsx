// Canvas Size's hero art (docs/specs/031-photo/photo-pages.md "Changing the size"), drawn in the dialog hero
// header's tokens: dots fading out toward the title; and in the bottom right the photo rising off the band's foot
// with the dashed edge of a wider canvas round it, an arrow at either side pushing that edge out. Beside it is
// the anchor, a three by three grid whose middle square is in the accent, its ring spreading twice, motion
// allowing. The title mark is a photo inside the corners of its canvas.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';
import { heroShot } from './photo-hero-shot';

// The anchor grid's squares: 5 wide, 2.5 apart.
const CELLS = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => ({ row, col })));

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={HERO_PLACE.bottomRight}
    data-photo-canvas-size-art=""
  >
    {/* The anchor. */}
    {CELLS.map(({ row, col }) =>
      row === 1 && col === 1 ? null : (
        <rect
          key={`${row}-${col}`}
          x={4.5 + col * 7.5}
          y={5.5 + row * 7.5}
          width="5"
          height="5"
          rx="1.25"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
      ),
    )}
    <circle
      cx="14.5"
      cy="15.5"
      r="5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <rect x="12" y="13" width="5" height="5" rx="1.25" fill="var(--hero-accent)" />
    {/* The canvas, wider than the photo. */}
    <rect
      x="36"
      y="3"
      width="56"
      height="33"
      rx="3"
      fill="var(--hero-soft)"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="4 3"
    />
    {heroShot(49, 10, 30, 26, { ground: 30 })}
    <g
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M46.5 20h-6M42.5 17.5L40 20l2.5 2.5" />
      <path d="M81.5 20h6M85.5 17.5L88 20l-2.5 2.5" />
    </g>
  </svg>
);

export const photoCanvasSizeHeroArt: HeroArt = {
  name: 'photo-canvas-size',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6V4a1.5 1.5 0 0 1 1.5-1.5h2M14 2.5h2A1.5 1.5 0 0 1 17.5 4v2M17.5 14v2a1.5 1.5 0 0 1-1.5 1.5h-2M6 17.5H4A1.5 1.5 0 0 1 2.5 16v-2" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1.5" fill="var(--hero-wash)" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
