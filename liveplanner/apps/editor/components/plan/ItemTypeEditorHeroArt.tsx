// The type editor's hero art (docs/specs/026-plan/item-types.md "Editing a type"), drawn in the dialog hero header's
// tokens: a faint grid fading out toward the title, a drawing board; and in the bottom right the card type as a
// pattern rising off the band's foot, its glyph tile in the accent (its ring spreading twice, motion allowing), its
// name and its fields, with two cards cut from it stepping away behind, each smaller. No centre piece. The title mark
// is a card with its glyph tile and its lines.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const LINE = {
  fill: 'none',
  stroke: 'var(--hero-line)',
  strokeWidth: 2,
  strokeLinecap: 'round',
} as const;

const PIECES = (
  // The pattern in front, the cards cut from it behind.
  <svg
    {...HERO_SVG}
    width="94"
    height="30"
    viewBox="0 0 94 30"
    className={HERO_PLACE.bottomRight}
    data-card-type-pattern=""
  >
    {/* The furthest card. */}
    <rect
      x="72"
      y="18"
      width="20"
      height="20"
      rx="4"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
    />
    <rect x="76" y="22" width="5" height="5" rx="1.5" fill="var(--hero-line)" />
    {/* The nearer card. */}
    <rect
      x="50"
      y="12"
      width="26"
      height="26"
      rx="4.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="62" y="16.5" width="6.5" height="6.5" rx="1.8" fill="var(--hero-mark)" opacity="0.6" />
    <path d="M62 27.5h10" {...LINE} />
    {/* The pattern: a glyph tile, a name, two fields with their values. */}
    <rect
      x="12"
      y="4"
      width="44"
      height="34"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-mark)"
    />
    <circle
      cx="22.5"
      cy="13.5"
      r="6.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <rect x="17.5" y="8.5" width="10" height="10" rx="3" fill="var(--hero-accent)" />
    <path d="M22.5 10.7l2.8 2.8-2.8 2.8-2.8-2.8Z" fill="var(--hero-plate)" />
    <path d="M32 13.5h15" {...LINE} stroke="var(--hero-mark)" strokeWidth="2.4" />
    <path d="M18 25h8" {...LINE} />
    <rect x="31" y="22" width="17" height="6" rx="3" fill="var(--hero-wash)" />
  </svg>
);

export const itemTypeEditorHeroArt: HeroArt = {
  name: 'card-type',
  glyph: (
    <>
      <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.75" strokeLinecap="round">
        <rect x="2.75" y="2.75" width="14.5" height="14.5" rx="3.75" />
        <path d="M12.25 7.75h2M6 13h8" />
      </g>
      <rect x="5.75" y="5.75" width="4" height="4" rx="1.1" fill="var(--hero-accent)" />
    </>
  ),
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
