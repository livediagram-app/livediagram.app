// The Automations screen's hero art (docs/specs/026-plan/automations.md "The Automations screen"), drawn in the dialog
// hero header's tokens: a faint grid of dots fading out toward the title, so the words sit on plain paper; in the
// bottom right a looping arrow; and, where the header is wide enough
// (the centre piece, clear of the title's line and the buttons), a rule as a flow: a trigger's bolt, a condition's
// diamond and an action's check joined by a line, a dashed arrow looping back over them. The bolt's ring spreads
// twice, motion allowing. The title mark is a bolt, what sets a rule off.
import {
  HERO_MOTION,
  HERO_PLACE,
  HERO_SVG,
  heroTexture,
  type HeroArt,
} from '@liveworkspace/ui/dialog-hero';

const PIECES = (
  <>
    {/* A looping arrow rising from the bottom right. */}
    <svg
      {...HERO_SVG}
      width="44"
      height="24"
      viewBox="0 0 44 24"
      className={HERO_PLACE.bottomRight}
    >
      <path
        d="M8 26A14 14 0 1 1 34 20M29 15l6 6 1-8"
        fill="none"
        stroke="var(--hero-line)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
    {/* A rule as a flow: When, If, Then, and round again. */}
    <svg
      {...HERO_SVG}
      width="176"
      height="64"
      viewBox="0 0 176 64"
      className={HERO_PLACE.centre}
      data-automations-flow=""
    >
      <path
        d="M146 26C146 6 22 6 22 24"
        fill="none"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <path d="M18.5 19.5L22 25l3.5-5.5" fill="none" stroke="var(--hero-mark)" strokeWidth="1.25" />
      <path d="M34 38H66M92 38H130" stroke="var(--hero-line)" strokeWidth="1.5" />
      <path d="M62 34.5L67 38l-5 3.5M126 34.5l5 3.5-5 3.5" fill="var(--hero-line)" />
      {/* The trigger: a bolt on the accent, its ring spreading. */}
      <circle
        cx="22"
        cy="38"
        r="11"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.5"
        className={HERO_MOTION.ring}
      />
      <circle cx="22" cy="38" r="11" fill="var(--hero-accent)" />
      <path d="M23.5 31L17.5 39.5h4.5L20.5 45l6-8.5H22Z" fill="var(--hero-plate)" />
      {/* The condition: a diamond. */}
      <rect
        x="70"
        y="29"
        width="18"
        height="18"
        rx="3"
        transform="rotate(45 79 38)"
        fill="var(--hero-plate)"
        stroke="var(--hero-mark)"
        strokeWidth="1.25"
      />
      <circle cx="79" cy="38" r="2.5" fill="var(--hero-mark)" />
      {/* The action: a card done. */}
      <rect
        x="132"
        y="27"
        width="30"
        height="22"
        rx="6"
        fill="var(--hero-plate)"
        stroke="var(--hero-line)"
      />
      <path
        d="M141 38l3.5 3.5L153 33"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </>
);

export const automationsHeroArt: HeroArt = {
  name: 'automations',
  glyph: <path d="M11.5 1.75L4.5 11.25h5L8.25 18.25l7.25-9.75h-5Z" fill="var(--hero-accent)" />,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
  centre: true,
};
