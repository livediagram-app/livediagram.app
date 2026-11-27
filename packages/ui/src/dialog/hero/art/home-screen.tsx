// The Add to Home Screen steps' hero art (@liveworkspace/settings-ui push/HomeScreenGuide: iOS and iPadOS give a page
// notifications only once it is on the Home Screen). Faint dots spread over the band; at its bottom right a phone
// rises off the foot, its Home Screen a grid of app tiles with one empty place, and the app's own tile, in the accent
// with a plus, bobs twice above it on its way in, motion allowing. The title mark is the Add to Home Screen icon: a
// rounded square holding a plus. Every app's Settings draws it, so it lives here
// (@liveworkspace/ui/dialog-hero-art/home-screen).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

// The Home Screen's tiles: three across, two rows, the last place left for the app.
const TILES = [
  [41, 10],
  [50, 10],
  [59, 10],
  [41, 19],
  [50, 19],
] as const;

const PIECES = (
  <svg {...HERO_SVG} width="92" height="30" viewBox="0 0 92 30" className={HERO_PLACE.bottomRight}>
    {/* The phone, its top half above the band's foot. */}
    <rect
      x="36"
      y="3"
      width="36"
      height="34"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M50 6h8" stroke="var(--hero-line)" strokeWidth="1.5" strokeLinecap="round" />
    {TILES.map(([x, y]) => (
      <rect
        key={`${x}-${y}`}
        x={x}
        y={y}
        width="7"
        height="7"
        rx="2"
        fill="var(--hero-mark)"
        opacity="0.55"
      />
    ))}
    {/* The place the app goes. */}
    <rect
      x="59"
      y="19"
      width="7"
      height="7"
      rx="2"
      fill="none"
      stroke="var(--hero-accent)"
      strokeDasharray="1.5 1.5"
    />
    {/* The app's tile, on its way in. */}
    <g className={HERO_MOTION.float}>
      <rect
        x="76"
        y="4"
        width="12"
        height="12"
        rx="3.5"
        fill="var(--hero-wash)"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
      />
      <path
        d="M82 7.25v5.5M79.25 10h5.5"
        stroke="var(--hero-accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
    <path
      d="M74.5 14.5 68.5 19"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeDasharray="0.5 3"
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
