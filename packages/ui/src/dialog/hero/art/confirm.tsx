// The confirm dialog's hero art (the one "are you sure?" every app asks, packages/ui/src/dialog/ConfirmDialog.tsx): a
// question and its two answers. Rings spread from the bottom right, where a card rises from the edge holding the
// question's line over two answers, the quiet one in outline and the one that goes ahead in the accent with a check;
// on the card's corner sits the question itself, a badge whose ring spreads twice. Neutral on purpose: it heads a
// delete, a discard and a leave alike. The title mark is a question mark in a circle.
// Every app's confirm draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/confirm).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A question mark in a circle, in the accent. */
export const CONFIRM_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="10" cy="10" r="7.25" />
    <path d="M7.9 8a2.2 2.2 0 1 1 3.3 1.9c-.7.4-1.2.9-1.2 1.7" />
    <path d="M10 14.2v.1" />
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
    {/* The card, the question's line and the two answers. */}
    <path
      d="M28 31V15a6 6 0 0 1 6-6h52a6 6 0 0 1 6 6v16Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="42" y="13" width="34" height="3.5" rx="1.75" fill="var(--hero-mark)" />
    <rect
      x="40"
      y="20.5"
      width="22"
      height="7"
      rx="3.5"
      fill="var(--hero-soft)"
      stroke="var(--hero-line)"
    />
    <rect x="66" y="20.5" width="22" height="7" rx="3.5" fill="var(--hero-accent)" />
    <path
      d="M74.4 24l1.8 1.8 3.4-3.6"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The question, on the card's corner. */}
    <circle
      cx="30"
      cy="11"
      r="6.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx="30" cy="11" r="6.5" fill="var(--hero-accent)" />
    <path
      d="M28.2 9.6a1.9 1.9 0 1 1 2.8 1.7c-.6.3-1 .7-1 1.3M30 14.6v.1"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const confirmHeroArt: HeroArt = {
  name: 'confirm',
  glyph: CONFIRM_GLYPH,
  texture: heroTexture('rings', { from: 'bottom-right' }),
  pieces: PIECES,
};
