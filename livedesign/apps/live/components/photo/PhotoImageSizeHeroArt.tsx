// Image Size's hero art (docs/specs/031-photo/photo-pages.md "Changing the size"), drawn in the dialog hero
// header's tokens: a faint grid fading out toward the title; and in the bottom right the photo rising off the
// band's foot inside the dashed frame of the size it is being scaled to, the two sharing a corner so the shape
// is kept. An arrow in the accent runs from the photo's corner to the frame's, where the handle being dragged
// sits, its ring spreading twice, motion allowing. The title mark is a frame with an arrow stretching it corner
// to corner.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';
import { heroShot } from './photo-hero-shot';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
    data-photo-image-size-art=""
  >
    {/* The size it is going to. */}
    <rect
      x="22"
      y="5"
      width="62"
      height="31"
      rx="3"
      fill="var(--hero-soft)"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="4 3"
    />
    {heroShot(22, 15, 34, 21, { ground: 30 })}
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M60 13.5L78.5 7.5" />
      <path d="M73.7 6L78.5 7.5L75.5 11.5" />
    </g>
    {/* The corner handle. */}
    <circle
      cx="84"
      cy="5"
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <rect
      x="81.5"
      y="2.5"
      width="5"
      height="5"
      rx="1"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
    />
  </svg>
);

export const photoImageSizeHeroArt: HeroArt = {
  name: 'photo-image-size',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="2.5" width="15" height="15" rx="3" opacity="0.6" />
      <path d="M6.5 13.5l7-7" />
      <path d="M9.5 6.5h4v4M10.5 13.5h-4v-4" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
