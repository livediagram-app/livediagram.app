// The Edit Map dialog's hero art (docs/specs/009-elements/map.md "The Map dialog": choose what it shows, pick out
// countries and pin places), drawn in the dialog hero header's tokens. A faint grid fades in from the title's side
// like a chart's graticule; in the bottom right a globe rises off the band's foot, its meridians and parallels
// drawn fine and one country picked out, and a pin in the accent stands on it, lifting twice, motion allowing. The
// title mark is a map pin.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    // The pin lifts above the globe's box as it bobs; the band still clips at its own edge.
    overflow="visible"
    className={HERO_PLACE.bottomRight}
    data-map-art=""
  >
    {/* The globe: the foot cuts it under its crown. */}
    <circle cx="48" cy="46" r="43" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <ellipse cx="48" cy="46" rx="17" ry="43" fill="none" stroke="var(--hero-line)" />
    <ellipse cx="48" cy="46" rx="32" ry="43" fill="none" stroke="var(--hero-line)" />
    <path d="M48 3v30" stroke="var(--hero-line)" />
    <path d="M21.5 12q26.5 -5 53 0M10.5 25q37.5 -6 75 0" fill="none" stroke="var(--hero-line)" />
    {/* A country picked out. */}
    <path
      d="M27 17.5l6.5-3.5 6 1.5 2 5-3.5 5.5-7.5 1-5-4.5Z"
      fill="var(--hero-mark)"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinejoin="round"
      opacity="0.5"
    />
    {/* A place pinned. */}
    <ellipse cx="64" cy="22.5" rx="3.5" ry="1.25" fill="var(--hero-mark)" opacity="0.5" />
    <g className={HERO_MOTION.float}>
      <path
        d="M64 22c-3.9-4.4-5.5-7-5.5-9.5a5.5 5.5 0 0 1 11 0c0 2.5-1.6 5.1-5.5 9.5Z"
        fill="var(--hero-accent)"
      />
      <circle cx="64" cy="12.5" r="2" fill="var(--hero-plate)" />
    </g>
  </svg>
);

export const mapHeroArt: HeroArt = {
  name: 'map',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M10 17.5c-4-4.4-5.5-7-5.5-9.3a5.5 5.5 0 0 1 11 0c0 2.3-1.5 4.9-5.5 9.3Z" />
      <circle cx="10" cy="8.2" r="1.9" fill="var(--hero-accent)" stroke="none" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
