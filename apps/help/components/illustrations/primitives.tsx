// Shared SVG building blocks for the in-article help illustrations (spec/55).
//
// Every illustration in `components/illustrations/*` is composed from these
// primitives so the whole help centre reads as one coherent window into the
// real editor: white panels with slate borders, sky-blue (`brand`) accents,
// muted slate "text" bars, and the same shapes / arrows / cursors the canvas
// draws. Keeping the kit here (rather than re-spelling rects per scene) is the
// no-duplication rule applied to artwork: a tweak to the house style lands in
// one place. The richer category scenes live in sibling files and import from
// here; `<Figure>` frames whatever a scene returns.
//
// Coordinates are plain SVG user units inside a per-scene `viewBox`; pick scene
// dimensions so labels land around 11-14 units tall and stay legible when the
// figure scales down on mobile.

import { useId, type ReactNode } from 'react';

// --- Scene shell -------------------------------------------------------------

/** The SVG canvas a scene draws into. `bg="canvas"` lays down the editor's
 *  faint dot grid; `bg="plain"` a soft brand wash; `bg="none"` nothing. */
export function Scene({
  w = 400,
  h = 240,
  bg = 'canvas',
  children,
}: {
  w?: number;
  h?: number;
  bg?: 'canvas' | 'plain' | 'none';
  children: ReactNode;
}) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      <defs>
        <pattern id={`grid-${gid}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-slate-200" />
        </pattern>
      </defs>
      {bg === 'canvas' && <rect x={0} y={0} width={w} height={h} fill={`url(#grid-${gid})`} />}
      {bg === 'plain' && <rect x={0} y={0} width={w} height={h} className="fill-brand-50/40" />}
      {children}
    </svg>
  );
}

// --- Text --------------------------------------------------------------------

/** A label. `tone` picks a slate weight; `accent`/`onAccent` for brand text. */
export function Label({
  x,
  y,
  children,
  size = 12,
  weight = 400,
  tone = 'body',
  anchor = 'start',
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  weight?: number | 'bold';
  tone?: 'body' | 'muted' | 'strong' | 'accent' | 'onAccent';
  anchor?: 'start' | 'middle' | 'end';
  className?: string;
}) {
  const toneClass =
    className ??
    {
      body: 'fill-slate-600',
      muted: 'fill-slate-400',
      strong: 'fill-slate-800',
      accent: 'fill-brand-600',
      onAccent: 'fill-white',
    }[tone];
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight === 'bold' ? 700 : weight}
      textAnchor={anchor}
      dominantBaseline="middle"
      className={toneClass}
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {children}
    </text>
  );
}

/** A muted "lorem" bar standing in for a run of text. */
export function TextBar({
  x,
  y,
  w,
  h = 6,
  tone = 'muted',
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  tone?: 'muted' | 'faint' | 'accent';
}) {
  const cls = { muted: 'fill-slate-300', faint: 'fill-slate-200', accent: 'fill-brand-200' }[tone];
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} className={cls} />;
}

// --- Canvas elements ---------------------------------------------------------

type ShapeKind =
  'rect' | 'circle' | 'diamond' | 'cylinder' | 'hexagon' | 'stadium' | 'parallelogram' | 'triangle';

/** A canvas node. `accent` fills it brand; otherwise white with a brand
 *  border, matching how a placed shape looks on the real canvas. */
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
  const fillCls = fill ?? (accent ? 'fill-brand-500' : 'fill-white');
  const strokeCls = stroke ?? (accent ? 'stroke-brand-600' : 'stroke-brand-300');
  const common = {
    className: `${fillCls} ${strokeCls}`,
    strokeWidth: 2,
    strokeDasharray: dashed ? '5 4' : undefined,
  };
  let body: ReactNode;
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
      body = <rect x={x} y={y} width={w} height={h} rx={7} {...common} />;
  }
  return (
    <g>
      {body}
      {label && (
        <Label
          x={cx}
          y={cy + 1}
          anchor="middle"
          tone={labelTone ?? (accent ? 'onAccent' : 'strong')}
          size={12}
          weight={500}
        >
          {label}
        </Label>
      )}
    </g>
  );
}

