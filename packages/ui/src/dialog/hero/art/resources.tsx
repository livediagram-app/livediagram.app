// The Resources dialog's hero art (each product's docs/specs/008-canvas/element-menu-quick-bar.md "Resources"):
// what is attached to an element. Faint dots fade in from the title's side; in the bottom right two sheets rise from
// the edge, the back one tinted, the front one a plate with two lines, and a paperclip in the accent holds them
// together at the front sheet's top, bobbing twice. The title mark is a paperclip.
// Every app's Resources dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/resources).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

// A paperclip on a 16-unit grid, the element menu's own Resources glyph.
const CLIP =
  'M13 7.5 8.2 12.3a3.2 3.2 0 0 1-4.5-4.5l5-5a2.1 2.1 0 0 1 3 3l-5 5a1.1 1.1 0 0 1-1.5-1.5L9.7 4.8';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="88"
    height="30"
    viewBox="0 0 88 30"
    // The paperclip stands above the sheets' box as it bobs; the band still clips at its own edge.
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The sheet behind: what is attached. */}
    <rect
      x="30"
      y="9"
      width="56"
      height="34"
      rx="6"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    <rect x="66" y="16" width="13" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.45" />
    {/* The sheet in front: the element it is attached to. */}
    <rect
      x="2"
      y="3"
      width="58"
      height="40"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="10" y="13" width="26" height="3" rx="1.5" fill="var(--hero-mark)" />
    <rect x="10" y="21" width="34" height="3" rx="1.5" fill="var(--hero-mark)" opacity="0.45" />
    {/* The paperclip over both, in the accent. */}
    <g className={HERO_MOTION.float}>
      <path
        d={CLIP}
        transform="translate(42 -7) scale(1.15)"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export const resourcesHeroArt: HeroArt = {
  name: 'resources',
  glyph: (
    <path
      d={CLIP}
      transform="translate(0.5 0.5) scale(1.2)"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
