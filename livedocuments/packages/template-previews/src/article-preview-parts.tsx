import type { ReactNode } from 'react';
import { pv } from '@liveworkspace/template-previews/motion';

// The written documents' preview parts (template-preview-27.tsx, template-preview-28.tsx): an A4 page, a line of text,
// a table, a to-do box and a header or footer band, in one ink set, so every written template draws its page alike.

export const INK = 'rgb(15 23 42)';
export const MUTED = 'rgb(148 163 184)';
export const LINE = 'rgb(203 213 225)';
export const SOFT = 'rgb(100 116 139)';
export const PAPER = 'white';
export const ACCENT = 'rgb(37 99 235)';
export const ACCENT_DARK = 'rgb(30 64 175)';
export const TINT = 'rgb(219 234 254)';

export const at = (ms: number) => pv({ '--pv-at': `${ms}ms` });

// An A4 page, 34 x 46, its top left at (x, y).
export function Page({ x, y = 2, fill = PAPER }: { x: number; y?: number; fill?: string }) {
  return (
    <rect
      x={x}
      y={y}
      width="34"
      height="46"
      rx="0.8"
      fill={fill}
      stroke={MUTED}
      strokeWidth="0.3"
    />
  );
}

// A line of text, a bar.
export function Bar({
  x,
  y,
  w,
  h = 0.9,
  fill = MUTED,
  grow,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  fill?: string;
  // Writes itself in, at this many ms into the story.
  grow?: number;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={h / 2}
      fill={fill}
      {...(grow === undefined ? {} : { className: 'pv-grow-x', style: at(grow) })}
    />
  );
}

// A table: its rows' tops, its column edges, a tinted header row, and each cell's text width (a row of widths a row).
export function Table({
  x,
  y,
  cols,
  row,
  cells,
  head = TINT,
  grow,
}: {
  x: number;
  y: number;
  // The column widths.
  cols: readonly number[];
  row: number;
  cells: readonly (readonly number[])[];
  head?: string;
  // The body rows write themselves in, one after another, from this many ms.
  grow?: number;
}) {
  const width = cols.reduce((n, w) => n + w, 0);
  const lefts = cols.map((_, i) => x + cols.slice(0, i).reduce((n, w) => n + w, 0));
  const height = row * cells.length;
  const parts: ReactNode[] = [
    <rect key="head" x={x} y={y} width={width} height={row} fill={head} />,
    <rect
      key="frame"
      x={x}
      y={y}
      width={width}
      height={height}
      fill="none"
      stroke={LINE}
      strokeWidth="0.3"
    />,
  ];
  for (let r = 1; r < cells.length; r++)
    parts.push(
      <line
        key={`r${r}`}
        x1={x}
        y1={y + r * row}
        x2={x + width}
        y2={y + r * row}
        stroke={LINE}
        strokeWidth="0.25"
      />,
    );
  for (let c = 1; c < cols.length; c++)
    parts.push(
      <line
        key={`c${c}`}
        x1={lefts[c]}
        y1={y}
        x2={lefts[c]}
        y2={y + height}
        stroke={LINE}
        strokeWidth="0.25"
      />,
    );
  cells.forEach((widths, r) =>
    widths.forEach((w, c) => {
      if (w <= 0) return;
      parts.push(
        <Bar
          key={`t${r}-${c}`}
          x={lefts[c]! + 0.9}
          y={y + r * row + row / 2 - 0.4}
          w={w}
          h={0.8}
          fill={r === 0 ? ACCENT_DARK : MUTED}
          grow={grow === undefined || r === 0 ? undefined : grow + (r - 1) * 260}
        />,
      );
    }),
  );
  return <g>{parts}</g>;
}

// A to-do box, ticked or not; a tick the story draws is hidden at rest.
export function Todo({
  x,
  y,
  ticked,
  draw,
}: {
  x: number;
  y: number;
  ticked?: boolean;
  draw?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width="1.8"
        height="1.8"
        rx="0.3"
        fill={ticked ? ACCENT : PAPER}
        stroke={ticked ? ACCENT : SOFT}
        strokeWidth="0.3"
      />
      {ticked ? (
        <path
          d={`M${x + 0.4} ${y + 0.95} L${x + 0.8} ${y + 1.35} L${x + 1.45} ${y + 0.5}`}
          fill="none"
          stroke={PAPER}
          strokeWidth="0.35"
          strokeLinecap="round"
        />
      ) : null}
      {draw !== undefined ? (
        <path
          className="pv-draw"
          pathLength="1"
          strokeDasharray="0 1"
          d={`M${x + 0.3} ${y + 0.9} L${x + 0.8} ${y + 1.5} L${x + 2.2} ${y - 0.6}`}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={pv({ '--pv-at': `${draw}ms`, '--pv-dur': '360ms' })}
        />
      ) : null}
    </g>
  );
}

// A header or footer: a left and a right part, a hairline between it and the writing.
export function Band({
  x,
  y,
  left,
  right,
  rule,
}: {
  x: number;
  y: number;
  left: number;
  right: number;
  rule: number;
}) {
  return (
    <g>
      <Bar x={x + 3} y={y} w={left} h={0.7} />
      <Bar x={x + 31 - right} y={y} w={right} h={0.7} />
      <line x1={x + 3} y1={rule} x2={x + 31} y2={rule} stroke={LINE} strokeWidth="0.25" />
    </g>
  );
}
