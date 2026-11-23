// Make Sizes' hero art (docs/specs/031-photo/photo-pages.md "Making sizes"), drawn in the dialog hero header's
// tokens: a faint grid fading out toward the title; and in the bottom right one photo standing in three formats,
// a wide banner, a square and a tall story, each rising off the band's foot. The tall one is ticked, outlined in
// the accent with its check, and bobs twice, motion allowing. The title mark is a tall frame over a wide one.
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
    data-make-sizes-art=""
  >
    {heroShot(2, 15, 38, 20, { ground: 30 })}
    {heroShot(45, 8, 24, 27, { ground: 30 })}
    {/* The format ticked. */}
    <g className={HERO_MOTION.float}>
      {heroShot(74, 3, 17, 32, { ground: 30, stroke: 'var(--hero-accent)' })}
      <circle cx="90" cy="4.5" r="4" fill="var(--hero-accent)" />
      <path
        d="M88.1 4.6l1.4 1.4 2.5-2.8"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export const makeSizesHeroArt: HeroArt = {
  name: 'make-sizes',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.7" strokeLinejoin="round">
      <rect x="2.5" y="9.5" width="15" height="8" rx="2" opacity="0.7" />
      <rect x="6" y="2.5" width="8" height="12" rx="2" fill="var(--hero-wash)" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
