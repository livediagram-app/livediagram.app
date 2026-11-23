// The Add to Another Canvas dialog's hero art (each product's docs/specs/006-*/tab-document-many-to-many.md; Add to
// Design, Add to Document, Add to Another Space and Add to Knowledgebase alike): one tab, live in two files. Rings
// spread from the bottom right, where two files rise from the band's edge side by side, the same tab, in the accent,
// standing on both, a dashed line joining the two and its ring spreading twice from the first, motion allowing. The
// title mark is a tab shared by two files.
// Every editor's dialog uses it, so it lives here (@liveworkspace/ui/dialog-hero-art/add-to-another).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Two files, one over the other, with a plus: the tab added to a second, in the accent. */
export const ADD_TO_ANOTHER_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2.75" y="5.75" width="10" height="11.5" rx="2" />
    <path d="M6.5 5.75V4.5c0-.97.78-1.75 1.75-1.75h7c.97 0 1.75.78 1.75 1.75v9c0 .97-.78 1.75-1.75 1.75h-2.5" />
    <path d="M7.75 9.5v4M5.75 11.5h4" />
  </g>
);

// A file's window rising from the foot, top left at (x, y), 36 wide: a bar of tabs over its canvas, the shared tab in
// the accent.
function file(x: number, y: number) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width="36"
        height="36"
        rx="5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect x={x + 4} y={y + 4} width="9" height="5" rx="2" fill="var(--hero-line)" />
      <rect x={x + 15} y={y + 4} width="11" height="5" rx="2" fill="var(--hero-accent)" />
      <path d={`M${x} ${y + 12.5}h36`} stroke="var(--hero-line)" />
      <rect x={x + 5} y={y + 17} width="14" height="2.5" rx="1.25" fill="var(--hero-mark)" />
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
    {file(6, 10)}
    {file(56, 4)}
    <path
      d="M26.5 9.5C32 -1 62 -5 76.5 3.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      strokeDasharray="3 3"
      strokeLinecap="round"
    />
    <circle
      cx="26.5"
      cy="16.5"
      r="5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
  </svg>
);

export const addToAnotherHeroArt: HeroArt = {
  name: 'add-to-another',
  glyph: ADD_TO_ANOTHER_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
