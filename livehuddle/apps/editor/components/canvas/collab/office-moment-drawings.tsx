'use client';

// The small drawings the office pieces' moments are made of (OfficeMoments.tsx): a spreading ring, drips, a
// breeze, a dart, a printed page, steam, cold puffs, a gleam, a sparrow and the rest, each one-shot CSS on transform
// and opacity (app/piece-moments-office.css).

import { useId } from 'react';
import { type Side } from '@/lib/piece-moments';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { vars } from './moment-kit';

// Steam and cold air: a light slate on light paper, where white vanishes; lighter on dark.
function useVapour(): string {
  return useCanvasSurface() === 'dark' ? '#e2e8f0' : '#cbd5e1';
}

// A ring spreading out and fading: water from a drop, sound from a microphone.
export function Ring({
  x,
  y,
  rx,
  ry,
  stroke,
  delay,
}: {
  x: number;
  y: number;
  rx: number;
  ry: number;
  stroke: string;
  delay: number;
}) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx={rx}
      ry={ry}
      fill="none"
      stroke={stroke}
      strokeWidth={1.2}
      vectorEffect="non-scaling-stroke"
      className="lh-moment lh-moment-ripple"
      style={vars({ '--delay': `${delay}s` })}
    />
  );
}

// Drops falling from a tap into the basin below it, a ring for each.
export function Drips({
  x,
  y,
  fall,
  basin,
  delays,
}: {
  x: number;
  y: number;
  fall: number;
  basin: number;
  delays: readonly number[];
}) {
  return (
    <>
      {delays.map((delay) => (
        <g key={delay}>
          <circle
            cx={x}
            cy={y}
            r={1}
            fill="#38bdf8"
            className="lh-moment lh-moment-drip"
            style={vars({ '--fall': `${fall}px`, '--dur': '0.42s', '--delay': `${delay}s` })}
          />
          <Ring x={x} y={basin} rx={3.4} ry={1.1} stroke="#ffffff" delay={delay + 0.3} />
        </g>
      ))}
    </>
  );
}

// Two streaks of breeze across the canopy, from your side.
export function Breeze({ side }: { side: Side }) {
  const stroke = useCanvasSurface() === 'dark' ? '#cbd5e1' : '#94a3b8';
  const from = side < 0 ? -14 : 120;
  return (
    <>
      {(
        [
          [26, 0],
          [44, 0.22],
        ] as const
      ).map(([y, delay]) => (
        <path
          key={y}
          d={`M${from} ${y}q5 -3 10 0t10 0`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.3}
          strokeLinecap="round"
          className="lh-moment lh-moment-sweep"
          style={vars({
            '--dx': `${-side * 70}px`,
            '--dy': '0px',
            '--peak': 0.8,
            '--dur': '1.1s',
            '--delay': `${delay}s`,
          })}
        />
      ))}
    </>
  );
}

// A dart flying in from your side to stick by the bull, its flights the way it came.
export function Dart({ side }: { side: Side }) {
  return (
    <g transform="translate(41 48)">
      <g
        className="lh-moment lh-moment-dart"
        style={vars({ '--dx': `${side * 38}px`, '--dy': '-16px' })}
      >
        <g transform={`scale(${side} 1)`}>
          <path d="M0 0L7 -7" stroke="#334155" strokeWidth={1.4} strokeLinecap="round" />
          <path d="M7 -7l7 -1l-3 -2zM7 -7l1 -7l2 3z" fill="#f472b6" />
        </g>
      </g>
    </g>
  );
}

// A printed page sliding out of the slot, seen only below it.
export function PrintedPage() {
  const clip = useId();
  return (
    <>
      <clipPath id={clip}>
        <rect x={8} y={38} width={56} height={40} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g transform="translate(23 20)">
          <g className="lh-moment lh-moment-page">
            <rect width={26} height={18} rx={1} fill="#ffffff" stroke="#cbd5e1" strokeWidth={0.7} />
            <path
              d="M4 5h14M4 9h18M4 13h10"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeLinecap="round"
            />
          </g>
        </g>
      </g>
    </>
  );
}

// The light bar sweeping under the lid, then a copy landing on the top tray.
export function Copy() {
  return (
    <>
      <rect
        x={8}
        y={29}
        width={10}
        height={3}
        rx={1.5}
        fill="#67e8f9"
        className="lh-moment lh-moment-sweep"
        style={vars({ '--dx': '62px', '--dy': '0px', '--peak': 0.95, '--dur': '0.9s' })}
      />
      <g className="lh-moment lh-moment-land">
        <rect
          x={18}
          y={5}
          width={46}
          height={11}
          rx={2}
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth={0.7}
        />
        <path d="M22 9H54M22 12.5H46" stroke="#94a3b8" strokeWidth={1} strokeLinecap="round" />
      </g>
    </>
  );
}

