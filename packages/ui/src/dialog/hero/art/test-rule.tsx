// Test Rule's hero art (liveworkspace/docs/specs/018-automations/automations.md "Test Rule and Run Rule": the rule
// tried as a dry run), worn by the test's answer in every app and by liveplanner's card picker before it (Test on a
// Card), drawn in the dialog hero header's tokens: the Automations screen's dots fading out toward the title; and in
// the bottom right the rule, a bolt tile, a dashed arrow from it to the card it is tried on, rising off the band's
// foot, and on the card's corner the answer, a tick badge in the accent, its ring spreading twice, motion allowing.
// No centre piece. The title mark is a flask.
// The dialog is @liveworkspace/automations-ui's, every app's, so it lives here
// (@liveworkspace/ui/dialog-hero-art/test-rule).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const INK = {
  fill: 'none',
  stroke: 'var(--hero-mark)',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const LINE = {
  fill: 'none',
  stroke: 'var(--hero-line)',
  strokeWidth: 2,
  strokeLinecap: 'round',
} as const;

const PIECES = (
  // The rule, tried on a card.
  <svg
    {...HERO_SVG}
    width="90"
    height="30"
    viewBox="0 0 90 30"
    className={HERO_PLACE.bottomRight}
    data-test-rule-art=""
  >
    {/* The rule: its bolt. */}
    <rect
      x="2"
      y="10"
      width="17"
      height="17"
      rx="5.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M11.7 13.3l-4.5 6h3l-1 4.4 4.5-6h-3Z" fill="var(--hero-mark)" />
    <path d="M23 18.5h13" {...INK} strokeDasharray="2.5 3" />
    <path d="M35 15.5l3.2 3-3.2 3" {...INK} />
    {/* The card. */}
    <rect
      x="43"
      y="7"
      width="40"
      height="32"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <path d="M49 15h14" {...LINE} stroke="var(--hero-mark)" strokeWidth="2.4" />
    <path d="M49 21h27M49 26.5h20" {...LINE} />
    {/* The answer. */}
    <circle
      cx="81"
      cy="9"
      r="6"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <circle cx="81" cy="9" r="6" fill="var(--hero-accent)" />
    <path
      d="M78.2 9.1l2 2 3.6-4.2"
      fill="none"
      stroke="var(--hero-plate)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const testRuleHeroArt: HeroArt = {
  name: 'test-rule',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.25 2.75h5.5M8.25 2.75v4.6l-4.3 7.3a1.75 1.75 0 0 0 1.5 2.6h9.1a1.75 1.75 0 0 0 1.5-2.6l-4.3-7.3v-4.6" />
      <path d="M6.25 12.5h7.5" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
