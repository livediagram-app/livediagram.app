// The Add to Home Screen steps' hero art (@liveworkspace/settings-ui push/HomeScreenGuide: iOS and iPadOS give a page
// notifications only once it is on the Home Screen). Faint dots spread over the band; at its bottom right a phone
// stands whole, its Home Screen a grid of app tiles with one empty place, and the app's own tile, in the accent with
// a plus, bobs twice beside it on its way in, motion allowing. The drawing ends short of the band's corner so it stays
// clear of the close button above it. The title mark is the Add to Home Screen icon: a rounded square holding a plus.
// Every app's Settings draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/home-screen).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

// The Home Screen's tiles: three across, three rows, the last place left for the app.
const TILES = [
  [40, 7],
  [47, 7],
  [54, 7],
  [40, 14],
  [47, 14],
  [54, 14],
  [40, 21],
  [47, 21],
] as const;

const PIECES = (
  <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomRight}>
    {/* The app's tile, on its way in. */}
    <g className={HERO_MOTION.float}>
      <rect
        x="4"
        y="6"
        width="13"
        height="13"
        rx="3.5"
        fill="var(--hero-wash)"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
      />
      <path
        d="M10.5 9.5v6M7.5 12.5h6"
        stroke="var(--hero-accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
    <path
      d="M20.5 15Q30 11 33 16"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeDasharray="0.5 3"
    />
    {/* The phone, whole, its Home Screen a grid with one place left. */}
    <rect
      x="35"
      y="1.5"
      width="25"
      height="27"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {TILES.map(([x, y]) => (
      <rect
        key={`${x}-${y}`}
        x={x}
        y={y}
        width="5"
        height="5"
        rx="1.5"
        fill="var(--hero-mark)"
        opacity="0.55"
      />
    ))}
    {/* The place the app goes. */}
    <rect
      x="54"
      y="21"
      width="5"
      height="5"
      rx="1.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeDasharray="1.2 1.2"
    />
  </svg>
);

export const homeScreenHeroArt: HeroArt = {
  name: 'home-screen',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="13" height="13" rx="3.5" />
      <path d="M10 7v6M7 10h6" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
