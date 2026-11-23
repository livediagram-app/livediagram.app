// The move prompt's hero art (each app's LocalMovePrompt: after signing in, what was made in This Browser moves to
// the account). A faint grid fades in from the title's side; in the bottom right a browser window rises off the
// band's foot, one of its two tiles left as a dashed outline, and that tile, in the accent, travels along an arrow
// to the account's disc, bobbing twice on the way, motion allowing. The title mark is an arrow dropping into a tray.
// Every app's prompt draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/local-move).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const PIECES = (
  <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomRight}>
    {/* This Browser: a window, the tile that stays and the place the moved one left. */}
    <rect
      x="1"
      y="5"
      width="40"
      height="32"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M1 12.5h40" stroke="var(--hero-line)" />
    {[6, 10, 14].map((cx) => (
      <circle key={cx} cx={cx} cy="8.75" r="1.1" fill="var(--hero-mark)" opacity="0.6" />
    ))}
    <rect
      x="6"
      y="17"
      width="13"
      height="15"
      rx="2.5"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    <rect
      x="23"
      y="17"
      width="13"
      height="15"
      rx="2.5"
      fill="none"
      stroke="var(--hero-mark)"
      strokeDasharray="2 2"
      opacity="0.6"
    />
    {/* The tile on its way. */}
    <g className={HERO_MOTION.float}>
      <rect x="46" y="12" width="13" height="15" rx="2.5" fill="var(--hero-accent)" />
      <path
        d="M49.5 17h6M49.5 21h4"
        stroke="var(--hero-plate)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
    <path
      d="M62.5 19.5h6.5m-2.75-2.75 2.75 2.75-2.75 2.75"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The account. */}
    <circle cx="83.5" cy="19.5" r="11" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <circle cx="83.5" cy="16" r="3.5" fill="var(--hero-mark)" />
    <path
      d="M76.75 26.5c1-3.6 3.6-5 6.75-5s5.75 1.4 6.75 5"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const localMoveHeroArt: HeroArt = {
  name: 'local-move',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3v8.5m-3.2-3.2 3.2 3.2 3.2-3.2" />
      <path d="M3.5 12.5v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
