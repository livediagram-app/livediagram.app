// Add a Field's hero art (docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field; Edit Field wears it too),
// drawn in the dialog hero header's tokens: a faint grid fading out toward the title, so the words sit on plain paper;
// and in the bottom right three field tiles rising off the band's foot, each a step taller: one of text, one a ticked
// checkbox, and the new one, a dashed place in the accent with a plus, its ring spreading twice, motion allowing. No
// centre piece. The title mark is a field with a plus at its corner.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const INK = {
  fill: 'none',
  stroke: 'var(--hero-mark)',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const PIECES = (
  // Three field tiles rising from the bottom right, the new one waiting in the accent.
  <svg
    {...HERO_SVG}
    width="86"
    height="30"
    viewBox="0 0 86 30"
    className={HERO_PLACE.bottomRight}
    data-add-field-tiles=""
  >
    {/* A text field: two lines of writing. */}
    <rect
      x="2"
      y="12"
      width="24"
      height="24"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M7.5 19.5h8M7.5 25h13" {...INK} />
    {/* A checkbox field, ticked. */}
    <rect
      x="30"
      y="7"
      width="24"
      height="29"
      rx="5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="35.5" y="12.5" width="9" height="9" rx="2.5" {...INK} strokeWidth="1.6" />
    <path d="M37.8 17l1.8 1.8 2.9-3.4" {...INK} strokeWidth="1.6" />
    <path d="M35.5 26.5h12" {...INK} stroke="var(--hero-line)" />
    {/* The new field: a dashed place, the accent's plus. */}
    <rect
      x="58"
      y="2.5"
      width="24"
      height="34"
      rx="5"
      fill="var(--hero-soft)"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      strokeDasharray="3 3"
    />
    <circle
      cx="70"
      cy="15.5"
      r="6.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <circle cx="70" cy="15.5" r="6.5" fill="var(--hero-accent)" />
    <path
      d="M70 12.3v6.4M66.8 15.5h6.4"
      stroke="var(--hero-plate)"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

export const addFieldHeroArt: HeroArt = {
  name: 'add-field',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="8.5" width="11" height="9" rx="2.5" />
      <path d="M5.5 13h5M15.5 2.5v5M13 5h5" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
