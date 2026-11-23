// The Practice Sheet's hero art (docs/specs/026-plan/plan-tour.md "Sheets: Five Small Wins"), drawn in the dialog hero
// header's tokens: a faint grid fading out toward the title, a sheet's own cells; and in the bottom right a small
// sheet rising off the band's foot, its heading row, a few cells filled, and the cell being practised on selected in
// the accent, a tick in it and the fill handle at its corner, its ring spreading twice, motion allowing. No centre
// piece. The title mark is a sheet with one cell filled.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const VALUE = {
  fill: 'none',
  stroke: 'var(--hero-mark)',
  strokeWidth: 2,
  strokeLinecap: 'round',
  opacity: 0.55,
} as const;

const PIECES = (
  // A small sheet, one cell selected and won.
  <svg
    {...HERO_SVG}
    width="90"
    height="30"
    viewBox="0 0 90 30"
    className={HERO_PLACE.bottomRight}
    data-practice-sheet=""
  >
    <rect
      x="4"
      y="3"
      width="82"
      height="36"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {/* The heading row, then the cells' rules. */}
    <path d="M4.5 11h81V8a4.5 4.5 0 0 0-4.5-4.5H9A4.5 4.5 0 0 0 4.5 8Z" fill="var(--hero-soft)" />
    <path d="M4 11h82" stroke="var(--hero-line)" />
    <path d="M24 3v27M45 3v27M66 3v27M4 20h82" stroke="var(--hero-faint)" />
    <path d="M9 7h8M29 7h10M50 7h7M71 7h9" {...VALUE} stroke="var(--hero-line)" opacity="1" />
    <path d="M9 15.5h10M29 15.5h7M71 15.5h8M9 25h7M29 25h11" {...VALUE} />
    {/* The cell in hand. */}
    <circle
      cx="55.5"
      cy="15.5"
      r="5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <rect
      x="45"
      y="11"
      width="21"
      height="9"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
    />
    <path
      d="M52.3 15.6l2.1 2.1 3.7-4.3"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="64.2" y="18.2" width="3.6" height="3.6" rx="0.8" fill="var(--hero-accent)" />
  </svg>
);

export const practiceSheetHeroArt: HeroArt = {
  name: 'practice-sheet',
  glyph: (
    <>
      <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.75" strokeLinecap="round">
        <rect x="2.75" y="3.25" width="14.5" height="13.5" rx="2.75" />
        <path d="M2.75 7.75h14.5M8 7.75v9" />
      </g>
      <rect x="10.5" y="10.25" width="4.25" height="3.75" rx="0.8" fill="var(--hero-accent)" />
    </>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
