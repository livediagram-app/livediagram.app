// The rule summary's hero art (liveworkspace/docs/specs/018-automations/automations.md "Who may do what": a rule as
// a Participant or a Viewer reads it), drawn in the dialog hero header's tokens: the Automations screen's dots fading
// out toward the title; and in the bottom right the rule as a card rising off the band's foot (its bolt tile, its
// name, a step under it), with a reader's eye beside it in the accent, looking and changing nothing, its ring
// spreading twice, motion allowing. No centre piece. The title mark is an eye whose pupil is the bolt.
// The sheet is @liveworkspace/automations-ui's, every app's, so it lives here
// (@liveworkspace/ui/dialog-hero-art/rule-summary).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

const LINE = {
  fill: 'none',
  stroke: 'var(--hero-line)',
  strokeWidth: 2,
  strokeLinecap: 'round',
} as const;

const PIECES = (
  // The rule's card, and the eye reading it.
  <svg
    {...HERO_SVG}
    width="90"
    height="30"
    viewBox="0 0 90 30"
    className={HERO_PLACE.bottomRight}
    data-rule-summary-art=""
  >
    <rect
      x="2"
      y="5"
      width="52"
      height="34"
      rx="6"
      fill="var(--hero-plate)"
      stroke="var(--hero-line)"
    />
    <rect x="7.5" y="10" width="12" height="12" rx="3.75" fill="var(--hero-wash)" />
    <path d="M14.3 12.3l-3.5 4.5h2.3l-.8 3 3.5-4.5h-2.3Z" fill="var(--hero-mark)" />
    <path d="M24.5 13.5h20" {...LINE} stroke="var(--hero-mark)" strokeWidth="2.4" />
    <path d="M24.5 19h12" {...LINE} />
    <circle cx="13.5" cy="28" r="2" fill="var(--hero-line)" />
    <path d="M24.5 28h23" {...LINE} />
    {/* The reader's eye. */}
    <circle
      cx="74"
      cy="16"
      r="4.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      className={HERO_MOTION.ring}
    />
    <path
      d="M61 16c3.2-5.7 7.5-8.5 13-8.5s9.8 2.8 13 8.5c-3.2 5.7-7.5 8.5-13 8.5s-9.8-2.8-13-8.5Z"
      fill="var(--hero-plate)"
      stroke="var(--hero-accent)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="74" cy="16" r="3.75" fill="var(--hero-accent)" />
  </svg>
);

export const ruleSummaryHeroArt: HeroArt = {
  name: 'rule-summary',
  glyph: (
    <>
      <path
        d="M1.75 10c2.2-3.9 5-5.75 8.25-5.75S16.05 6.1 18.25 10c-2.2 3.9-5 5.75-8.25 5.75S3.95 13.9 1.75 10Z"
        fill="none"
        stroke="var(--hero-accent)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M11 6.5l-3.1 4h2.1l-1 3 3.1-4h-2.1Z" fill="var(--hero-accent)" />
    </>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
