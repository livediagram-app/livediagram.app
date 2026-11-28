// Set Up Refinement's hero art (docs/specs/026-plan/session-tabs.md "Making one"), drawn in the dialog hero header's
// tokens: faint dots fading out toward the title, and in the bottom right a short queue of cards, the first ticked and
// the second lit as the one the room is on, its ring spreading twice, motion allowing. The title mark is the session
// tab's checklist.
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
    height="30"
    viewBox="0 0 84 30"
    className={HERO_PLACE.bottomRight}
    data-session-queue-art=""
  >
    {[0, 1, 2].map((i) => {
      const lit = i === 1;
      return (
        <g key={i} transform={`translate(${2 + i * 27} 6)`}>
          <rect
            width="24"
            height="26"
            rx="4"
            fill="var(--hero-plate)"
            stroke={lit ? 'var(--hero-accent)' : 'var(--hero-line)'}
          />
          <rect
            x="5"
            y="6"
            width="14"
            height="2.5"
            rx="1.25"
            fill="var(--hero-mark)"
            opacity="0.5"
          />
          <rect
            x="5"
            y="11"
            width="9"
            height="2.5"
            rx="1.25"
            fill="var(--hero-mark)"
            opacity="0.35"
          />
          {i === 0 ? (
            <path
              d="M8 19l3 3 5-6"
              fill="none"
              stroke="var(--hero-accent)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {lit ? (
            <circle
              cx="12"
              cy="19"
              r="3"
              fill="none"
              stroke="var(--hero-accent)"
              className={HERO_MOTION.ring}
            />
          ) : null}
        </g>
      );
    })}
  </svg>
);

export const sessionHeroArt: HeroArt = {
  name: 'session',
  glyph: (
    <g
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 5l1.5 1.5L7 3.5M2.5 12l1.5 1.5L7 10.5" />
      <path d="M10 5h7.5M10 12h7.5M3 17.5h14.5" />
    </g>
  ),
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
