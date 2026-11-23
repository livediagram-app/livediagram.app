// The Default Folders dialogs' hero art (liveworkspace/docs/specs/004-index/one-explorer.md, Default Folders): where
// new work lands when no place is chosen. A faint grid fades in from the title's side; in the bottom right a folder
// rises from the edge, a starred badge in the accent on its shoulder marking it the default, and a new file on a
// dashed path dropping into it, bobbing twice. The title mark is a folder with an arrow landing in it.
// Default Folders and the picker of one kind's default folder both draw it, in every app's Explorer, so it lives here
// (@liveworkspace/ui/dialog-hero-art/default-folders).
import type { ReactNode } from 'react';
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** The 20 x 20 folder outline the folder dialogs' title marks share; each adds its own sign inside. */
export const HERO_FOLDER_OUTLINE =
  'M2.5 15V5.5A1.5 1.5 0 0 1 4 4h3.6l1.8 2H16a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15Z';

/** A folder rising from the band's foot: its tab at the top left, `w` wide, its top at `y`. */
export function heroFolder(x: number, y: number, w: number, fill: string): ReactNode {
  return (
    <path
      d={`M${x} 32V${y + 3}a3 3 0 0 1 3-3h11l4 4h${w - 21}a3 3 0 0 1 3 3V32Z`}
      fill={fill}
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
  );
}

/** A folder with an arrow landing in it, in the accent. */
export const DEFAULT_FOLDERS_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={HERO_FOLDER_OUTLINE} />
    <path d="M10 8.4v4.8M8 11.3l2 2 2-2" strokeWidth="1.5" />
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
    {/* The way in: a dashed path from the new file to the folder's mouth. */}
    <path
      d="M35 12c5-7 11-8 16-3"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeDasharray="3 3"
    />
    {heroFolder(46, 7, 44, 'var(--hero-plate)')}
    <rect x="53" y="18" width="20" height="3" rx="1.5" fill="var(--hero-line)" />
    <rect x="53" y="24" width="13" height="3" rx="1.5" fill="var(--hero-line)" />
    {/* The default's badge: a star. */}
    <circle cx="86" cy="12" r="6" fill="var(--hero-accent)" />
    <path
      d="M86 8.6l.85 2.23 2.38.12-1.85 1.5.62 2.3L86 13.45l-2 1.3.62-2.3-1.85-1.5 2.38-.12Z"
      fill="var(--hero-plate)"
    />
    {/* The new file, on its way. */}
    <g className={HERO_MOTION.float}>
      <g transform="rotate(-8 25 15)">
        <path
          d="M21 6h7l4 4v12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
          fill="var(--hero-plate)"
          stroke="var(--hero-mark)"
          strokeLinejoin="round"
        />
        <path d="M28 6v3a1 1 0 0 0 1 1h3" fill="none" stroke="var(--hero-mark)" />
        <rect x="22" y="14" width="7" height="2" rx="1" fill="var(--hero-line)" />
        <rect x="22" y="18" width="5" height="2" rx="1" fill="var(--hero-line)" />
      </g>
    </g>
  </svg>
);

export const defaultFoldersHeroArt: HeroArt = {
  name: 'default-folders',
  glyph: DEFAULT_FOLDERS_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
