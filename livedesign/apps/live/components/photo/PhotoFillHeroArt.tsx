// Fill's hero art (docs/specs/031-photo/photo-tools.md "Retouching" Fill), drawn in the dialog hero header's
// tokens: rings spreading from the bottom right, paint running out across the band; and there a selection, its
// dashed edge rising off the band's foot, filling with colour up to a wave, the wave's line in the accent. A
// bucket tips over its corner, and the drop it lets go, in the accent, bobs twice, motion allowing. The title mark
// is a drop of paint.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const WAVE = 'M10.5 19q6.5-4 13 0t13 0 13 0 12.5 0';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
    data-photo-fill-art=""
  >
    {/* The selection, filling. */}
    <rect x="10" y="6" width="52" height="30" rx="3" fill="var(--hero-plate)" />
    <path d={`${WAVE}V30h-52z`} fill="var(--hero-wash)" />
    <path
      d={WAVE}
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <rect
      x="10"
      y="6"
      width="52"
      height="30"
      rx="3"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="4 3"
    />
    {/* The bucket, tipped toward it. */}
    <g
      transform="rotate(-38 76 14)"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <path d="M68 8C68-1 84-1 84 8" fill="none" stroke="var(--hero-line)" />
      <path d="M68 8h16l-2 12.4a2 2 0 0 1-2 1.7h-8a2 2 0 0 1-2-1.7z" fill="var(--hero-plate)" />
      <ellipse cx="76" cy="8" rx="8" ry="2.2" fill="var(--hero-wash)" />
    </g>
    {/* The drop. */}
    <path
      d="M59.5 8.5c2.2 3 3.6 4.9 3.6 6.9a3.6 3.6 0 0 1-7.2 0c0-2 1.4-3.9 3.6-6.9z"
      fill="var(--hero-accent)"
      className={HERO_MOTION.float}
    />
  </svg>
);

export const photoFillHeroArt: HeroArt = {
  name: 'photo-fill',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M10 2.5c3.2 4.3 5.5 7.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.8 2.3-5.7 5.5-10z"
        strokeWidth="1.7"
        fill="var(--hero-wash)"
      />
      <path d="M7.4 12.6a2.7 2.7 0 0 0 2.2 2.6" strokeWidth="1.3" />
    </g>
  ),
  texture: heroTexture('rings'),
  pieces: PIECES,
};
