// Feature illustrations: the meeting clocks, split from ./features.
// Same stage and parts (./features-parts) as the rest of the features cards.

import { IdeaSticky, MUTED, PANEL, PanelShadow, STRONG, SUBTLE, VIEW } from './features-parts';
import { EMERALD, Frame, SKY } from '@liveworkspace/marketing-site/components/feature-art/shared';

/** The meeting clocks: a Timer piece draining on a room's wall, a Stopwatch counting up, a note beside them. */
export function SessionToolsArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* The timer element. */}
        <PanelShadow x={14} y={14} w={92} h={68} r={6} />
        <rect className={PANEL} x="14" y="14" width="92" height="68" rx="6" strokeWidth="1" />
        <g
          className="stroke-slate-500 dark:stroke-slate-400"
          fill="none"
          strokeWidth="1"
          transform="translate(23 24)"
        >
          <circle r="3.2" />
          <path d="M0 -1.6 V0 L1.2 0.9" strokeLinecap="round" />
        </g>
        <text className={SUBTLE} x="30" y="26.2" fontSize="6" fontWeight="600">
          Timer
        </text>
        <text
          className={STRONG}
          x="60"
          y="52"
          textAnchor="middle"
          fontSize="19"
          fontWeight="700"
          letterSpacing="-0.4"
        >
          04:12
        </text>
        <rect className={MUTED} x="24" y="60" width="72" height="3.5" rx="1.75" />
        <rect className="fa-b-drain" x="24" y="60" width="72" height="3.5" rx="1.75" fill={SKY} />
        <g transform="translate(52 73)">
          <circle r="5" fill={SKY} />
          <path d="M-1.4 -2 V2 M1.4 -2 V2" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
        </g>
        <g
          transform="translate(68 73)"
          className="stroke-slate-500 dark:stroke-slate-400"
          fill="none"
          strokeWidth="1"
        >
          <circle r="5" className="fill-slate-100 stroke-none dark:fill-slate-800" />
          <path d="M1.8 -1.6 A2.4 2.4 0 1 0 2.4 0.6" strokeLinecap="round" />
          <path d="M2.4 -2.8 V-1.2 H0.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* The Stopwatch piece, counting up. */}
        <PanelShadow x={118} y={14} w={92} h={68} r={6} />
        <rect className={PANEL} x="118" y="14" width="92" height="68" rx="6" strokeWidth="1" />
        <g
          className="stroke-slate-500 dark:stroke-slate-400"
          fill="none"
          strokeWidth="1"
          transform="translate(127 24)"
        >
          <circle r="3.2" cy="0.4" />
          <path d="M0 -1.2 V0.4 M-1 -3.8 H1" strokeLinecap="round" />
        </g>
        <text className={SUBTLE} x="134" y="26.2" fontSize="6" fontWeight="600">
          Stopwatch
        </text>
        <text
          className={STRONG}
          x="164"
          y="52"
          textAnchor="middle"
          fontSize="19"
          fontWeight="700"
          letterSpacing="-0.4"
        >
          12:47
        </text>
        <g transform="translate(164 70)">
          <circle r="5" fill={EMERALD} />
          <path d="M-1.4 -2 V2 M1.4 -2 V2" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
        </g>

        {/* The stand-up's notes on the wall beside them. */}
        <IdeaSticky x={226} fill="#fde68a" ink="#78350f" label="Ship v2" />
      </svg>
    </Frame>
  );
}
