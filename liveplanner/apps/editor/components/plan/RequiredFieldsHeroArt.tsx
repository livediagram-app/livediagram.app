// The required fields prompt's hero art (docs/specs/026-plan/item-types.md "Required fields": a new card whose type
// has required fields asks for them first), drawn in the dialog hero header's tokens: a grid of dots fading out toward
// the title, so the words sit on plain paper; and in the bottom right the new card rising off the band's foot, two
// fields on it each marked with the accent's asterisk: the first filled in, the second waiting, edged in the accent
// with a caret, its asterisk's ring spreading twice, motion allowing. No centre piece. The title mark is a field
// holding an asterisk.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const ACCENT = {
  fill: 'none',
  stroke: 'var(--hero-accent)',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
} as const;

const LABEL = {
  fill: 'none',
  stroke: 'var(--hero-line)',
  strokeWidth: 2,
  strokeLinecap: 'round',
} as const;

// An asterisk of three strokes about its centre.
const asterisk = (x: number, y: number) =>
  `M${x} ${y - 2.9}v5.8M${x - 2.5} ${y - 1.45}l5 2.9M${x + 2.5} ${y - 1.45}l-5 2.9`;

const PIECES = (
  // The new card: one required field filled in, the next waiting.
  <svg
    {...HERO_SVG}
    width="72"
    height="30"
    viewBox="0 0 72 30"
    className={HERO_PLACE.bottomRight}
    data-required-fields-card=""
  >
    <rect
      x="2"
      y="3"
      width="66"
      height="36"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    {/* Filled in. */}
    <path d="M8 11.5h9" {...LABEL} />
    <path d={asterisk(22, 11.5)} {...ACCENT} />
    <rect
      x="31"
      y="7.5"
      width="31"
      height="8"
      rx="2.5"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
    />
    <path d="M35 11.5h14" {...LABEL} stroke="var(--hero-mark)" />
    {/* Waiting. */}
    <path d="M8 23.5h6" {...LABEL} />
    <circle cx="19" cy="23.5" r="4.5" {...ACCENT} className={HERO_MOTION.ring} />
    <path d={asterisk(19, 23.5)} {...ACCENT} />
    <rect x="31" y="19.5" width="31" height="8" rx="2.5" {...ACCENT} fill="var(--hero-paper)" />
    <path d="M35 21.7v3.6" {...ACCENT} />
  </svg>
);

export const requiredFieldsHeroArt: HeroArt = {
  name: 'required-fields',
  glyph: (
    <g fill="none" stroke="var(--hero-accent)" strokeWidth="1.75" strokeLinecap="round">
      <rect x="2.75" y="4.25" width="14.5" height="11.5" rx="3" />
      <path d={asterisk(10, 10)} />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
