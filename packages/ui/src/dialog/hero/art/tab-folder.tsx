// The Organise in Tab Folder dialog's hero art (each app's TabOrganiseDialogs: file the tab into a folder on the
// tab bar). Faint dots fade in from the title's side; in the bottom right a folder rises off the band's foot with
// two tabs filed in its pocket and a third, in the accent, dropping in beside them, bobbing twice, motion
// allowing. The title mark is a folder holding a tab.
// Every app's dialog draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/tab-folder).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

// A tab filed in the folder: a chip with its name, standing up out of the pocket.
function tab(x: number) {
  return (
    <g key={x}>
      <rect
        x={x}
        y="13"
        width="18"
        height="24"
        rx="3.5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect x={x + 4} y="17" width="10" height="3" rx="1.5" fill="var(--hero-mark)" />
    </g>
  );
}

const PIECES = (
  <svg {...HERO_SVG} width="86" height="30" viewBox="0 0 86 30" className={HERO_PLACE.bottomRight}>
    {/* The folder's back, its lip at the left. */}
    <path
      d="M7 38V8a4 4 0 0 1 4-4h14l5 5.5h45a4 4 0 0 1 4 4V38Z"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
      strokeLinejoin="round"
    />
    {[14, 35].map(tab)}
    {/* The tab being filed. */}
    <g className={HERO_MOTION.float}>
      <rect x="56" y="6" width="18" height="30" rx="3.5" fill="var(--hero-accent)" />
      <rect x="60" y="10.5" width="10" height="3" rx="1.5" fill="var(--hero-plate)" />
    </g>
    {/* The pocket, in front of the tabs. */}
    <path
      d="M2 38V28a4 4 0 0 1 4-4h74a4 4 0 0 1 4 4v10Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
  </svg>
);

export const tabFolderHeroArt: HeroArt = {
  name: 'tab-folder',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3.2l1.8 2h6A1.5 1.5 0 0 1 17 8.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5Z" />
      <path d="M7 11.75h6" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
