// Subscribe to Calendar's hero art (docs/specs/026-plan/calendar-feed.md "The dialog"; blueprint "Presentation and
// UX"), drawn in the dialog hero header's tokens: a faint grid fading out toward the title, so the words sit on plain
// paper; and in the bottom right a month page rising off the band's foot, one day filled in (a card's date, landed),
// its ring spreading twice, motion allowing. No centre piece: the dialog is never wide enough to show one. The title
// mark is a calendar page.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// The month's days: four rows of seven (the page runs off the band's foot), the filled one at row 1, column 4.
const DAYS = Array.from({ length: 28 }, (_, i) => ({ col: i % 7, row: Math.floor(i / 7) }));
const FILLED = { col: 4, row: 1 };

const PIECES = (
  // A month rising from the bottom right, one day filled in: a card's date, landed.
  <svg
    {...HERO_SVG}
    width="64"
    height="46"
    viewBox="0 0 64 46"
    className={HERO_PLACE.bottomRight}
    data-calendar-feed-month=""
  >
    <rect
      x="1"
      y="4"
      width="62"
      height="50"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M1 13h62" stroke="var(--hero-line)" />
    <path d="M14 1v6M50 1v6" stroke="var(--hero-line)" strokeWidth="2.5" strokeLinecap="round" />
    {DAYS.map(({ col, row }) =>
      col === FILLED.col && row === FILLED.row ? null : (
        <rect
          key={`${col}.${row}`}
          x={6 + col * 7.6}
          y={17 + row * 7}
          width="4.5"
          height="3.5"
          rx="1"
          fill="var(--hero-mark)"
          opacity="0.5"
        />
      ),
    )}
    <circle
      cx={8.25 + FILLED.col * 7.6}
      cy={18.75 + FILLED.row * 7}
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <rect
      x={5 + FILLED.col * 7.6}
      y={16 + FILLED.row * 7}
      width="6.5"
      height="5.5"
      rx="1.5"
      fill="var(--hero-accent)"
    />
  </svg>
);

export const calendarFeedHeroArt: HeroArt = {
  name: 'calendar-feed',
  glyph: (
    <>
      <rect
        x="2.75"
        y="4"
        width="14.5"
        height="13.5"
        rx="2.5"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
      />
      <path
        d="M2.75 8.5h14.5M6.5 2.25v3.5M13.5 2.25v3.5"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="11" y="11.25" width="3.5" height="3.5" rx="0.75" fill="var(--hero-accent)" />
    </>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
