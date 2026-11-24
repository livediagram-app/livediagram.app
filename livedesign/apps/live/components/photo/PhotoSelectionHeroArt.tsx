// The Select menu's dialogs' hero art, Colour Range and the Modify dialogs (docs/specs/031-photo/photo-tools.md
// "Selecting"), drawn in the dialog hero header's tokens: dots fading out toward the title; and in the bottom
// right a selection rising off the band's foot, a loose shape with a dashed edge, and round it the edge it is
// being changed to, wider and in the accent. At its heart is the colour sampled, a dot in the accent whose ring
// spreads twice, motion allowing. The title mark is a dashed ring round a dot.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

// The selection's shape, standing on the foot.
const SHAPE = 'M22 32C18 20 28 11 40 13C46 5 64 6 68 15C78 16 82 26 78 32Z';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    className={HERO_PLACE.bottomRight}
    data-photo-selection-art=""
  >
    {/* The edge it grows to. */}
    <path
      d={SHAPE}
      transform="translate(50 32) scale(1.22) translate(-50 -32)"
      fill="var(--hero-soft)"
      stroke="var(--hero-accent)"
      strokeWidth="1.1"
      strokeDasharray="3 2.4"
      strokeLinecap="round"
    />
    {/* The selection as it is. */}
    <path
      d={SHAPE}
      fill="var(--hero-wash)"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3.5 2.5"
      strokeLinecap="round"
    />
    {/* The colour sampled. */}
    <circle
      cx="50"
      cy="21"
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="50" cy="21" r="2.5" fill="var(--hero-accent)" />
  </svg>
);

export const photoSelectionHeroArt: HeroArt = {
  name: 'photo-selection',
  glyph: (
    <g stroke="var(--hero-accent)">
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        strokeWidth="1.7"
        strokeDasharray="3.1 2.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="2" fill="var(--hero-accent)" stroke="none" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
