// Describe a Rule's hero art, and the drawing every Describe with AI dialog shares
// (liveworkspace/docs/specs/018-automations/automations.md "Describe a Rule"; liveplanner's Describe a Plan and
// Describe a Form draw the same with their own ending), in the dialog hero header's tokens: rings spreading from the
// bottom right; and there the person's words, a speech bubble of two lines with the accent's sparkle on its corner
// (its ring spreading twice, motion allowing), a dashed arrow, and what the words become, the one thing that
// differs: here a bolt, a diamond and a tick joined in a line (a rule). No centre piece. The title mark is the
// sparkle, a small one at its shoulder.
// Describe a Rule is @liveworkspace/automations-ui's, every app's, so it lives here
// (@liveworkspace/ui/dialog-hero-art/describe-rule); `describeHeroArt` draws the family for an app's own dialog.
import type { ReactNode } from 'react';
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** The family's ink: the mark's stroke, round. */
export const DESCRIBE_INK = {
  fill: 'none',
  stroke: 'var(--hero-mark)',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** A plate rising off the band: the paper's fill, the line's edge. */
export const DESCRIBE_PLATE = { fill: 'var(--hero-plate)', stroke: 'var(--hero-line)' } as const;

// A rule: a trigger's bolt, a condition's diamond and an action's tick, joined in a line.
const FLOW = (
  <>
    <path d="M66 17h20" {...DESCRIBE_INK} stroke="var(--hero-line)" strokeWidth="1.5" />
    <rect x="54" y="10" width="14" height="14" rx="4.5" {...DESCRIBE_PLATE} />
    <path d="M62.2 12.8l-3.9 5h2.5l-.9 3.4 3.9-5h-2.5Z" fill="var(--hero-mark)" />
    <path d="M76.5 11.5l5.5 5.5-5.5 5.5-5.5-5.5Z" {...DESCRIBE_PLATE} strokeLinejoin="round" />
    <circle cx="90" cy="17" r="5" {...DESCRIBE_PLATE} />
    <path d="M87.7 17.1l1.7 1.7 2.9-3.3" {...DESCRIBE_INK} strokeWidth="1.5" />
  </>
);

/** A Describe dialog's art: the words, the sparkle, and `becomes`, drawn in a 96 x 30 box from x = 52 on. */
export function describeHeroArt(name: string, becomes: ReactNode): HeroArt {
  return {
    name,
    glyph: (
      <g fill="var(--hero-accent)">
        <path d="M9 4.5C9.9 9 11 10.1 15.5 11C11 11.9 9.9 13 9 17.5C8.1 13 7 11.9 2.5 11C7 10.1 8.1 9 9 4.5Z" />
        <path d="M15.5 2C15.8 3.7 16.3 4.2 18 4.5C16.3 4.8 15.8 5.3 15.5 7C15.2 5.3 14.7 4.8 13 4.5C14.7 4.2 15.2 3.7 15.5 2Z" />
      </g>
    ),
    texture: heroTexture('rings'),
    pieces: (
      <svg
        {...HERO_SVG}
        width="96"
        height="30"
        viewBox="0 0 96 30"
        className={HERO_PLACE.bottomRight}
        data-describe-art={name}
      >
        {/* The person's words: a speech bubble, its tail to the foot. */}
        <path
          d="M8 7h22a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6H14l-6 5v-5a6 6 0 0 1-6-6v-5a6 6 0 0 1 6-6Z"
          {...DESCRIBE_PLATE}
          strokeLinejoin="round"
        />
        <path d="M8.5 13h13M8.5 18h8" {...DESCRIBE_INK} />
        {/* The sparkle on its corner. */}
        <circle
          cx="34"
          cy="8"
          r="6"
          fill="none"
          stroke="var(--hero-accent)"
          strokeWidth="1.5"
          className={HERO_MOTION.ring}
        />
        <path
          d="M34 1.5C34.8 5.8 36.2 7.2 40.5 8C36.2 8.8 34.8 10.2 34 14.5C33.2 10.2 31.8 8.8 27.5 8C31.8 7.2 33.2 5.8 34 1.5Z"
          fill="var(--hero-accent)"
        />
        {/* Becoming: a dashed arrow to what is drafted. */}
        <path d="M40.5 19h8" {...DESCRIBE_INK} strokeWidth="1.5" strokeDasharray="2.5 3" />
        <path d="M47.5 16l3.2 3-3.2 3" {...DESCRIBE_INK} strokeWidth="1.5" />
        {becomes}
      </svg>
    ),
  };
}

export const describeRuleHeroArt = describeHeroArt('describe-rule', FLOW);
