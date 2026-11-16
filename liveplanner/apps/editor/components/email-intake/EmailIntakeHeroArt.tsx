// Email to Board's hero art (docs/specs/026-plan/email-to-board.md "The dialog"), drawn in the dialog hero header's
// tokens: faint dots fading toward the title, and in the bottom right an envelope on a dashed path into a board
// column, where the card it became sits first and lit, its ring spreading out, motion allowing. The title mark is an
// envelope, as the tab menu's row.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const PIECES = (
  <svg
    {...HERO_SVG}
    width="84"
    height="46"
    viewBox="0 0 84 46"
    className={HERO_PLACE.bottomRight}
    data-email-intake-art=""
  >
    {/* The envelope, tilted on its way in. */}
    <g transform="translate(2 10) rotate(-8 11 8)">
      <rect
        width="22"
        height="15"
        rx="2.5"
        fill="var(--hero-plate)"
        stroke="var(--hero-accent)"
        strokeWidth="1.25"
      />
      <path
        d="M1.5 2L11 9L20.5 2"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <path
      d="M27 16C35 12 41 12 47 16"
      fill="none"
      stroke="var(--hero-line)"
      strokeWidth="1.25"
      strokeDasharray="2 2.5"
      strokeLinecap="round"
    />
    <path
      d="M44.5 13.5L47.5 16L44 17.5"
      fill="none"
      stroke="var(--hero-line)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* The board's first column: the new card on top, lit. */}
    <g transform="translate(52 4)">
      <rect width="28" height="50" rx="4" fill="var(--hero-plate)" stroke="var(--hero-line)" />
      <g transform="translate(3 4)">
        <rect
          width="22"
          height="10"
          rx="2"
          fill="var(--hero-plate)"
          stroke="var(--hero-accent)"
          className={HERO_MOTION.ring}
        />
        <rect x="3" y="3.5" width="11" height="1.5" rx="0.75" fill="var(--hero-accent)" />
        <rect x="3" y="6" width="7" height="1.25" rx="0.6" fill="var(--hero-mark)" />
      </g>
      {[17, 29].map((y) => (
        <rect
          key={y}
          x="3"
          y={y}
          width="22"
          height="9"
          rx="2"
          fill="var(--hero-mark)"
          opacity="0.45"
        />
      ))}
    </g>
  </svg>
);

export const emailIntakeHeroArt: HeroArt = {
  name: 'email-intake',
  glyph: (
    <>
      <rect
        x="2.5"
        y="4.5"
        width="15"
        height="11"
        rx="2"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
      />
      <path
        d="M3.5 6l6.5 4.5L16.5 6"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
