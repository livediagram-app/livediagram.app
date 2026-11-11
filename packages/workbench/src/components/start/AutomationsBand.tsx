// The Automations band (liveplanner's docs/specs/026-plan/automations.md "The Automations screen"): the start header's
// band (StartHeaderBand) drawn for a rule screen instead of an app's hero. Under it a faint grid of dots, fading out
// toward the title so the words sit on plain paper; in the bottom left a cog rising from the edge, in the bottom right
// a looping arrow; and, where there is room (from `lg`, clear of the title's line and the header's buttons), a rule as
// a flow: a trigger's bolt, a condition's diamond and an action's check joined by a line, a dashed arrow looping back
// over them. The bolt's ring spreads twice, motion allowing. CSS gradients and small inline SVGs, nothing fetched, no
// filter.
import type { CSSProperties } from 'react';
import { DOTS_PX } from '@liveworkspace/explorer/hero-theme';
import type { StartBandColours } from './start-band-colours';

// The bolt's ring spreads twice, from its own centre; reduced motion keeps it still.
const RING =
  'motion-safe:animate-empty-ring [animation-iteration-count:2] [transform-box:fill-box] [transform-origin:center]';

// The flow stands between the title's line (which wraps short of it from `lg`) and the header's buttons.
const FLOW = 'absolute right-[12.5rem] top-1/2 hidden -translate-y-1/2 lg:block';

/** The dots, fading in from the title's side. */
export function automationsTexture(band: StartBandColours): CSSProperties {
  return {
    backgroundImage: [
      `linear-gradient(90deg, ${band.paper} 0 34%, transparent 72%)`,
      `radial-gradient(${band.line} 1px, transparent 1px)`,
    ].join(', '),
    backgroundSize: `100% 100%, ${DOTS_PX}px ${DOTS_PX}px`,
  };
}

// A cog's outline: eight teeth round a ring, centred on (0, 0), radius 15.
const COG = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const at = (r: number, d: number) =>
    `${(r * Math.cos(a + d)).toFixed(2)} ${(r * Math.sin(a + d)).toFixed(2)}`;
  return `L${at(11, -0.3)} L${at(15, -0.17)} L${at(15, 0.17)} L${at(11, 0.3)}`;
})
  .join(' ')
  .replace(/^L/, 'M')
  .concat(' Z');

export function AutomationsBandPieces({ band }: { band: StartBandColours }) {
  return (
    <>
      {/* A cog rising from the bottom left. */}
      <svg width="40" height="22" viewBox="-20 -20 40 22" className="absolute bottom-0 left-2">
        <path d={COG} fill={band.wash} />
        <circle r="5" fill={band.paper} />
      </svg>
      {/* A looping arrow rising from the bottom right. */}
      <svg width="44" height="24" viewBox="0 0 44 24" className="absolute bottom-0 right-3">
        <path
          d="M8 26A14 14 0 1 1 34 20"
          fill="none"
          stroke={band.line}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M29 15l6 6 1-8" fill="none" stroke={band.line} strokeWidth="3" strokeLinecap="round" />
      </svg>
      {/* A rule as a flow: When, If, Then, and round again. */}
      <svg width="176" height="64" viewBox="0 0 176 64" className={FLOW} data-automations-flow="">
        <path
          d="M146 26C146 6 22 6 22 24"
          fill="none"
          stroke={band.mark}
          strokeWidth="1.25"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
        <path d="M18.5 19.5L22 25l3.5-5.5" fill="none" stroke={band.mark} strokeWidth="1.25" />
        <path d="M34 38H66M92 38H130" stroke={band.line} strokeWidth="1.5" />
        <path d="M62 34.5L67 38l-5 3.5M126 34.5l5 3.5-5 3.5" fill={band.line} />
        {/* The trigger: a bolt on the accent, its ring spreading. */}
        <circle cx="22" cy="38" r="11" fill="none" stroke={band.accent} strokeWidth="1.5" className={RING} />
        <circle cx="22" cy="38" r="11" fill={band.accent} />
        <path d="M23.5 31L17.5 39.5h4.5L20.5 45l6-8.5H22Z" fill={band.plate} />
        {/* The condition: a diamond. */}
        <rect
          x="70"
          y="29"
          width="18"
          height="18"
          rx="3"
          transform="rotate(45 79 38)"
          fill={band.plate}
          stroke={band.mark}
          strokeWidth="1.25"
        />
        <circle cx="79" cy="38" r="2.5" fill={band.mark} />
        {/* The action: a card done. */}
        <rect x="132" y="27" width="30" height="22" rx="6" fill={band.plate} stroke={band.line} />
        <path
          d="M141 38l3.5 3.5L153 33"
          fill="none"
          stroke={band.accent}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