/** A connector between two points. `kind` switches straight / curved / elbow,
 *  matching the editor's arrow styles. Renders its own arrowhead marker. */
export function Arrow({
  from,
  to,
  kind = 'straight',
  tone = 'accent',
  dashed = false,
  head = true,
  width = 2.5,
}: {
  from: [number, number];
  to: [number, number];
  kind?: 'straight' | 'curved' | 'elbow';
  tone?: 'accent' | 'muted';
  dashed?: boolean;
  head?: boolean;
  width?: number;
}) {
  const id = useId().replace(/:/g, '');
  const [x1, y1] = from;
  const [x2, y2] = to;
  const strokeCls = tone === 'accent' ? 'stroke-brand-400' : 'stroke-slate-300';
  const fillCls = tone === 'accent' ? 'fill-brand-400' : 'fill-slate-300';
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
        <marker id={`ah-${id}`} markerWidth="8" markerHeight="8" refX="5.5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" className={fillCls} />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        className={strokeCls}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '6 5' : undefined}
        markerEnd={head ? `url(#ah-${id})` : undefined}
      />
    </>
  );
}

/** Eight square selection handles around a box, with a dashed marquee. */
export function SelectionBox({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const pts: [number, number][] = [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x + w, y + h / 2],
    [x + w, y + h],
    [x + w / 2, y + h],
    [x, y + h],
    [x, y + h / 2],
  ];
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        className="fill-none stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      {pts.map(([px, py], i) => (
        <rect
          key={i}
          x={px - 3.5}
          y={py - 3.5}
          width={7}
          height={7}
          className="fill-white stroke-brand-500"
          strokeWidth={1.5}
        />
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
    emerald: 'fill-emerald-500',
    violet: 'fill-violet-500',
    amber: 'fill-amber-500',
    rose: 'fill-rose-500',
  }[colour];
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 L0 17 L4.8 12.8 L7.5 19 L10.6 17.5 L8 11.2 L13.8 10.6 Z" className={fill} />
      {name && (
        <g transform="translate(12 8)">
          <rect width={name.length * 6.5 + 12} height={17} rx={5} className={fill} />
          <Label x={6} y={9} tone="onAccent" size={10} weight={600}>
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
    emerald: 'fill-emerald-500',
    violet: 'fill-violet-500',
    amber: 'fill-amber-500',
    rose: 'fill-rose-500',
    slate: 'fill-slate-400',
  }[colour];
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className={`${fill} stroke-white`} strokeWidth={2.5} />
      {initial && (
        <Label x={cx} y={cy + 1} anchor="middle" tone="onAccent" size={r} weight={700}>
          {initial}
        </Label>
      )}
    </g>
  );
}

// --- UI chrome ---------------------------------------------------------------

/** A floating editor panel with a title bar. Children draw inside the body. */
export function Panel({
  x,
  y,
  w,
  h,
  title,
  children,
  accentBar = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  children?: ReactNode;
  accentBar?: boolean;
}) {
  const barH = title ? 22 : 0;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {title && (
        <>
          <path
            d={`M${x} ${y + 10} a10 10 0 0 1 10 -10 H${x + w - 10} a10 10 0 0 1 10 10 V${y + barH} H${x} Z`}
            className={accentBar ? 'fill-brand-500' : 'fill-slate-50'}
          />
          <Label
            x={x + 12}
            y={y + barH / 2 + 1}
            size={10}
            weight={700}
            tone={accentBar ? 'onAccent' : 'muted'}
            className={accentBar ? undefined : 'fill-slate-400'}
          >
            {title}
          </Label>
        </>
      )}
      {children}
    </g>
  );
}

