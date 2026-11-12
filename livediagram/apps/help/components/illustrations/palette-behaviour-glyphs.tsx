// The glyph chips and small motifs the Behaviour scenes (palette-behaviour.tsx,
// palette-behaviour-reactions.tsx) draw: the round chip a Session or Selection Mode button wears,
// each group's and element's glyph, and the eye on a Reveal cover.

import type { ReactNode } from 'react';

// --- Small motifs the primitive kit does not carry -------------------------

/** The eye a Reveal cover draws above its label. */
export function Eye({ x, y, off = false }: { x: number; y: number; off?: boolean }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className="stroke-slate-500"
      strokeWidth={1.6}
      fill="none"
    >
      <path d="M-9 0s3.6-5 9-5 9 5 9 5-3.6 5-9 5-9-5-9-5z" strokeLinejoin="round" />
      <circle cx={0} cy={0} r={2.4} />
      {off ? <path d="M-7 -7 L7 7" strokeLinecap="round" /> : null}
    </g>
  );
}

/** A round glyph chip, the way a Session or Selection Mode button draws its
 *  tool icon above the words. */
export function Chip({
  x,
  y,
  r = 15,
  children,
}: {
  x: number;
  y: number;
  r?: number;
  children: ReactNode;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} className="fill-brand-50 stroke-brand-200" strokeWidth={1.5} />
      <g transform={`translate(${x} ${y})`}>{children}</g>
    </g>
  );
}

const glyph = { className: 'stroke-brand-600', strokeWidth: 1.8, fill: 'none' } as const;

/** A pointer arrow, the Select mode glyph. */
export function SelectGlyph() {
  return <path d="M-5 -7 L5 2 L0 2.6 L3 8 L0.6 9 L-2 3.6 L-5.4 6.6 Z" className="fill-brand-600" />;
}
/** A 24-unit editor glyph, scaled down onto a chip. */
function Lucide({ children }: { children: ReactNode }) {
  return (
    <g
      transform="scale(0.68) translate(-12 -12)"
      className="stroke-brand-600"
      strokeWidth={2.6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}
/** A question mark in a bubble, the Ask group glyph. */
export function AskGlyph() {
  return (
    <Lucide>
      <path d="M20.5 11.6c0 3.8-3.8 6.9-8.5 6.9-.9 0-1.8-.1-2.6-.3l-5 3.1 1.1-4.5A6.5 6.5 0 0 1 3.5 11.6c0-3.8 3.8-6.9 8.5-6.9s8.5 3.1 8.5 6.9z" />
      <path d="M10.2 9.4a1.9 1.9 0 1 1 2.4 2.2c-.5.2-.8.6-.8 1.1M12 15h.01" />
    </Lucide>
  );
}
/** A raised hand over a card, the Tools group glyph. */
export function WorkshopGlyph() {
  return (
    <Lucide>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8 20h8M12 16.5V20M9 11.5V8.2M12 11.5V7M15 11.5v-2.6" />
    </Lucide>
  );
}
/** A smile, the React group glyph. */
export function SmileGlyph() {
  return (
    <Lucide>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </Lucide>
  );
}
/** An arrow through a doorway, the Navigate group glyph. */
export function DoorGlyph() {
  return (
    <Lucide>
      <path d="M4 20V6.5a1 1 0 0 1 .8-1l7-1.4a1 1 0 0 1 1.2 1V20" />
      <path d="M2.6 20h12.8M17 9.5h4.4M19.2 7.3l2.2 2.2-2.2 2.2" />
    </Lucide>
  );
}
/** A ticked circle, the Dot vote glyph. */
export function VoteGlyph() {
  return (
    <Lucide>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Lucide>
  );
}
/** Three rising columns, the Poll glyph. */
export function PollGlyph() {
  return (
    <Lucide>
      <path d="M6 20v-4M12 20V10M18 20V4" />
    </Lucide>
  );
}
/** A laser dot with a trail. */
export function LaserGlyph() {
  return (
    <g>
      <path
        d="M-7 6 Q-1 1 4 -4"
        className="stroke-brand-400"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={5} cy={-5} r={3} className="fill-rose-500" />
    </g>
  );
}
/** A pool of light inside a dimmed ring, the Spotlight mode glyph. */
export function SpotlightGlyph() {
  return (
    <g {...glyph} strokeLinecap="round">
      <circle r={7} strokeDasharray="2 2" />
      <circle r={3.5} />
    </g>
  );
}

/** A page with ruled lines, the Record group glyph. */
export function RecordGlyph() {
  return (
    <g {...glyph} strokeLinecap="round">
      <rect x={-6} y={-8} width={12} height={16} rx={2} />
      <path d="M-3 -3 H3 M-3 1 H3 M-3 5 H1" />
    </g>
  );
}
/** A stopwatch, the Stopwatch glyph (it counts up). */
export function StopwatchGlyph() {
  return (
    <g {...glyph} strokeLinecap="round">
      <circle cy={1.5} r={6.5} />
      <path d="M0 1.5 V-2 M-2 -8 H2 M0 -8 V-5" />
    </g>
  );
}
