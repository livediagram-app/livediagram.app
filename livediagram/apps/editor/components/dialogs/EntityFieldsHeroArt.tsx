// The Fields dialog's hero art (docs/specs/009-elements/entity.md "The Fields dialog"), drawn in the dialog hero
// header's tokens: a faint grid fading out toward the title, so the words sit on plain paper; and in the bottom
// right an entity rising off the band's foot, a title over three fields, the first field's key in the accent, its
// ring spreading twice, motion allowing. No centre piece: the dialog is never wide enough to show one. The title
// mark is a table: a header over rows.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// The fields' rows: the key dot, the name and, at the right, the type. The box runs off the band's foot.
const ROWS = [
  { y: 23, name: 14, type: 12 },
  { y: 31, name: 22, type: 9 },
  { y: 39, name: 17, type: 14 },
];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="76"
    height="46"
    viewBox="0 0 76 46"
    className={HERO_PLACE.bottomRight}
    data-entity-fields-art=""
  >
    <rect
      x="1"
      y="4"
      width="74"
      height="50"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {/* The title bar. */}
    <path d="M1 16.5h74" stroke="var(--hero-line)" />
    <rect x="8" y="8.5" width="24" height="4" rx="2" fill="var(--hero-mark)" />
    {ROWS.map(({ y, name, type }, i) => (
      <g key={y}>
        {i === 0 ? null : <circle cx="10" cy={y} r="2" fill="var(--hero-mark)" opacity="0.5" />}
        <rect x="17" y={y - 1.75} width={name} height="3.5" rx="1.75" fill="var(--hero-mark)" />
        <rect
          x={68 - type}
          y={y - 1.75}
          width={type}
          height="3.5"
          rx="1.75"
          fill="var(--hero-mark)"
          opacity="0.45"
        />
      </g>
    ))}
    {/* The first field's key. */}
    <circle
      cx="10"
      cy={ROWS[0]!.y}
      r="5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <circle cx="10" cy={ROWS[0]!.y} r="2.5" fill="var(--hero-accent)" />
  </svg>
);

export const entityFieldsHeroArt: HeroArt = {
  name: 'entity-fields',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3" y="3.5" width="14" height="13" rx="2.5" />
      <path d="M3 8h14" />
      <path d="M3 12.25h14" strokeWidth="1.2" opacity="0.7" />
    </g>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
