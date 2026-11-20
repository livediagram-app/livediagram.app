// The canvas primitives of the help illustrations' kit (./primitives): the shapes, arrows,
// selection, cursors and avatars the editor's canvas draws.
import { useId, type ReactNode } from 'react';
import { Label, DiscText } from './primitives-text';
import { artApp } from './art-app';

// --- Canvas elements ---------------------------------------------------------

type ShapeKind =
  'rect' | 'circle' | 'diamond' | 'cylinder' | 'hexagon' | 'stadium' | 'parallelogram' | 'triangle';

/** True in a help app that has no diagram shapes (livehuddle, whose help is built with `HELP_ART_APP=livehuddle`;
 *  `HELP_STICKY_ONLY=1` forces it): every `Shape` then draws a sticky note, connectors are left out, and the Border
 *  figure leaves out its Radius grid. Read at call time so a test can switch it. */
export function stickyOnly(): boolean {
  return process.env.HELP_STICKY_ONLY === '1' || artApp() === 'livehuddle';
}

/** A canvas node, drawn as the editor draws a freshly placed shape: a pale brand fill inside a crisp brand outline
 *  with gently rounded corners. `accent` fills it solid brand. */
export function Shape({
  x,
  y,
  w = 72,
  h = 44,
  kind = 'rect',
  accent = false,
  dashed = false,
  label,
  labelTone,
  fill,
  stroke,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  kind?: ShapeKind;
  accent?: boolean;
  dashed?: boolean;
  label?: string;
  labelTone?: 'body' | 'onAccent' | 'strong';
  fill?: string;
  stroke?: string;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const fillCls = fill ?? (accent ? 'fill-brand-500' : 'fill-brand-50');
  const strokeCls = stroke ?? (accent ? 'stroke-brand-600' : 'stroke-brand-500');
  const common = {
    className: `${fillCls} ${strokeCls}`,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeDasharray: dashed ? '5 4' : undefined,
  };
  let body: ReactNode;
  const sticky = stickyOnly();
  if (sticky) {
    // A sticky note: square corners, a pastel fill, no border and the paper's soft drop shadow, as the canvas draws
    // one by default.
    body = (
      <>
        <rect x={x + 1} y={y + 3} width={w} height={h} className="fill-slate-900/[0.07]" />
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          className={fill ?? (accent ? 'fill-brand-200' : 'fill-amber-100')}
        />
      </>
    );
  } else
    switch (kind) {
      case 'circle':
        body = <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} {...common} />;
        break;
      case 'diamond':
        body = <path d={`M${cx} ${y} L${x + w} ${cy} L${cx} ${y + h} L${x} ${cy} Z`} {...common} />;
        break;
      case 'cylinder':
        body = (
          <path
            d={`M${x} ${y + 7} a${w / 2} 7 0 0 1 ${w} 0 v${h - 14} a${w / 2} 7 0 0 1 ${-w} 0 Z M${x} ${y + 7} a${w / 2} 7 0 0 0 ${w} 0`}
            {...common}
          />
        );
        break;
      case 'hexagon': {
        const i = w * 0.22;
        body = (
          <path
            d={`M${x + i} ${y} H${x + w - i} L${x + w} ${cy} L${x + w - i} ${y + h} H${x + i} L${x} ${cy} Z`}
            {...common}
          />
        );
        break;
      }
      case 'stadium':
        body = <rect x={x} y={y} width={w} height={h} rx={h / 2} {...common} />;
        break;
      case 'parallelogram': {
        const s = w * 0.18;
        body = <path d={`M${x + s} ${y} H${x + w} L${x + w - s} ${y + h} H${x} Z`} {...common} />;
        break;
      }
      case 'triangle':
        body = <path d={`M${cx} ${y} L${x + w} ${y + h} H${x} Z`} {...common} />;
        break;
      default:
        body = <rect x={x} y={y} width={w} height={h} rx={4} {...common} />;
    }
  return (
    <g>
      {body}
      {label && (
        <Label
          x={cx}
          y={cy + 1}
          anchor="middle"
          tone={labelTone ?? (accent && !sticky ? 'onAccent' : 'strong')}
          size={12}
          weight={400}
        >
          {label}
        </Label>
      )}
    </g>
  );
}

/** A connector between two points. `kind` switches straight / curved / elbow,
 *  matching the editor's arrow styles. Renders its own arrowhead marker.
 *  `colour` overrides the tone with a stroke + arrowhead class pair. */
