// What a livehuddle Space is built from, drawn from above the way the canvas draws it in Edit (the Virtual Office
// template is the reference): rooms with a cream floor, pale walls and the room's name on its top wall, desks with a
// monitor and an office chair, a meeting table ringed by chairs, sofas, rugs, plants in terracotta pots, bookshelves,
// sticky notes and the Avatar Pad people arrive on. The pieces keep their own colours in dark mode too, as the
// canvas's furniture does (help-art-as-drawn). Every piece takes its top-left corner, or its centre where it is round.

import { Label } from '@liveworkspace/help-site/art/primitives';

const DRAWN = 'help-art-as-drawn';

/** A room: the cream floor, its walls, its name on the top wall's plate and a doorway gap with its swing in the wall
 *  `door` names. */
export function Room({
  x,
  y,
  w,
  h,
  name,
  door = 'bottom',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  door?: 'bottom' | 'top' | 'left' | 'right' | 'none';
}) {
  const t = 3;
  const dw = Math.min(22, w * 0.25);
  const dx = x + w * 0.4;
  const dy = y + h * 0.45;
  return (
    <g className={DRAWN}>
      <rect x={x} y={y} width={w} height={h} className="fill-stone-50" />
      {/* The floor's tiles. */}
      <path
        d={Array.from(
          { length: Math.floor(h / 9) },
          (_, i) => `M${x} ${y + 9 * (i + 1)}h${w}`,
        ).join('')}
        className="stroke-stone-200/70"
        strokeWidth={0.5}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        className="fill-none stroke-stone-300"
        strokeWidth={t}
      />
      <rect
        x={x + t / 2}
        y={y + t / 2}
        width={w - t}
        height={h - t}
        className="fill-none stroke-white"
        strokeWidth={0.6}
      />
      {/* The top wall's face, darker where the light is behind it. */}
      <rect x={x} y={y} width={w} height={7} className="fill-stone-300" />
      {door === 'bottom' && (
        <rect x={dx} y={y + h - 2} width={dw} height={4} className="fill-stone-50" />
      )}
      {door === 'top' && <rect x={dx} y={y - 2} width={dw} height={9} className="fill-stone-50" />}
      {door === 'left' && <rect x={x - 2} y={dy} width={4} height={dw} className="fill-stone-50" />}
      {door === 'right' && (
        <rect x={x + w - 2} y={dy} width={4} height={dw} className="fill-stone-50" />
      )}
      {name && (
        <text
          x={x + 4}
          y={y + 4.2}
          fontSize={4.6}
          fontWeight={600}
          dominantBaseline="middle"
          className="fill-stone-700"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {name}
        </text>
      )}
    </g>
  );
}

/** A room's name sign: the small plate the canvas hangs by a room's door, legible at figure size. */
export function RoomSign({ x, y, name }: { x: number; y: number; name: string }) {
  const w = name.length * 5.4 + 12;
  return (
    <g className={DRAWN}>
      <rect x={x} y={y} width={w} height={15} rx={3} className="fill-amber-800" />
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={12} rx={2} className="fill-amber-50" />
      <Label
        x={x + w / 2}
        y={y + 8}
        size={9}
        weight={600}
        anchor="middle"
        className="fill-stone-700"
      >
        {name}
      </Label>
    </g>
  );
}

