// The Get Started popover's hero art (livediagram/docs/specs/007-editor/watch-it-built.md "The start panel", every
// app's tour alike): a short path of lessons. Dots fade in from the title's side; in the bottom right a dashed trail
// climbs from the edge through three lessons, the first two ticked, to a play badge in the accent at its end, its ring
// spreading twice, motion allowing. The title mark is a play button in a circle. Every app's Get Started draws it, so it
// lives here (@liveworkspace/ui/dialog-hero-art/get-started).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** A play button in a circle, in the accent. */
export const GET_STARTED_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="10" cy="10" r="7.5" />
    <path d="M8.4 7v6l4.8-3z" fill="var(--hero-accent)" />
  </g>
);

// The lessons along the trail, left to right, each a little higher than the last.
const STEPS = [
  { x: 10, y: 24 },
  { x: 36, y: 19 },
  { x: 60, y: 14 },
];
const END = { x: 84, y: 11 };

const PIECES = (
  <svg {...HERO_SVG} width="96" height="30" viewBox="0 0 96 30" className={HERO_PLACE.bottomRight}>
    {/* The trail: from the edge, through each lesson, to the play badge. */}
    <path
      d={`M0 29C6 27 ${STEPS[0]!.x - 4} ${STEPS[0]!.y + 2} ${STEPS[0]!.x} ${STEPS[0]!.y}S${STEPS[1]!.x - 6} ${STEPS[1]!.y} ${STEPS[1]!.x} ${STEPS[1]!.y}S${STEPS[2]!.x - 6} ${STEPS[2]!.y} ${STEPS[2]!.x} ${STEPS[2]!.y}S${END.x - 8} ${END.y} ${END.x} ${END.y}`}
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.25"
      strokeDasharray="3 3"
      strokeLinecap="round"
    />
    {STEPS.map((s, i) => (
      <g key={s.x}>
        <circle
          cx={s.x}
          cy={s.y}
          r="4.25"
          fill="var(--hero-plate)"
          stroke={i < 2 ? 'var(--hero-mark)' : 'var(--hero-line)'}
          strokeWidth="1.25"
        />
        {i < 2 ? (
          <path
            d={`M${s.x - 1.9} ${s.y}l1.3 1.3 2.5-2.6`}
            fill="none"
            stroke="var(--hero-mark)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </g>
    ))}
    <circle
      cx={END.x}
      cy={END.y}
      r="6.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx={END.x} cy={END.y} r="6.5" fill="var(--hero-accent)" />
    <path d={`M${END.x - 1.6} ${END.y - 2.8}v5.6l4.4-2.8z`} fill="var(--hero-plate)" />
  </svg>
);

export const getStartedHeroArt: HeroArt = {
  name: 'get-started',
  glyph: GET_STARTED_GLYPH,
  texture: heroTexture('dots', { fade: true }),
  pieces: PIECES,
};
