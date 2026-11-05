// Feature illustrations: images, keyboard shortcuts and the session tools, split from ./features.
// Same stage and parts (./features-parts) as the rest of the features cards.

import { VoteSticky, MUTED, PANEL, PanelShadow, STRONG, SUBTLE, VIEW } from './features-parts';
import {
  AMBER,
  EMERALD,
  Frame,
  PINK,
  SKY,
  VIOLET,
} from '@liveworkspace/marketing-site/components/feature-art/shared';

/** The session tools: a timer draining on the canvas, dot votes landing, and the Done check. */
export function SessionToolsArt() {
  const people = [SKY, PINK, VIOLET, EMERALD, AMBER];
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

        {/* Dot votes on the ideas. */}
        <VoteSticky x={124} fill="#fde68a" ink="#78350f" label="Ship v2" votes={4} i={0} />
        <VoteSticky x={174} fill="#fbcfe8" ink="#831843" label="Onboarding" votes={2} i={1} />
        <VoteSticky x={224} fill="#bbf7d0" ink="#14532d" label="Dark mode" votes={3} i={2} />

        {/* The Done check: who has marked themselves finished. */}
        <PanelShadow x={124} y={62} w={144} h={20} r={10} />
        <rect className={PANEL} x="124" y="62" width="144" height="20" rx="10" strokeWidth="1" />
        <circle cx="134" cy="72" r="5" fill={EMERALD} />
        <path
          d="M131.8 72 L133.5 73.7 L136.3 70.5"
          fill="none"
          stroke="#fff"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text className={STRONG} x="143" y="74.2" fontSize="6.2" fontWeight="700">
          Done?
        </text>
        {people.map((c, i) => (
          <g key={c} transform={`translate(${184 + i * 15} 72)`}>
            <circle r="5" fill={c} opacity={i === 4 ? 0.35 : 1} />
            {i < 4 ? (
              <g className="fa-pop" style={{ animationDelay: `${1.6 + i * 0.3}s` }}>
                <circle cx="3.6" cy="3.4" r="2.6" fill={EMERALD} stroke="#fff" strokeWidth="0.8" />
                <path
                  d="M2.5 3.4 L3.3 4.2 L4.7 2.7"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />
              </g>
            ) : null}
          </g>
        ))}
      </svg>
    </Frame>
  );
}