/** An office chair seen from above: a dark seat and its back. `facing` turns it toward the desk. */
export function Chair({
  cx,
  cy,
  facing = 'up',
  s = 1,
}: {
  cx: number;
  cy: number;
  facing?: 'up' | 'down' | 'left' | 'right';
  s?: number;
}) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[facing];
  return (
    <g className={DRAWN} transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${s})`}>
      <rect x={-5} y={-4} width={10} height={9} rx={2.5} className="fill-slate-600" />
      <rect x={-5.5} y={3.5} width={11} height={3.5} rx={1.5} className="fill-slate-800" />
    </g>
  );
}

/** A desk with its monitor and keyboard, the chair in front: 34 by 26. */
export function Desk({ x, y, chair = true }: { x: number; y: number; chair?: boolean }) {
  return (
    <g className={DRAWN}>
      <rect x={x} y={y + 2} width={34} height={13} rx={1.5} className="fill-amber-800" />
      <rect x={x} y={y} width={34} height={12} rx={1.5} className="fill-orange-200" />
      <rect x={x + 1} y={y + 1} width={32} height={2} rx={1} className="fill-orange-100" />
      <rect x={x + 10} y={y - 4} width={14} height={8} rx={1} className="fill-slate-800" />
      <rect x={x + 11} y={y - 3} width={12} height={5.5} className="fill-sky-400" />
      <rect x={x + 11} y={y + 7} width={11} height={2.5} rx={0.6} className="fill-slate-100" />
      {chair && <Chair cx={x + 17} cy={y + 20} />}
    </g>
  );
}

/** A meeting table with `seats` chairs round it, `w` by 22 at (x, y). */
export function MeetingTable({
  x,
  y,
  w = 56,
  seats = 6,
}: {
  x: number;
  y: number;
  w?: number;
  seats?: number;
}) {
  const per = Math.ceil(seats / 2);
  const step = w / per;
  return (
    <g className={DRAWN}>
      {Array.from({ length: per }, (_, i) => (
        <g key={i}>
          <Chair cx={x + step * (i + 0.5)} cy={y - 4} facing="down" s={0.8} />
          <Chair cx={x + step * (i + 0.5)} cy={y + 26} facing="up" s={0.8} />
        </g>
      ))}
      <rect x={x} y={y + 2} width={w} height={22} rx={6} className="fill-amber-800" />
      <rect x={x} y={y} width={w} height={21} rx={6} className="fill-orange-200" />
      <rect x={x + 3} y={y + 2} width={w - 6} height={3} rx={1.5} className="fill-orange-100" />
    </g>
  );
}

/** A two-seater sofa, 40 by 18. */
export function Sofa({
  x,
  y,
  tone = 'slate',
}: {
  x: number;
  y: number;
  tone?: 'slate' | 'teal' | 'rose';
}) {
  const [body, seat] = {
    slate: ['fill-slate-500', 'fill-slate-400'],
    teal: ['fill-teal-600', 'fill-teal-400'],
    rose: ['fill-rose-600', 'fill-rose-400'],
  }[tone];
  return (
    <g className={DRAWN}>
      <rect x={x} y={y} width={40} height={18} rx={4} className={body} />
      <rect x={x + 5} y={y + 6} width={14.5} height={10} rx={2} className={seat} />
      <rect x={x + 20.5} y={y + 6} width={14.5} height={10} rx={2} className={seat} />
    </g>
  );
}

/** A round rug, centred on (cx, cy). */
export function Rug({
  cx,
  cy,
  rx = 30,
  ry = 16,
}: {
  cx: number;
  cy: number;
  rx?: number;
  ry?: number;
}) {
  return (
    <g className={DRAWN}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} className="fill-amber-200" />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx - 3}
        ry={ry - 3}
        className="fill-none stroke-amber-300"
        strokeWidth={0.8}
      />
    </g>
  );
}

/** A potted plant, centred on (cx, cy). */
export function Plant({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <g className={DRAWN} transform={`translate(${cx} ${cy}) scale(${s})`}>
      <path d="M-4 3 H4 L3 9 H-3 Z" className="fill-orange-700" />
      <path
        d="M0 3 C-7 1 -8 -5 -6 -8 C-3 -5 -1 -3 0 3 C1 -4 3 -9 6 -9 C7 -5 6 1 0 3 Z"
        className="fill-emerald-600"
      />
      <path d="M0 3 C-2 -3 -1 -8 0 -10 C1 -8 2 -3 0 3 Z" className="fill-emerald-500" />
    </g>
  );
}

/** A bookshelf against a wall, `w` wide and 12 deep. */
export function Bookshelf({ x, y, w = 30 }: { x: number; y: number; w?: number }) {
  const books = [
    'fill-sky-500',
    'fill-amber-400',
    'fill-rose-500',
    'fill-emerald-500',
    'fill-violet-500',
  ];
  return (
    <g className={DRAWN}>
      <rect x={x} y={y} width={w} height={14} rx={1} className="fill-amber-800" />
      {Array.from({ length: Math.floor((w - 4) / 4) }, (_, i) => (
        <rect
          key={i}
          x={x + 2 + i * 4}
          y={y + 2}
          width={3}
          height={10}
          className={books[i % books.length]}
        />
      ))}
    </g>
  );
}

/** The Avatar Pad people arrive on: a glowing disc, centred on (cx, cy). */
export function AvatarPad({ cx, cy, r = 14 }: { cx: number; cy: number; r?: number }) {
  return (
    <g className={DRAWN}>
      <ellipse cx={cx} cy={cy + 2} rx={r} ry={r * 0.42} className="fill-slate-400" />
      <ellipse
        cx={cx}
        cy={cy}
        rx={r}
        ry={r * 0.42}
        className="fill-slate-200 stroke-slate-400"
        strokeWidth={0.6}
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={r * 0.6}
        ry={r * 0.25}
        className="fill-sky-300 stroke-sky-500"
        strokeWidth={0.8}
      />
      <ellipse cx={cx} cy={cy} rx={r * 0.25} ry={r * 0.1} className="fill-white" />
    </g>
  );
}

export type StickyTone = 'amber' | 'emerald' | 'sky' | 'rose' | 'violet';
const STICKY: Record<StickyTone, string> = {
  amber: 'fill-amber-100',
  emerald: 'fill-emerald-100',
  sky: 'fill-sky-100',
  rose: 'fill-rose-100',
  violet: 'fill-violet-100',
};

/** A sticky note: a square of coloured paper with a soft shadow and its words. */
export function Sticky({
  x,
  y,
  w = 54,
  h = 46,
  tone = 'amber',
  label,
  lines = 0,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  tone?: StickyTone;
  label?: string;
  /** Grey lines of writing under the label. */
  lines?: number;
}) {
  return (
    <g className={DRAWN}>
      <rect x={x + 1} y={y + 2.5} width={w} height={h} className="fill-slate-900/10" />
      <rect x={x} y={y} width={w} height={h} className={STICKY[tone]} />
      {label && (
        <Label x={x + 6} y={y + 12} size={9} weight={600} className="fill-slate-800">
          {label}
        </Label>
      )}
      {Array.from({ length: lines }, (_, i) => (
        <rect
          key={i}
          x={x + 6}
          y={y + 20 + i * 7}
          width={(w - 12) * (i % 2 ? 0.6 : 0.85)}
          height={2.5}
          rx={1.25}
          className="fill-slate-900/20"
        />
      ))}
    </g>
  );
}

/** A wall screen, `w` wide, seen from above against the top wall. */
export function WallScreen({ x, y, w = 36 }: { x: number; y: number; w?: number }) {
  return (
    <g className={DRAWN}>
      <rect x={x} y={y} width={w} height={14} rx={1.5} className="fill-slate-900" />
      <rect x={x + 2} y={y + 2} width={w - 4} height={10} rx={1} className="fill-slate-700" />
    </g>
  );
}

/** A small office: Desks with three desks and a plant, the Meeting Room with its table, and a Lounge with a sofa on a
 *  rug, laid out from (x, y) across 300 by 150. The scene most canvas figures stand on. */
export function OfficeFloor({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Room x={x} y={y} w={140} h={74} name="Desks" />
      <Desk x={x + 10} y={y + 18} />
      <Desk x={x + 52} y={y + 18} />
      <Desk x={x + 94} y={y + 18} />
      <Plant cx={x + 128} cy={y + 60} />
      <Room x={x + 152} y={y} w={148} h={74} name="Meeting Room" />
      <WallScreen x={x + 208} y={y + 8} />
      <MeetingTable x={x + 196} y={y + 34} w={60} />
      <Plant cx={x + 164} cy={y + 60} />
      <Room x={x} y={y + 86} w={140} h={64} name="Lounge" door="top" />
      <Rug cx={x + 52} cy={y + 122} />
      <Sofa x={x + 32} y={y + 106} />
      <Bookshelf x={x + 100} y={y + 94} w={30} />
      <AvatarPad cx={x + 226} cy={y + 118} />
    </g>
  );
}
