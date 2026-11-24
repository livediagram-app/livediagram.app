// The Connect File dialog's hero art (liveworkspace/docs/specs/004-index/connected-tabs.md "From the tab bar"): two
// files joined. A faint grid of dots fades in from the title's side; in the bottom right two file cards rise from the
// band's edge, leaning towards each other, a line between them and an accent badge on it holding a link, its ring
// spreading twice, motion allowing. The title mark is two files joined by a line.
// Every app's Connect File uses it, so it lives here (@liveworkspace/ui/dialog-hero-art/connect-file).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Two files joined by a line, in the accent. */
export const CONNECT_FILE_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.5" y="4" width="6" height="8" rx="1.5" />
    <rect x="11.5" y="8" width="6" height="8" rx="1.5" />
    <path d="M8.5 8h1.75a1.25 1.25 0 0 1 1.25 1.25V12" />
  </g>
);

// A file card with its corner folded, top left at (x, y), 22 wide, standing tall enough to run off the band's foot.
function file(x: number, y: number, fill: string) {
  return (
    <>
      <path
        d={`M${x + 3} ${y}h13l6 6v32H${x}V${y + 3}a3 3 0 0 1 3-3Z`}
        fill={fill}
        stroke="var(--hero-line)"
      />
      <path
        d={`M${x + 16} ${y}v4a2 2 0 0 0 2 2h4`}
        fill="var(--hero-soft)"
        stroke="var(--hero-line)"
        strokeLinejoin="round"
      />
      <rect x={x + 4} y={y + 11} width="12" height="2.5" rx="1.25" fill="var(--hero-mark)" />
      <rect x={x + 4} y={y + 16} width="8" height="2.5" rx="1.25" fill="var(--hero-line)" />
    </>
  );
}

const PIECES = (
  <>
    {/* Two files leaning in, the line between them, and the link badge on it. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      className={`${HERO_PLACE.bottomRight} overflow-visible`}
    >
      <g transform="rotate(-6 23 20)">{file(12, 6, 'var(--hero-plate)')}</g>
      <g transform="rotate(6 77 20)">{file(66, 6, 'var(--hero-wash)')}</g>
      <path
        d="M36 19h24"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <circle
        cx="48"
        cy="19"
        r="7"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.25"
        className={HERO_MOTION.ring}
      />
      <circle cx="48" cy="19" r="7" fill="var(--hero-accent)" />
      <path
        d="M46.8 20.2l2.4-2.4M47.6 16.4l.8-.8a1.75 1.75 0 0 1 2.5 2.5l-.8.8M48.4 21.6l-.8.8a1.75 1.75 0 0 1-2.5-2.5l.8-.8"
        fill="none"
        stroke="var(--hero-plate)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  </>
);

export const connectFileHeroArt: HeroArt = {
  name: 'connect-file',
  glyph: CONNECT_FILE_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
