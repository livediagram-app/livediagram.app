// Send to Plan's hero art (liveworkspace/docs/specs/004-index/send-to-plan.md "The picker"): words in one app becoming
// a card on a plan's board. A grid fades in from the title's side; in the bottom right a sticky stands at the edge,
// a dashed arc runs from it to a board of three columns rising off the band's foot, and the new card, in the accent,
// drops into the middle column, bobbing twice, motion allowing. The title mark is a board of three columns, a card in
// the middle one. Every editor's picker is workbench's one, so it lives here
// (@liveworkspace/ui/dialog-hero-art/send-to-plan).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A board of three columns, a card in the middle one, in the accent. */
export const SEND_TO_PLAN_GLYPH = (
  <>
    <rect
      x="2.75"
      y="3.75"
      width="14.5"
      height="12.5"
      rx="2.25"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.7"
    />
    <path
      d="M7.75 4.5v11M12.25 4.5v11"
      stroke="var(--hero-accent)"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <rect x="8.75" y="6.5" width="2.5" height="4" rx="0.75" fill="var(--hero-accent)" />
  </>
);

// The board's columns: where each starts and the cards already in it (their tops).
const COLUMNS = [
  { x: 43, cards: [12, 20] },
  { x: 60, cards: [21] },
  { x: 77, cards: [12] },
] as const;

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {/* The place the words came from: a sticky, a little turned. */}
    <g transform="rotate(-8 14 22)">
      <rect
        x="3"
        y="12"
        width="22"
        height="22"
        rx="2.5"
        fill="var(--hero-wash)"
        stroke="var(--hero-line)"
      />
      <rect x="7" y="17" width="13" height="2.25" rx="1.1" fill="var(--hero-mark)" />
      <rect x="7" y="22" width="9" height="2.25" rx="1.1" fill="var(--hero-line)" />
    </g>
    <path
      d="M24 10C30 2 36 1 41 4"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 2.5"
      strokeLinecap="round"
    />
    {/* The board, rising from the edge: three columns, each headed, holding its cards. */}
    <rect
      x="39"
      y="3"
      width="55"
      height="32"
      rx="4"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {COLUMNS.map(({ x, cards }) => (
      <g key={x}>
        <rect x={x} y="6.5" width="14" height="2.5" rx="1.25" fill="var(--hero-line)" />
        {cards.map((top) => (
          <rect
            key={top}
            x={x}
            y={top}
            width="14"
            height="6"
            rx="1.5"
            fill="var(--hero-soft)"
            stroke="var(--hero-faint)"
          />
        ))}
      </g>
    ))}
    {/* The new card, dropping in at the head of the middle column. */}
    <g className={HERO_MOTION.float}>
      <rect x="59" y="11" width="16" height="8" rx="2" fill="var(--hero-accent)" />
      <rect x="62" y="14" width="8" height="2" rx="1" fill="var(--hero-plate)" />
    </g>
  </svg>
);

export const sendToPlanHeroArt: HeroArt = {
  name: 'send-to-plan',
  glyph: SEND_TO_PLAN_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