export function Arrow({
  from,
  to,
  kind = 'straight',
  tone = 'accent',
  dashed = false,
  head = true,
  width = 1.75,
  colour,
  connector = false,
}: {
  from: [number, number];
  to: [number, number];
  kind?: 'straight' | 'curved' | 'elbow';
  tone?: 'accent' | 'muted';
  dashed?: boolean;
  head?: boolean;
  width?: number;
  colour?: { stroke: string; fill: string };
  /** Joins two elements, as a connector does: not drawn in a help app with no diagram shapes (`stickyOnly`). */
  connector?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  if (connector && stickyOnly()) return null;
  const [x1, y1] = from;
  const [x2, y2] = to;
  const strokeCls = colour?.stroke ?? (tone === 'accent' ? 'stroke-brand-500' : 'stroke-slate-300');
  const fillCls = colour?.fill ?? (tone === 'accent' ? 'fill-brand-500' : 'fill-slate-300');
  let d: string;
  if (kind === 'curved') {
    const mx = (x1 + x2) / 2;
    const my = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.25 - 12;
    d = `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
  } else if (kind === 'elbow') {
    const mx = (x1 + x2) / 2;
    d = `M${x1} ${y1} H${mx} V${y2} H${x2}`;
  } else {
    d = `M${x1} ${y1} L${x2} ${y2}`;
  }
  return (
    <>
      <defs>
        {/* A slim, slightly swept head in user units, so it stays the editor's size whatever the line's width. */}
        <marker
          id={`ah-${id}`}
          markerUnits="userSpaceOnUse"
          markerWidth="10"
          markerHeight="10"
          refX="7.5"
          refY="4"
          orient="auto"
        >
          <path d="M0 0.5 L8 4 L0 7.5 L1.6 4 Z" className={fillCls} />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        className={strokeCls}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '5 4' : undefined}
        markerEnd={head ? `url(#ah-${id})` : undefined}
      />
    </>
  );
}

/** The editor's selection: a crisp brand outline with round handles at the corners and slim pills at the middle of
 *  each edge. */
export function SelectionBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const corners: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  const pill = 'fill-white stroke-brand-500';
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        className="fill-none stroke-brand-500"
        strokeWidth={1.5}
      />
      <rect
        x={x + w / 2 - 6}
        y={y - 2.5}
        width={12}
        height={5}
        rx={2.5}
        className={pill}
        strokeWidth={1}
      />
      <rect
        x={x + w / 2 - 6}
        y={y + h - 2.5}
        width={12}
        height={5}
        rx={2.5}
        className={pill}
        strokeWidth={1}
      />
      <rect
        x={x - 2.5}
        y={y + h / 2 - 6}
        width={5}
        height={12}
        rx={2.5}
        className={pill}
        strokeWidth={1}
      />
      <rect
        x={x + w - 2.5}
        y={y + h / 2 - 6}
        width={5}
        height={12}
        rx={2.5}
        className={pill}
        strokeWidth={1}
      />
      {corners.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={3.2} className={pill} strokeWidth={1.2} />
      ))}
    </g>
  );
}

/** A live-collaboration cursor with a coloured name tag. */
export function Cursor({
  x,
  y,
  name,
  colour = 'brand',
}: {
  x: number;
  y: number;
  name?: string;
  colour?: 'brand' | 'emerald' | 'violet' | 'amber' | 'rose';
}) {
  const fill = {
    brand: 'fill-brand-500',
    emerald: 'fill-emerald-500 dark:fill-emerald-700',
    violet: 'fill-violet-500 dark:fill-violet-700',
    amber: 'fill-amber-500 dark:fill-amber-700',
    rose: 'fill-rose-500 dark:fill-rose-700',
  }[colour];
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* The system pointer's shape with its white keyline, tinted for the collaborator, as the canvas draws one. */}
      <path
        d="M0 0 L0 15.5 L4.2 11.8 L6.8 17.6 L9.4 16.4 L6.9 10.7 L12.4 10.3 Z"
        className={`${fill} stroke-white`}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {name && (
        <g transform="translate(11 14)">
          <rect width={name.length * 5.6 + 12} height={15} rx={7.5} className={fill} />
          <Label x={6} y={8} tone="onAccent" size={9} weight={600}>
            {name}
          </Label>
        </g>
      )}
    </g>
  );
}

/** A round collaborator avatar with an initial. */
export function Avatar({
  cx,
  cy,
  r = 13,
  initial,
  colour = 'brand',
}: {
  cx: number;
  cy: number;
  r?: number;
  initial?: string;
  colour?: 'brand' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate';
}) {
  const fill = {
    brand: 'fill-brand-500',
    emerald: 'fill-emerald-500 dark:fill-emerald-700',
    violet: 'fill-violet-500 dark:fill-violet-700',
    amber: 'fill-amber-500 dark:fill-amber-700',
    rose: 'fill-rose-500 dark:fill-rose-700',
    // slate-500 is retargeted inside the art, so read its captured original.
    slate: 'fill-slate-400 dark:fill-(--help-art-slate-500)',
  }[colour];
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className={`${fill} stroke-white`} strokeWidth={2.5} />
      {initial && (
        <DiscText cx={cx} cy={cy} size={r}>
          {initial}
        </DiscText>
      )}
    </g>
  );
}
