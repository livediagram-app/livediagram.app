// The Report dialog's hero art (liveworkspace/docs/specs/007-community/community.md, reporting a post): a post, and
// a flag raised on it. A faint grid of dots fades in from the title's side; in the bottom right a post rises from the
// edge (its author's dot, a name, two lines), and planted on its corner a flag in the accent, bobbing twice. The title
// mark is a flag.
// liveworkspace.app's Community dialog; site art is shared art, so it lives here
// (@liveworkspace/ui/dialog-hero-art/report).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A flag on its pole, in the accent. */
export const REPORT_GLYPH = (
  <g stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17V3.5" fill="none" />
    <path d="M5 4.4h10l-2.2 3.3 2.2 3.3H5Z" fill="var(--hero-accent)" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The post. */}
    <path
      d="M20 31V13a5 5 0 0 1 5-5h48a5 5 0 0 1 5 5v18Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <circle cx="29.5" cy="15.5" r="3.5" fill="var(--hero-wash)" stroke="var(--hero-line)" />
    <rect x="36" y="14" width="17" height="3" rx="1.5" fill="var(--hero-mark)" />
    <rect x="26" y="22.5" width="40" height="2.5" rx="1.25" fill="var(--hero-line)" />
    <rect x="26" y="27.5" width="28" height="2.5" rx="1.25" fill="var(--hero-line)" />
    {/* The flag raised on it. */}
    <g className={HERO_MOTION.float}>
      <path d="M76 21V3" stroke="var(--hero-mark)" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M76 3.5h13.5l-3 3.75 3 3.75H76Z"
        fill="var(--hero-accent)"
        stroke="var(--hero-accent)"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export const reportHeroArt: HeroArt = {
  name: 'report',
  glyph: REPORT_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
