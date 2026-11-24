// The Switch Google Account dialog's hero art (liveworkspace/docs/specs/005-drive/drive.md "Reconnecting with another
// Google account"): Cloud Sync moving from one account to another. Rings spread from the bottom right, where a cloud
// rises from the edge with two accounts on it: the one in use sitting back, the one being switched to ringed in the
// accent (its ring spreading twice), a pair of arrows trading places between them. The title mark is those two arrows.
// liveworkspace.app's dialog; site art is shared art, so it lives here
// (@liveworkspace/ui/dialog-hero-art/drive-switch).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Two arrows trading places, in the accent. */
export const DRIVE_SWITCH_GLYPH = (
  <path
    d="M4 7.2h11.5M12.6 4.2l3 3-3 3M16 12.8H4.5M7.4 9.8l-3 3 3 3"
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

// An account: a disc with a head and shoulders in `ink`.
function account(x: number, fill: string, stroke: string, ink: string) {
  return (
    <g>
      <circle cx={x} cy="21" r="7" fill={fill} stroke={stroke} strokeWidth="1.5" />
      <circle cx={x} cy="18.9" r="2.3" fill={ink} />
      <path d={`M${x - 4} 25.4a4.2 4.2 0 0 1 8 0Z`} fill={ink} />
    </g>
  );
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {/* The cloud the two accounts sync with. */}
    <path
      d="M22 31a10 10 0 0 1 8-14 16 16 0 0 1 30-5 13 13 0 0 1 24 6 9 9 0 0 1 8 13Z"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    {account(43, 'var(--hero-wash)', 'var(--hero-line)', 'var(--hero-mark)')}
    <path
      d="M53.5 18.5h9M60.2 16.2l2.3 2.3-2.3 2.3M64.5 24h-9M57.8 21.7L55.5 24l2.3 2.3"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="75"
      cy="21"
      r="7"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    {account(75, 'var(--hero-plate)', 'var(--hero-accent)', 'var(--hero-accent)')}
  </svg>
);

export const driveSwitchHeroArt: HeroArt = {
  name: 'drive-switch',
  glyph: DRIVE_SWITCH_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
