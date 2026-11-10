// Plan mode illustrations' building blocks (docs/specs/026-plan/), shared by ./plan-board and ./plan-cards:
// the card types' stripes, a card on a board, a header widget, a column's cog, a column and a plain pointer
// line.

import { Label } from '@liveworkspace/help-site/art/primitives';

/** A plain straight pointer line with no head, for "this opens that". */
export function Arrow2({ from, to }: { from: [number, number]; to: [number, number] }) {
  return (
    <path
      d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`}
      className="stroke-brand-300"
      strokeWidth={1.5}
      strokeDasharray="3 2"
    />
  );
}

// The five built-in card types' stripes: Project black, Task gray, Note blue, Idea yellow, Action red.
export type CardType = 'project' | 'task' | 'note' | 'idea' | 'action';
export const STRIPE: Record<CardType, string> = {
  project: 'fill-slate-800',
  task: 'fill-slate-400',
  note: 'fill-indigo-500',
  idea: 'fill-amber-400',
  action: 'fill-rose-500',
};

/** One card on a board: the type's stripe, its number and its title. */
export function Card({
  x,
  y,
  w = 80,
  h = 30,
  type = 'task',
  num,
  title,
  muted = false,
  lifted = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  type?: CardType;
  num: number;
  title: string;
  muted?: boolean;
  lifted?: boolean;
}) {
  return (
    <g transform={lifted ? `rotate(-4 ${x + w / 2} ${y + h / 2})` : undefined}>
      {lifted && (
        <rect x={x + 2} y={y + 3} width={w} height={h} rx={5} className="fill-slate-900/10" />
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        className={lifted ? 'fill-white stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={lifted ? 1.5 : 1}
      />
      <rect x={x} y={y} width={3.5} height={h} rx={1.5} className={STRIPE[type]} />
      <Label x={x + 9} y={y + 10} size={10} tone="muted">
        #{num}
      </Label>
      <Label x={x + 9} y={y + 22} size={10} tone={muted ? 'muted' : 'strong'} weight={500}>
        {title}
      </Label>
    </g>
  );
}

/** A small widget pill in a board's header. */
export function Widget({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={18}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <Label x={x + w / 2} y={y + 10} size={10} anchor="middle" tone="body">
        {label}
      </Label>
    </g>
  );
}

/** A column's cog. */
export function Cog({ cx, cy, on = false }: { cx: number; cy: number; on?: boolean }) {
  return (
    <g>
      {on && <circle cx={cx} cy={cy} r={8} className="fill-brand-100" />}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="none"
        className={on ? 'stroke-brand-600' : 'stroke-slate-400'}
        strokeWidth={1.6}
      />
      <path
        d={`M${cx} ${cy - 6.5} v2 M${cx} ${cy + 4.5} v2 M${cx - 6.5} ${cy} h2 M${cx + 4.5} ${cy} h2`}
        className={on ? 'stroke-brand-600' : 'stroke-slate-400'}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A column well with its head: name, count, and an optional cog. */
export function Column({
  x,
  y,
  w,
  h,
  name,
  count,
  warn = false,
  cog = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  count: string;
  warn?: boolean;
  cog?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} className="fill-slate-50" />
      <Label x={x + 7} y={y + 12} size={10} weight={700} tone="strong">
        {name}
      </Label>
      <Label
        x={x + w - (cog ? 18 : 7)}
        y={y + 12}
        size={10}
        anchor="end"
        weight={warn ? 700 : 400}
        className={warn ? 'fill-amber-500' : 'fill-slate-400'}
      >
        {count}
      </Label>
      {cog && <Cog cx={x + w - 8} cy={y + 12} on />}
    </g>
  );
}
