// A Sheet tab's grid as the help's liveplanner scenes show it (liveplanner/apps/editor/components/sheets): the
// column letters and row numbers in their pale gutters, a header row of bold names, then rows of values, with an
// optional selected cell. Used where a scene needs a Sheet beside or under the chrome (zoom, side by side).

import { Label } from '@liveworkspace/help-site/art/primitives';
import { HAIR } from './planner-chrome';

export type SheetCell = string | { v: string; right?: boolean; bold?: boolean };

/** The grid, top-left at (x, y): `cols` gives each column's width, `rows` the cells (the first row the header).
 *  `sel` is the [col, row] of the selected cell. Row height `rh`. */
export function SheetFragment({
  x,
  y,
  cols,
  rows,
  rh = 15,
  sel,
  size = 9,
}: {
  x: number;
  y: number;
  cols: number[];
  rows: SheetCell[][];
  rh?: number;
  sel?: [number, number];
  size?: number;
}) {
  const gutter = 18;
  const w = gutter + cols.reduce((a, c) => a + c, 0);
  const h = rh * (rows.length + 1);
  const lefts = cols.map((_, i) => x + gutter + cols.slice(0, i).reduce((a, c) => a + c, 0));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} className="fill-white" />
      {/* The gutters: letters across the top, numbers down the side. */}
      <rect x={x} y={y} width={w} height={rh} className="fill-slate-50" />
      <rect x={x} y={y} width={gutter} height={h} className="fill-slate-50" />
      {cols.map((c, i) => (
        <Label
          key={i}
          x={lefts[i]! + c / 2}
          y={y + rh / 2 + 0.5}
          size={8.5}
          anchor="middle"
          tone="muted"
        >
          {String.fromCharCode(65 + i)}
        </Label>
      ))}
      {rows.map((_, r) => (
        <Label
          key={r}
          x={x + gutter / 2}
          y={y + rh * (r + 1) + rh / 2 + 0.5}
          size={8.5}
          anchor="middle"
          tone="muted"
        >
          {r + 1}
        </Label>
      ))}
      {/* The grid lines. */}
      {Array.from({ length: rows.length + 2 }, (_, r) => (
        <line
          key={`h${r}`}
          x1={x}
          y1={y + r * rh}
          x2={x + w}
          y2={y + r * rh}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
      ))}
      {[x, x + gutter, ...lefts.slice(1), x + w].map((lx, i) => (
        <line
          key={`v${i}`}
          x1={lx}
          y1={y}
          x2={lx}
          y2={y + h}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
      ))}
      {rows.map((row, r) =>
        row.map((cell, c) => {
          const v = typeof cell === 'string' ? cell : cell.v;
          const right = typeof cell !== 'string' && cell.right;
          const bold = r === 0 || (typeof cell !== 'string' && cell.bold);
          const cx = lefts[c]!;
          return (
            <Label
              key={`${r}-${c}`}
              x={right ? cx + cols[c]! - 4 : cx + 4}
              y={y + rh * (r + 1) + rh / 2 + 0.5}
              size={size}
              weight={bold ? 600 : 400}
              anchor={right ? 'end' : 'start'}
              tone={bold ? 'strong' : 'body'}
            >
              {v}
            </Label>
          );
        }),
      )}
      {sel && (
        <rect
          x={lefts[sel[0]]}
          y={y + rh * (sel[1] + 1)}
          width={cols[sel[0]]}
          height={rh}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.5}
        />
      )}
    </g>
  );
}

/** A small budget the scenes reuse: items, their cost and owner. */
export const BUDGET_ROWS: SheetCell[][] = [
  ['Item', { v: 'Cost', right: true }, 'Owner'],
  ['Venue', { v: '$4,200', right: true }, 'Maya'],
  ['Catering', { v: '$2,850', right: true }, 'Sam'],
  ['Printing', { v: '$640', right: true }, 'Leo'],
  ['Travel', { v: '$1,900', right: true }, 'Maya'],
  ['Total', { v: '$9,590', right: true, bold: true }, ''],
];
