// The Organise in Tab Folder dialog's hero art (each product's docs/specs/006-*/tab-folders.md "Membership UX"): a
// tab filed into a folder on the bar. A grid of dots fades in from the title's side; in the bottom right a folder
// rises from the band's edge, two tabs standing in it and a third, in the accent, dropping in between them, bobbing
// twice, motion allowing. The title mark is a folder holding a tab.
// Every editor's dialog uses it, so it lives here (@liveworkspace/ui/dialog-hero-art/tab-folder).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A folder with a tab's line in it, in the accent. */
export const TAB_FOLDER_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.75 6.25c0-.83.67-1.5 1.5-1.5h3.1c.4 0 .78.16 1.06.44l1.2 1.2h6.14c.83 0 1.5.67 1.5 1.5v6.36c0 .83-.67 1.5-1.5 1.5H4.25c-.83 0-1.5-.67-1.5-1.5z" />
    <path d="M7 11.5h6" />
  </g>
);

// A tab on the bar, top left at (x, y), 20 wide: rounded on top, its name a short line.
function tab(x: number, y: number, fill: string, line: string) {
  return (
    <>
      <path
        d={`M${x} ${y + 30}V${y + 4}a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v26z`}
        fill={fill}
        stroke="var(--hero-line)"
      />
      <rect x={x + 4} y={y + 6} width="12" height="2.5" rx="1.25" fill={line} />
    </>
  );
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {/* The folder's back, with its ear. */}
    <path
      d="M10 40V12a4 4 0 0 1 4-4h16l5 5h47a4 4 0 0 1 4 4v23z"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    {tab(18, 17, 'var(--hero-plate)', 'var(--hero-mark)')}
    {tab(62, 17, 'var(--hero-plate)', 'var(--hero-mark)')}
    <g className={HERO_MOTION.float}>{tab(40, 6, 'var(--hero-accent)', 'var(--hero-plate)')}</g>
    {/* The folder's front lip, over the tabs' feet. */}
    <path
      d="M6 40l3-14h78l3 14z"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
  </svg>
);

export const tabFolderHeroArt: HeroArt = {
  name: 'tab-folder',
  glyph: TAB_FOLDER_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
