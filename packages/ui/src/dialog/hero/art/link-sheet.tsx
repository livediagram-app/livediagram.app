// The Link to Sheet dialog's hero art (each reader app's docs/specs/009-elements/pie-chart.md "Charts linked to a
// liveplanner sheet"): a chart kept in step with a range of a sheet. A faint grid fades in from the title's side, the
// sheet's own cells; in the bottom right a sheet rises from the edge with a range picked out in the accent, a line
// running from it through a link (its ring spreading twice) to the bars it draws, the tallest in the accent. The title
// mark is a sheet with one range filled.
// One dialog for livedocuments, livediagram and livedesign, so it lives here
// (@liveworkspace/ui/dialog-hero-art/link-sheet).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A sheet with one range filled, in the accent. */
export const LINK_SHEET_GLYPH = (
  <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.7" strokeLinejoin="round">
    <rect x="3" y="3.5" width="14" height="13" rx="2.5" />
    <path d="M3 8h14M8 8v8.5" strokeWidth="1.3" />
    <rect x="10" y="10.1" width="5" height="2.6" rx="0.9" fill="var(--hero-accent)" stroke="none" />
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
    {/* The sheet: a header row, three columns, and the range picked. */}
    <path
      d="M12 31V10a4 4 0 0 1 4-4h34a4 4 0 0 1 4 4v21Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M12 13h42M12 21h42M12 29h42M24 6v25M39 6v25" stroke="var(--hero-line)" />
    <rect x="15" y="8.25" width="6" height="2.5" rx="1.25" fill="var(--hero-mark)" />
    <rect x="27" y="8.25" width="8" height="2.5" rx="1.25" fill="var(--hero-mark)" />
    <rect x="42" y="8.25" width="7" height="2.5" rx="1.25" fill="var(--hero-mark)" />
    <rect
      x="24"
      y="13"
      width="30"
      height="16"
      fill="var(--hero-soft)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
    />
    <path d="M39 13v16M24 21h30" stroke="var(--hero-line)" />
    {/* The bars the range draws. */}
    <rect x="68" y="18" width="7" height="14" rx="1.75" fill="var(--hero-line)" />
    <rect x="77" y="8" width="7" height="24" rx="1.75" fill="var(--hero-accent)" />
    <rect x="86" y="14" width="7" height="18" rx="1.75" fill="var(--hero-mark)" />
    {/* The link between them. */}
    <path d="M54 21h14" stroke="var(--hero-mark)" strokeWidth="1.25" strokeDasharray="2.5 2.5" />
    <circle
      cx="61"
      cy="21"
      r="3.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="61" cy="21" r="3" fill="var(--hero-accent)" />
  </svg>
);

export const linkSheetHeroArt: HeroArt = {
  name: 'link-sheet',
  glyph: LINK_SHEET_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
