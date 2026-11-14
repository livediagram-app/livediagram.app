'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';
import type { PieceMomentPlay, Side } from '@/lib/piece-moments';
import { waveDelay } from '@/lib/piece-moment-motions';
import { useFreshMoment, vars } from './moment-kit';

// The walk-up answers that the pieces' own views play (docs/specs/009-elements/piece-moments.md "Which pieces have a
// moment", Work Tracker 626): a note swinging on the Notice Board, the World Clock's hands ticking round, the Calendar
// Wall's page lifting (drawn by their live faces, which lie over the art), and the Window's light brightening (drawn
// by WindowView, to its size). The Hammock and the Suggestion Box move on their art like any static piece
// (piece-moment-motions.ts, OfficeMoments). Each is one-shot CSS on transform and opacity (app/piece-moments-office.css),
// mounted only while a moment plays and keyed by it; none plays under reduced motion.

/** A part's motion turning about (x, y) in its SVG's own grid. */
function pivotAt(x: number, y: number, more: Record<string, string | number>): CSSProperties {
  return { ...vars(more), transformBox: 'view-box', transformOrigin: `${x}px ${y}px` };
}

/** Which of the Notice Board's shown notes swings: the top one on your side (the first two are the top row). */
export function swingingNote(side: Side, shown: number): number {
  return side < 0 || shown < 2 ? 0 : 1;
}

/** A note on the Notice Board swinging on its pin at (x, y), away from your side, and settling. */
export function NoteSwing({
  play,
  x,
  y,
  children,
}: {
  play: PieceMomentPlay;
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <g
      key={play.seq}
      className="lh-moment lh-moment-swing"
      data-moment-part="note"
      style={pivotAt(x, y, { '--lean': -play.side, '--swing': '6deg', '--dur': '1.6s' })}
    >
      {children}
    </g>
  );
}

/** A bare Notice Board's answer: a pin popping into the cork at (x, y), wobbling on its point, and gone. */
export function LonePin({ play, x, y }: { play: PieceMomentPlay; x: number; y: number }) {
  return (
    <g
      key={play.seq}
      aria-hidden
      className="lh-moment-parts"
      data-moment-parts="notice-board"
      transform={`translate(${x} ${y})`}
    >
      {/* Drawn with its point at (0, 0), the bottom right of its box, so it wobbles on the point (100% 100%). */}
      <g className="lh-moment lh-moment-pin" style={vars({ '--lean': -play.side })}>
        <path d="M-3 -3L0 0" stroke="#7f1d1d" strokeWidth={0.8} strokeLinecap="round" />
        <circle cx={-3.6} cy={-3.6} r={2.8} fill="#dc2626" stroke="#7f1d1d" strokeWidth={0.6} />
      </g>
    </g>
  );
}

/** A World Clock's minute hand ticking once round its dial at (cx, cy), the dials in a wave from your side. */
export function TickingHand({
  play,
  cx,
  cy,
  width,
  children,
}: {
  play: PieceMomentPlay;
  cx: number;
  cy: number;
  // The clock's grid width: the wave runs across it.
  width: number;
  children: ReactNode;
}) {
  return (
    <g
      key={play.seq}
      className="lh-moment lh-moment-tick"
      data-moment-part="hand"
      style={pivotAt(cx, cy, {
        '--delay': `${Math.round(waveDelay(cx, play.side, width) * 1000) / 1000}s`,
      })}
    >
      {children}
    </g>
  );
}

// The page's corner: how far up and in the curl reaches, in the calendar's grid.
const CURL = 28;

/**
 * The Calendar Wall's sheet lifting at its bottom corner away from you, (x, y) being that corner: the near one is
 * under your character as you stand at the wall.
 */
export function PageLift({ play, x, y }: { play: PieceMomentPlay; x: number; y: number }) {
  // Inward from the corner: left from the right one (you on the left), right from the left one.
  const dir = play.side < 0 ? -1 : 1;
  const fold = `M${x + dir * CURL} ${y}L${x} ${y - CURL}`;
  const tip = { x: x + dir * CURL * 0.86, y: y - CURL * 0.86 };
  return (
    <g key={play.seq} aria-hidden className="lh-moment-parts" data-moment-parts="calendar-wall">
      <g className="lh-moment lh-moment-lift" style={pivotAt(x, y, {})}>
        {/* The shadow the lifted corner casts on the sheet, then the paper's back curling over. */}
        <path d={`${fold}L${tip.x + dir * 2} ${tip.y - 2}Z`} fill="#0f172a" opacity={0.14} />
        <path
          d={`${fold}L${tip.x} ${tip.y}Z`}
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/**
 * A Window's answer, in its own px: the light on the floor brightening and fading back (a second wash of the same
 * gradient), and a glint crossing the pane from your end. `side` is along the window's wall.
 */
export function WindowMoment({
  id,
  light,
  gradient,
  pane,
}: {
  id: string;
  light: string;
  gradient: string;
  pane: { x: number; y: number; w: number; h: number };
}) {
  const play = useFreshMoment(id);
  if (!play) return null;
  return <WindowMomentParts key={play.seq} side={play.side} {...{ light, gradient, pane }} />;
}

function WindowMomentParts({
  side,
  light,
  gradient,
  pane,
}: {
  side: Side;
  light: string;
  gradient: string;
  pane: { x: number; y: number; w: number; h: number };
}) {
  // An id usable in `url(#...)`: React's ids carry colons.
  const own = `lh-window-glint-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const band = 8;
  // From just outside your end of the pane to just past the far one.
  const from = side < 0 ? pane.x - band : pane.x + pane.w;
  const dx = (side < 0 ? 1 : -1) * (pane.w + band);
  return (
    <g aria-hidden className="lh-moment-parts" data-moment-parts="window">
      <path
        d={light}
        fill={`url(#${gradient})`}
        className="lh-moment lh-moment-pulse"
        style={vars({ '--peak': 1, '--dur': '1.6s' })}
      />
      <clipPath id={own}>
        <rect x={pane.x} y={pane.y} width={pane.w} height={pane.h} />
      </clipPath>
      <g clipPath={`url(#${own})`}>
        <path
          d={`M${from + 3} ${pane.y}h${band - 3}l-3 ${pane.h}h${-(band - 3)}Z`}
          fill="#ffffff"
          className="lh-moment lh-moment-sweep"
          style={vars({ '--dx': `${dx}px`, '--peak': 0.9, '--dur': '1s', '--delay': '0.2s' })}
        />
      </g>
    </g>
  );
}
