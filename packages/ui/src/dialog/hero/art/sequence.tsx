// The Sequence Diagram dialog's hero art (docs/specs/009-elements, the sequence diagram): who calls whom, in order.
// A grid fades in from the title's side; in the bottom right three participants stand in a row, their dashed
// lifelines running down off the band's foot, a call crossing from the first to the second, an activation bar where
// it lands, and the next call going on to the third in the accent, a ring spreading twice where it arrives. The
// title's side stays plain paper. The title mark is two lifelines, a call going out and its reply coming back.
// Every app with a Sequence Diagram draws it, so it lives here (@liveworkspace/ui/dialog-hero-art/sequence).
import { HERO_MOTION, HERO_PLACE, HERO_SVG, heroTexture, type HeroArt } from '../hero-art';

/** Two lifelines, a call going out and its reply coming back, in the accent. */
export const SEQUENCE_GLYPH = (
  <g
    fill="none"
    stroke="var(--hero-accent)"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 2.5v15M16 2.5v15" opacity="0.55" />
    <path d="M4.5 7h9.5M11.5 4.5 14 7l-2.5 2.5" />
    <path d="M15.5 13H6M8.5 10.5 6 13l2.5 2.5" />
  </g>
);

// The participants' lifelines, left to right.
const FIRST = 13;
const SECOND = 48;
const THIRD = 83;
const LANES = [FIRST, SECOND, THIRD];

const PIECES = (
  <svg
    {...HERO_SVG}
    width="96"
    height="30"
    viewBox="0 0 96 30"
    // The arriving call's ring spreads past the box; the band still clips at its own edge.
    overflow="visible"
    className={HERO_PLACE.bottomRight}
  >
    {LANES.map((x) => (
      <g key={x}>
        {/* A lifeline, then the participant at its head. */}
        <path d={`M${x} 9v21`} stroke="var(--hero-mark)" strokeDasharray="2.5 2.5" opacity="0.7" />
        <rect
          x={x - 11.5}
          y="0.5"
          width="23"
          height="9"
          rx="3"
          fill="var(--hero-plate)"
          stroke="var(--hero-line)"
        />
        <rect x={x - 6} y="3.5" width="12" height="3" rx="1.5" fill="var(--hero-mark)" />
      </g>
    ))}
    {/* The first call, and the activation it starts. */}
    <path
      d={`M${FIRST} 15.5H${SECOND - 4}m-3.5-3 3.5 3-3.5 3`}
      fill="none"
      stroke="var(--hero-mark)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x={SECOND - 2.5}
      y="13"
      width="5"
      height="14"
      rx="1.5"
      fill="var(--hero-plate)"
      stroke="var(--hero-mark)"
    />
    {/* The call that follows, in the accent, arriving. */}
    <path
      d={`M${SECOND + 3.5} 22.5H${THIRD - 8}m-3.5-3 3.5 3-3.5 3`}
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx={THIRD}
      cy="22.5"
      r="5.5"
      fill="none"
      stroke="var(--hero-accent)"
      strokeWidth="1.25"
      className={HERO_MOTION.ring}
    />
    <circle cx={THIRD} cy="22.5" r="2.5" fill="var(--hero-accent)" />
  </svg>
);

export const sequenceHeroArt: HeroArt = {
  name: 'sequence',
  glyph: SEQUENCE_GLYPH,
  texture: heroTexture('grid', { fade: true }),
  pieces: PIECES,
};
