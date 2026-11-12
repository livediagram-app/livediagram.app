// Configure Board's hero art (docs/specs/026-plan/plan-board.md "Configure"), drawn in the dialog hero header's
// tokens: a board being set up. A faint grid fading toward the title; in the bottom left two swimlanes, a person at the
// start of each and cards along them; in the bottom right three columns, the middle one lifted out of its dashed slot
// and tilted, as if being dragged to a new place, bobbing twice, motion allowing. The title mark is a board's columns.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

/** A board's columns, the middle one shorter: the title mark of the board's own dialogs. */
export const BOARD_COLUMNS_GLYPH = (
  <g fill="var(--hero-accent)">
    <rect x="2" y="2.5" width="4.5" height="15" rx="1.75" />
    <rect x="7.75" y="2.5" width="4.5" height="10" rx="1.75" />
    <rect x="13.5" y="2.5" width="4.5" height="12.5" rx="1.75" />
  </g>
);

// A swimlane: a soft bar with a person at its start and two cards along it.
function lane(y: number) {
  return (
    <g>
      <rect
        x="2"
        y={y}
        width="92"
        height="11"
        rx="3.5"
        fill="var(--hero-soft)"
        stroke="var(--hero-faint)"
      />
      <circle cx="9" cy={y + 5.5} r="3" fill="var(--hero-line)" />
      <rect
        x="17"
        y={y + 2.5}
        width="22"
        height="6"
        rx="2"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect
        x="43"
        y={y + 2.5}
        width="16"
        height="6"
        rx="2"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
    </g>
  );
}

// A column rising from the bottom edge: its head, and two cards in it.
function column(x: number, fill: string, head: string) {
  return (
    <g>
      <rect x={x} y="6" width="24" height="30" rx="5" fill={fill} stroke="var(--hero-line)" />
      <rect x={x + 4} y="10" width="12" height="3" rx="1.5" fill={head} />
      <rect
        x={x + 4}
        y="16"
        width="16"
        height="6"
        rx="2"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <rect
        x={x + 4}
        y="25"
        width="16"
        height="6"
        rx="2"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
    </g>
  );
}

const PIECES = (
  <>
    {/* Swimlanes: a row per person. */}
    <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomLeft}>
      {lane(4)}
      {lane(18)}
    </svg>
    {/* Columns, the middle one being dragged out of its slot. It bobs up past the box, so the box lets it. */}
    <svg
      {...HERO_SVG}
      width="96"
      height="30"
      viewBox="0 0 96 30"
      overflow="visible"
      className={HERO_PLACE.bottomRight}
    >
      {column(4, 'var(--hero-soft)', 'var(--hero-mark)')}
      {column(68, 'var(--hero-soft)', 'var(--hero-mark)')}
      <rect
        x="36"
        y="8"
        width="24"
        height="28"
        rx="5"
        fill="none"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="3 3"
      />
      <g className={HERO_MOTION.float}>
        <g transform="rotate(-7 50 18)">{column(38, 'var(--hero-plate)', 'var(--hero-accent)')}</g>
      </g>
    </svg>
  </>
);

export const boardConfigureHeroArt: HeroArt = {
  name: 'board-configure',
  glyph: BOARD_COLUMNS_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
