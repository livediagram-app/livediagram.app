// View As Diagram's hero art (liveplanner/docs/specs/026-plan/view-as-diagram.md "The dialog"): a board drawn as a flow.
// Rings spread from the bottom right corner; there a small board's column of cards stands on the left, and on the right
// three boxes in two lanes joined by arrows, the critical one in the accent, bobbing twice, motion allowing. The title
// mark is three boxes joined in a flow.
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Three boxes joined in a flow, in the accent. */
export const VIEW_AS_DIAGRAM_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="5.5" height="5" rx="1.2" />
    <rect x="12.5" y="3" width="5.5" height="5" rx="1.2" />
    <rect x="12.5" y="12" width="5.5" height="5" rx="1.2" />
    <path d="M7.5 5.5h5M4.75 8v6.5h7.75" />
  </g>
);

const PIECES = (
  <svg
    {...HERO_SVG}
    width="136"
    height="36"
    viewBox="0 0 136 36"
    className={`${HERO_PLACE.bottomRight} overflow-visible`}
  >
    {/* The board: a column with three cards, running off the band's foot. */}
    <rect x="4" y="4" width="30" height="40" rx="4" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <rect x="8" y="9" width="22" height="6" rx="2" fill="var(--hero-wash)" />
    <rect x="8" y="18" width="22" height="6" rx="2" fill="var(--hero-wash)" />
    <rect x="8" y="27" width="22" height="6" rx="2" fill="var(--hero-soft)" />
    <path
      d="M40 18h10"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 3"
      strokeLinecap="round"
    />
    {/* The drawing: two lanes, three boxes, arrows; the critical box in the accent. */}
    <path d="M56 17h76" stroke="var(--hero-faint)" />
    <rect x="58" y="4" width="20" height="10" rx="2.5" fill="var(--hero-wash)" stroke="var(--hero-line)" />
    <rect x="86" y="21" width="20" height="10" rx="2.5" fill="var(--hero-plate)" stroke="var(--hero-line)" />
    <path
      d="M78 9h4a2 2 0 0 1 2 2v13a2 2 0 0 0 2 2"
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
    <path d="M106 26h6" stroke="var(--hero-accent)" strokeWidth="1.6" strokeLinecap="round" />
    <g className={HERO_MOTION.float}>
      <rect x="112" y="20" width="20" height="12" rx="3" fill="var(--hero-accent)" />
      <path d="M117 26h10" stroke="var(--hero-plate)" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  </svg>
);

export const viewAsDiagramHeroArt: HeroArt = {
  name: 'view-as-diagram',
  glyph: VIEW_AS_DIAGRAM_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