// Cold air spilling out of the door seal and sinking.
export function ColdPuffs() {
  const fill = useVapour();
  return (
    <>
      {[0, 0.2, 0.4].map((delay, i) => (
        <ellipse
          key={delay}
          cx={11 + i * 3}
          cy={47}
          rx={3.4}
          ry={2.2}
          fill={fill}
          className="lh-moment lh-moment-puff"
          style={vars({ '--dx': `${-8 - i * 3}px`, '--rise': '7px', '--delay': `${delay}s` })}
        />
      ))}
    </>
  );
}

// Three puffs of steam out of the spout, rising and spreading.
export function Steam() {
  const fill = useVapour();
  return (
    <>
      {[0, 0.3, 0.6].map((delay, i) => (
        <ellipse
          key={delay}
          cx={4}
          cy={7.5}
          rx={2.2}
          ry={1.8}
          fill={fill}
          className="lh-moment lh-moment-puff"
          style={vars({ '--dx': `${-3 + i * 2}px`, '--rise': '-14px', '--delay': `${delay}s` })}
        />
      ))}
    </>
  );
}

// A band of light sliding across the mirror's glass.
export function MirrorGleam() {
  const clip = useId();
  return (
    <>
      <clipPath id={clip}>
        <rect x={14} y={6} width={44} height={38} rx={3} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path
          d="M8 6H17L2 44H-7Z"
          fill="#ffffff"
          className="lh-moment lh-moment-sweep"
          style={vars({
            '--dx': '58px',
            '--dy': '0px',
            '--peak': 0.85,
            '--dur': '1s',
            '--delay': '0.2s',
          })}
        />
      </g>
    </>
  );
}

// Warm air blowing down out of the nozzle, in two gusts.
export function Air() {
  const stroke = useCanvasSurface() === 'dark' ? '#cbd5e1' : '#94a3b8';
  return (
    <>
      {[0, 0.45].flatMap((gust) =>
        [15.5, 18, 20.5].map((x, i) => (
          <path
            key={`${gust}-${x}`}
            d={`M${x} 41v4`}
            stroke={stroke}
            strokeWidth={1}
            strokeLinecap="round"
            className="lh-moment lh-moment-blow"
            style={vars({ '--delay': `${gust + i * 0.1}s` })}
          />
        )),
      )}
    </>
  );
}

// A band of light down the pillar's shaft.
export function PillarLight() {
  const clip = useId();
  return (
    <>
      <clipPath id={clip}>
        <rect x={7} y={14} width={34} height={122} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect
          x={7}
          y={-4}
          width={34}
          height={18}
          fill="#ffffff"
          className="lh-moment lh-moment-sweep"
          style={vars({ '--dx': '0px', '--dy': '140px', '--peak': 0.7, '--dur': '1.3s' })}
        />
      </g>
    </>
  );
}

// A sparrow dropping onto the capital from your side, hopping, and flying off away from you.
export function Sparrow({ side }: { side: Side }) {
  return (
    <g transform="translate(32 8.4)">
      <g
        className="lh-moment lh-moment-perch"
        style={vars({ '--from-x': `${side * 16}px`, '--to-x': `${-side * 46}px` })}
      >
        <g transform={`scale(${-side} 1)`}>
          <path d="M-2.6 -0.6L-6.4 -1.8L-5.6 0.8Z" fill="#854d0e" />
          <ellipse cx={0} cy={0} rx={3.4} ry={2.4} fill="#a16207" />
          <ellipse cx={0.6} cy={0.8} rx={2.2} ry={1.2} fill="#fde68a" />
          <circle cx={2.9} cy={-1.7} r={1.8} fill="#854d0e" />
          <path d="M4.5 -2.1L6.2 -1.6L4.5 -1.1Z" fill="#f59e0b" />
          <circle cx={3.4} cy={-2.1} r={0.4} fill="#1c1917" />
          <g className="lh-moment lh-moment-beat">
            <path d="M-1.6 -1.2Q0 -4.6 2.4 -1.4Z" fill="#713f12" />
          </g>
        </g>
      </g>
    </g>
  );
}