/** A modal dialog: a backing scrim plus a titled white card. */
export function Dialog({
  x,
  y,
  w,
  h,
  title,
  children,
  sceneW = 400,
  sceneH = 240,
  scrim = true,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  children?: ReactNode;
  sceneW?: number;
  sceneH?: number;
  /** The dimmed backdrop behind the dialog. Set false when the scene has no
   *  canvas behind the dialog, so it isn't a flat grey block. */
  scrim?: boolean;
}) {
  return (
    <g>
      {scrim && <rect x={0} y={0} width={sceneW} height={sceneH} className="fill-slate-900/10" />}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {title && (
        <>
          <Label x={x + 16} y={y + 20} size={13} weight={700} tone="strong">
            {title}
          </Label>
          <line
            x1={x}
            y1={y + 36}
            x2={x + w}
            y2={y + 36}
            className="stroke-slate-200"
            strokeWidth={1.5}
          />
        </>
      )}
      {children}
    </g>
  );
}

/** A button. `variant` switches the fill; `icon` draws to the left of text. */
export function Button({
  x,
  y,
  w,
  h = 26,
  label,
  variant = 'default',
  icon,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label?: string;
  variant?: 'default' | 'primary' | 'ghost';
  icon?: ReactNode;
}) {
  const cls = {
    default: 'fill-white stroke-slate-300',
    primary: 'fill-brand-500 stroke-brand-600',
    ghost: 'fill-slate-100 stroke-transparent',
  }[variant];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} className={cls} strokeWidth={1.5} />
      {label && (
        <Label
          x={x + w / 2 + (icon ? 6 : 0)}
          y={y + h / 2 + 1}
          anchor="middle"
          size={11}
          weight={600}
          tone={variant === 'primary' ? 'onAccent' : 'body'}
        >
          {label}
        </Label>
      )}
      {icon && <g transform={`translate(${x + 9} ${y + h / 2})`}>{icon}</g>}
    </g>
  );
}

/** A segmented control / tab strip. The `active` index is brand-filled. */
export function Tabs({
  x,
  y,
  items,
  active = 0,
  tabW = 56,
  h = 24,
}: {
  x: number;
  y: number;
  items: string[];
  active?: number;
  tabW?: number;
  h?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={tabW * items.length}
        height={h}
        rx={7}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1.5}
      />
      {items.map((it, i) => {
        const tx = x + i * tabW;
        const on = i === active;
        return (
          <g key={i}>
            {on && (
              <rect
                x={tx + 2}
                y={y + 2}
                width={tabW - 4}
                height={h - 4}
                rx={5}
                className="fill-white stroke-slate-200"
                strokeWidth={1}
              />
            )}
            <Label
              x={tx + tabW / 2}
              y={y + h / 2 + 1}
              anchor="middle"
              size={10}
              weight={on ? 700 : 500}
              tone={on ? 'accent' : 'muted'}
            >
              {it}
            </Label>
          </g>
        );
      })}
    </g>
  );
}

/** A right-click context menu: rows, with one optionally highlighted. */
export function Menu({
  x,
  y,
  w = 130,
  items,
  active = -1,
  rowH = 22,
}: {
  x: number;
  y: number;
  w?: number;
  items: string[];
  active?: number;
  rowH?: number;
}) {
  const h = items.length * rowH + 8;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {items.map((it, i) => {
        const ry = y + 4 + i * rowH;
        const on = i === active;
        return (
          <g key={i}>
            {on && (
              <rect x={x + 4} y={ry} width={w - 8} height={rowH} rx={5} className="fill-brand-50" />
            )}
            <Label
              x={x + 12}
              y={ry + rowH / 2 + 1}
              size={11}
              tone={on ? 'accent' : 'body'}
              weight={on ? 600 : 400}
            >
              {it}
            </Label>
          </g>
        );
      })}
    </g>
  );
}

/** A small square tool/icon tile (palette tile, toolbar button). */
export function Tile({
  x,
  y,
  size = 26,
  active = false,
  children,
  label,
}: {
  x: number;
  y: number;
  size?: number;
  active?: boolean;
  children?: ReactNode;
  label?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={6}
        className={active ? 'fill-brand-500 stroke-brand-600' : 'fill-slate-50 stroke-slate-200'}
        strokeWidth={1.5}
      />
      {children && <g transform={`translate(${x + size / 2} ${y + size / 2})`}>{children}</g>}
      {label && (
        <Label x={x + size / 2} y={y + size + 8} anchor="middle" size={8} tone="muted">
          {label}
        </Label>
      )}
    </g>
  );
}
