// The drawing parts the canvas feature illustrations (./canvas.tsx) are built from, all plain SVG
// in the cards' 300 by 96 viewBox: a canvas shape in the Default scheme's ink, an editor panel,
// presence avatars and cursors, chips, a handful of chrome glyphs, and the Avatar mode walker.
//
// Every colour follows the appearance: canvas marks read the --art-* palette
// (app/hero-animations.css), chrome pairs each light fill with its dark: twin, and only the
// participant colours (who is who) stay fixed, as they do in the editor.

import type { CSSProperties, ReactNode } from 'react';
import { Frame } from './shared';

// Participant colours, as the editor hands them out: you first, then each teammate.
export const YOU = '#0ea5e9';
export const JORDAN = '#ec4899';
export const ALEX = '#8b5cf6';
export const SAM = '#10b981';
export const AWAY = '#f59e0b';

// A delay into the shared 6s timeline (app/feature-art-animations.css, the canvas and collaboration block).
export const at = (seconds: number, extra?: CSSProperties) =>
  ({ '--d': `${seconds}s`, ...extra }) as CSSProperties;

// Chrome: a panel's face and edge, its text, and the soft shadow it floats on.
export const PANEL = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700';
const PANEL_SUNK = 'fill-slate-50 stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700';
export const TEXT = 'fill-slate-700 dark:fill-slate-200';
export const MUTED = 'fill-slate-400 dark:fill-slate-500';
export const RULE = 'stroke-slate-200 dark:stroke-slate-700';
export const LINE = 'fill-slate-200 dark:fill-slate-700';
const FLOAT =
  'drop-shadow-[0_1.5px_2px_rgb(15_23_42/0.12)] dark:drop-shadow-[0_1.5px_2px_rgb(0_0_0/0.45)]';
// The ring round an avatar or a pin, in the colour of what it sits on.
const ON_PANEL = 'stroke-white dark:stroke-slate-800';
export const ON_CANVAS = 'stroke-(--art-paper)';

