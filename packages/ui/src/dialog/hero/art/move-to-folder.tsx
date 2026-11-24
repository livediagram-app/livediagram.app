// The Move dialog's hero art (liveworkspace/docs/specs/004-index/one-explorer.md, moving to a folder): something
// lifted out of one folder and set down in another. A faint grid of dots fades in from the title's side; in the bottom
// right two folders rise from the edge, the one it leaves sitting back, the one it goes to lifted off the paper, and
// between them the thing itself in the accent, carried over on a dashed arc, bobbing twice. The title mark is a folder
// with an arrow going into it.
// The Explorer's Move, in every app, so it lives here (@liveworkspace/ui/dialog-hero-art/move-to-folder).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';
import { HERO_FOLDER_OUTLINE, heroFolder } from './default-folders';

/** A folder with an arrow going into it, in the accent. */
export const MOVE_TO_FOLDER_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={HERO_FOLDER_OUTLINE} />
    <path d="M6.8 11.2h5.8M10.6 9.2l2 2-2 2" strokeWidth="1.5" />
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
    {heroFolder(12, 16, 30, 'var(--hero-wash)')}
    {heroFolder(58, 11, 34, 'var(--hero-plate)')}
    <rect x="64" y="22" width="17" height="3" rx="1.5" fill="var(--hero-line)" />
    {/* The way over, and where it lands. */}
    <path
      d="M28 15C36 7 50 6 60 11"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeDasharray="3 3"
    />
    <path
      d="M56.4 7.9l3.9 3.3-5 1"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* What is being moved. */}
    <g className={HERO_MOTION.float}>
      <g transform="rotate(-7 44 8)">
        <rect x="37.5" y="3" width="13" height="10" rx="2.5" fill="var(--hero-accent)" />
        <rect x="40" y="6" width="7" height="1.75" rx="0.875" fill="var(--hero-plate)" />
        <rect x="40" y="9" width="4.5" height="1.75" rx="0.875" fill="var(--hero-plate)" />
      </g>
    </g>
  </svg>
);

export const moveToFolderHeroArt: HeroArt = {
  name: 'move-to-folder',
  glyph: MOVE_TO_FOLDER_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
