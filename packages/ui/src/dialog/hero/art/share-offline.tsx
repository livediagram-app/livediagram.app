// The Share dialog's offline gate's hero art (each app's ShareOfflineGate: saved only in this browser, so it syncs
// before it can be shared). Faint rings spread from the bottom right, where a browser window holding a small
// drawing rises off the band's foot and a dotted line reaches from it to a cloud drawn in dashes, not there yet;
// the way up, an arrow in the accent, bobs twice, motion allowing. The title mark is a cloud with an arrow up.
// Every app's gate draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/share-offline).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const PIECES = (
  <svg {...HERO_SVG} width="92" height="30" viewBox="0 0 92 30" className={HERO_PLACE.bottomRight}>
    {/* This browser, holding the work. */}
    <rect
      x="1"
      y="7"
      width="44"
      height="30"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M1 14.5h44" stroke="var(--hero-line)" />
    {[6, 10, 14].map((cx) => (
      <circle key={cx} cx={cx} cy="10.75" r="1.1" fill="var(--hero-mark)" opacity="0.6" />
    ))}
    <path d="M17 23h10" stroke="var(--hero-mark)" strokeWidth="1.25" />
    <rect x="7" y="19.5" width="10" height="7" rx="2" fill="var(--hero-mark)" />
    <rect x="27" y="19.5" width="12" height="7" rx="3.5" fill="var(--hero-mark)" opacity="0.5" />
    {/* The way to the servers, not taken yet. */}
    <path
      d="M47.5 21h11"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeDasharray="0.5 4"
    />
    <path
      d="M65 24a5 5 0 0 1-.6-9.96A7.5 7.5 0 0 1 78.9 12.6 5.8 5.8 0 0 1 80 24Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeDasharray="3 2.5"
    />
    <path
      d="M72 21.5v-7m-3 3 3-3 3 3"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={HERO_MOTION.float}
    />
  </svg>
);

export const shareOfflineHeroArt: HeroArt = {
  name: 'share-offline',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.5 15.5a3.5 3.5 0 0 1-.4-6.98A5 5 0 0 1 14.6 8.1a3.9 3.9 0 0 1 .4 7.4" />
      <path d="M10 16.5v-5m-2.2 2.1 2.2-2.2 2.2 2.2" />
    </g>
  ),
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