/** A shape on the canvas in the Default scheme's ink, with an optional label. */
export function Box({
  x,
  y,
  w = 46,
  h = 24,
  label,
  className = '',
  style,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <g className={className} style={style}>
      <rect
        className="fill-(--art-ink-fill) stroke-(--art-ink-stroke)"
        x={x}
        y={y}
        width={w}
        height={h}
        rx="5"
        strokeWidth="1.75"
      />
      {label ? (
        <text
          className="fill-(--art-ink-text)"
          x={x + w / 2}
          y={y + h / 2 + 2.6}
          fontSize="7.5"
          fontWeight="600"
          textAnchor="middle"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** A connector between two points on the canvas, with a small arrowhead at the end. */
export function Connector({ d, head }: { d: string; head: string }) {
  return (
    <g
      className="stroke-(--art-arrow)"
      fill="none"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
      <path d={head} />
    </g>
  );
}

/** An editor panel: a rounded face floating over the canvas. */
export function Panel({
  x,
  y,
  w,
  h,
  className = '',
  sunk = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  className?: string;
  sunk?: boolean;
}) {
  return (
    <rect
      className={`${sunk ? PANEL_SUNK : `${PANEL} ${FLOAT}`} ${className}`}
      x={x}
      y={y}
      width={w}
      height={h}
      rx="6"
      strokeWidth="1"
    />
  );
}

/** A participant's avatar: their colour, their initials, a ring in the colour behind it. */
export function Avatar({
  cx,
  cy,
  r = 6.5,
  color,
  initials,
  ring = ON_PANEL,
}: {
  cx: number;
  cy: number;
  r?: number;
  color: string;
  initials: string;
  ring?: string;
}) {
  return (
    <g>
      <circle className={ring} cx={cx} cy={cy} r={r} fill={color} strokeWidth="1.5" />
      <text
        x={cx}
        y={cy + r * 0.36}
        fontSize={r * 0.95}
        fontWeight="700"
        textAnchor="middle"
        fill="#fff"
      >
        {initials}
      </text>
    </g>
  );
}

/** A collaborator's pointer with their name tag, its tip at (x, y). */
export function Pointer({
  x,
  y,
  color,
  name,
  className,
  style,
}: {
  x: number;
  y: number;
  color: string;
  name?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const tag = name ? name.length * 4.3 + 7 : 0;
  return (
    <g className={className} style={style}>
      <path
        d={`M${x} ${y} l0 11 l3 -2.8 l2.2 4.6 l2 -1 l-2.2 -4.5 l4.2 0 z`}
        fill={color}
        stroke="#fff"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {name ? (
        <g>
          <rect x={x + 9} y={y + 10} width={tag} height="10" rx="3" fill={color} />
          <text
            x={x + 9 + tag / 2}
            y={y + 17.2}
            fontSize="6.5"
            fontWeight="700"
            textAnchor="middle"
            fill="#fff"
          >
            {name}
          </text>
        </g>
      ) : null}
    </g>
  );
}

/** A small pill: a tinted face and a label. `tone` picks its colours. */
export function Pill({
  x,
  y,
  w,
  label,
  tone = 'slate',
  className = '',
  style,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  tone?: 'slate' | 'sky' | 'pink' | 'green' | 'amber' | 'red' | 'solid';
  className?: string;
  style?: CSSProperties;
}) {
  const face = {
    slate: 'fill-slate-100 dark:fill-slate-700',
    sky: 'fill-sky-100 dark:fill-sky-500/25',
    pink: 'fill-pink-100 dark:fill-pink-500/25',
    green: 'fill-emerald-100 dark:fill-emerald-500/25',
    amber: 'fill-amber-100 dark:fill-amber-500/25',
    red: 'fill-rose-100 dark:fill-rose-500/25',
    solid: 'fill-sky-500',
  }[tone];
  const ink = {
    slate: 'fill-slate-600 dark:fill-slate-300',
    sky: 'fill-sky-700 dark:fill-sky-200',
    pink: 'fill-pink-700 dark:fill-pink-200',
    green: 'fill-emerald-700 dark:fill-emerald-200',
    amber: 'fill-amber-700 dark:fill-amber-200',
    red: 'fill-rose-700 dark:fill-rose-200',
    solid: 'fill-white',
  }[tone];
  return (
    <g className={className} style={style}>
      <rect className={face} x={x} y={y} width={w} height="11" rx="5.5" />
      <text
        className={ink}
        x={x + w / 2}
        y={y + 7.6}
        fontSize="6.5"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

/** A line of text standing in for a sentence: a soft bar. */
export function TextBar({
  x,
  y,
  w,
  className = LINE,
}: {
  x: number;
  y: number;
  w: number;
  className?: string;
}) {
  return <rect className={className} x={x} y={y} width={w} height="3" rx="1.5" />;
}

// Chrome glyphs on a 10-unit grid, drawn at (x, y) in currentColor-free strokes.
export function Glyph({
  x,
  y,
  children,
  className = 'stroke-slate-500 dark:stroke-slate-400',
  scale = 1,
}: {
  x: number;
  y: number;
  children: ReactNode;
  className?: string;
  scale?: number;
}) {
  return (
    <g
      className={className}
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill="none"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}

export const LINK_PATHS = (
  <>
    <path d="M4.2 5.8 l1.6 -1.6" />
    <path d="M3.6 3.4 l1-1 a2 2 0 0 1 2.8 2.8 l-1 1" />
    <path d="M6.4 6.6 l-1 1 a2 2 0 0 1 -2.8 -2.8 l1 -1" />
  </>
);
export const CLOCK_PATHS = (
  <>
    <circle cx="5" cy="5" r="4" />
    <path d="M5 2.8 V5 l1.6 1" />
  </>
);
export const PEOPLE_PATHS = (
  <>
    <circle cx="3.8" cy="3.4" r="1.7" />
    <path d="M0.8 8.6 c0.3 -1.8 1.5 -2.8 3 -2.8 s2.7 1 3 2.8" />
    <path d="M6.6 1.9 a1.6 1.6 0 0 1 0 3 M7.6 5.9 c0.9 0.4 1.4 1.3 1.6 2.6" />
  </>
);
export const LOCK_PATHS = (
  <>
    <rect x="1.8" y="4.4" width="6.4" height="4.6" rx="1" />
    <path d="M3.2 4.4 V3.2 a1.8 1.8 0 0 1 3.6 0 V4.4" />
  </>
);
export const FOLDER_PATHS = <path d="M1 2.6 h3 l1 1.2 h4 v4.6 h-8 z" />;
export const CHECK_PATHS = <path d="M2.2 5.2 l1.9 1.9 l3.7 -3.9" />;

// Avatar mode (docs/specs/008-canvas/avatar-mode.md): a little pixel character standing on the
// canvas, in its participant's shirt colour. Pure rects on a coarse grid, the editor's sprite look,
// its feet at (x, y).
export function PixelWalker({
  x,
  y,
  shirt,
  flag = false,
}: {
  x: number;
  y: number;
  shirt: string;
  flag?: boolean;
}) {
  const s = 1.6;
  const p = (n: number) => n * s;
  return (
    <g transform={`translate(${x - p(8)} ${y - p(23)})`} shapeRendering="crispEdges">
      <ellipse
        cx={p(8)}
        cy={p(23)}
        rx={p(4.6)}
        ry={p(1.1)}
        className="fill-slate-900/20 dark:fill-black/50"
      />
      <rect x={p(5)} y={p(15)} width={p(3)} height={p(6)} fill="#3f4c63" />
      <rect x={p(9)} y={p(15)} width={p(3)} height={p(6)} fill="#3f4c63" />
      <rect x={p(5)} y={p(21)} width={p(3)} height={p(2)} fill="#1e293b" />
      <rect x={p(9)} y={p(21)} width={p(3)} height={p(2)} fill="#1e293b" />
      <rect x={p(4)} y={p(9)} width={p(8)} height={p(6)} fill={shirt} />
      <rect x={p(2)} y={p(9)} width={p(2)} height={p(4)} fill={shirt} />
      <rect x={p(12)} y={p(9)} width={p(2)} height={p(4)} fill={shirt} />
      <rect x={p(4)} y={p(1)} width={p(8)} height={p(8)} fill="#f4c99b" />
      <rect x={p(3)} y={0} width={p(10)} height={p(3)} fill="#6b4423" />
      <rect x={p(6)} y={p(5)} width={s} height={s} fill="#243044" />
      <rect x={p(9)} y={p(5)} width={s} height={s} fill="#243044" />
      {flag ? (
        <>
          <rect x={p(13)} y={p(-4)} width={s} height={p(14)} fill="#b8845a" />
          <rect x={p(14)} y={p(-4)} width={p(6)} height={p(3.5)} fill="#f43f5e" />
        </>
      ) : null}
    </g>
  );
}

// A card's stage: the canvas Frame and the 300 by 96 drawing on it, the frame's own proportions
// (about 304 by 96), so a scene fills the card edge to edge with a 10-unit inner margin.
export function Scene({ children }: { children: ReactNode }) {
  return (
    <Frame canvas>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full">
        {children}
      </svg>
    </Frame>
  );
}

// A travel offset for .fa-a-move: where the piece starts, relative to where it is drawn.
export const from = (x: number, y: number, d = 0): CSSProperties =>
  ({ '--x0': `${x}px`, '--y0': `${y}px`, '--d': `${d}s` }) as CSSProperties;

// A tab in a tab bar: its colour bar, its name, and an underline when it is the one open.
export function Tab({
  x,
  w,
  name,
  color,
  y = 72,
}: {
  x: number;
  w: number;
  name: string;
  color: string;
  y?: number;
}) {
  return (
    <g>
      <rect x={x + 5} y={y + 4} width="2" height="8" rx="1" fill={color} />
      <text className={TEXT} x={x + 10} y={y + 10.6} fontSize="7" fontWeight="600">
        {name}
      </text>
      <rect className="fill-none" x={x} y={y} width={w} height="16" />
    </g>
  );
}
