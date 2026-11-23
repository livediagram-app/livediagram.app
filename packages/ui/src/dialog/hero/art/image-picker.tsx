// The Image picker's hero art (each app's ImagePicker: upload a picture or take one from the gallery). Faint dots
// fade in from the title's side; in the bottom right two pictures rise off the band's foot, a gallery card tilted
// behind and the picked one in front, its hills under a sun in the accent whose ring spreads twice, motion allowing.
// The title mark is a framed picture: a sun over hills.
// Every app's picker draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/image-picker).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const PIECES = (
  <svg {...HERO_SVG} width="92" height="30" viewBox="0 0 92 30" className={HERO_PLACE.bottomRight}>
    {/* The gallery card behind, tilted. */}
    <g transform="rotate(-9 30 30)">
      <rect
        x="10"
        y="9"
        width="36"
        height="30"
        rx="4.5"
        fill="var(--hero-wash)"
        stroke="var(--hero-line)"
      />
      <path
        d="M13 30l9-9 6 6 5-5 10 9"
        fill="none"
        stroke="var(--hero-line)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="16" r="2.25" fill="var(--hero-line)" />
    </g>
    {/* The picked picture in front: hills under a sun. */}
    <rect
      x="40"
      y="3"
      width="48"
      height="36"
      rx="5.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M44 30l12-13 8 8 6-6 14 11Z" fill="var(--hero-mark)" opacity="0.55" />
    <path d="M56 30l10-9 6 5 6-5 6 9Z" fill="var(--hero-mark)" />
    <circle
      cx="76"
      cy="12"
      r="6"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <circle cx="76" cy="12" r="3.25" fill="var(--hero-accent)" />
  </svg>
);

export const imagePickerHeroArt: HeroArt = {
  name: 'image-picker',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="12" rx="2.5" />
      <path d="M3.5 13.5l3.8-3.8 3 3 2.2-2.2 4 4" strokeLinecap="round" />
      <circle cx="12.6" cy="7.6" r="1.3" fill="var(--hero-accent)" stroke="none" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
