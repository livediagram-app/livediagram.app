// The retired parts dialog's hero art (docs/specs/006-document/offline-mode.md "Moving retired parts to the other
// apps"), drawn in the dialog hero header's tokens: pages, boards and designs set aside in this browser, each off
// to the app that is now its home. A faint grid fades in from the title's side; in the bottom right three cards
// rise off the band's foot, a page of lines, a board of columns and a design of shapes, each with an arrow out at
// its corner; the board's is in the accent and the board lifts twice, motion allowing. The title mark is an arrow
// leaving a box.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// A part's card and the arrow out at its top right corner.
function card(x: number, y: number, arrow: string, opacity?: number) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width="26"
        height="34"
        rx="4.5"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <path
        d={`M${x + 17.5} ${y + 4.5}h4v4m0-4-4.5 4.5`}
        fill="none"
        stroke={arrow}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    </>
  );
}

const PIECES = (
  <svg
    {...HERO_SVG}
    width="94"
    height="30"
    viewBox="0 0 94 30"
    className={HERO_PLACE.bottomRight}
    data-retired-parts-art=""
  >
    {/* A page: lines of writing. */}
    {card(1, 9, 'var(--hero-mark)', 0.6)}
    <path
      d="M6 16h9M6 21.5h16M6 27h12"
      stroke="var(--hero-mark)"
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.55"
    />
    {/* A design: a frame's shapes. */}
    {card(67, 9, 'var(--hero-mark)', 0.6)}
    <circle cx="76" cy="24" r="4.5" fill="var(--hero-mark)" opacity="0.55" />
    <rect
      x="80"
      y="19"
      width="9"
      height="12"
      rx="2"
      fill="var(--hero-wash)"
      stroke="var(--hero-line)"
    />
    {/* A board: columns of cards, on its way. */}
    <g className={HERO_MOTION.float}>
      {card(34, 4, 'var(--hero-accent)')}
      <rect x="38.5" y="14" width="5" height="9" rx="1.5" fill="var(--hero-mark)" />
      <rect x="45.5" y="14" width="5" height="14" rx="1.5" fill="var(--hero-accent)" />
      <rect x="52.5" y="14" width="5" height="6" rx="1.5" fill="var(--hero-mark)" />
      <rect x="38.5" y="25" width="5" height="9" rx="1.5" fill="var(--hero-mark)" opacity="0.5" />
      <rect x="52.5" y="22" width="5" height="9" rx="1.5" fill="var(--hero-mark)" opacity="0.5" />
    </g>
  </svg>
);

export const retiredPartsHeroArt: HeroArt = {
  name: 'retired-parts',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 5.5h-3a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3" />
      <path d="M12 3.5h4.5V8M16.5 3.5l-7 7" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
