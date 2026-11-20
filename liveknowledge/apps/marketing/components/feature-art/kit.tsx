// What every feature section's art is drawn from (docs/specs/019-marketing/marketing-site.md "Feature
// sections"): the panel a drawing sits in, and the pieces the drawings share. One look with the hero: white cards
// with a dark outline and a lime shadow set off down and right, slate ink, the brand ramp for what is the
// knowledgebase's own. Everything follows light and dark through utilities. Each drawing is one SVG on a
// 520 by 380 board, decorative (the section's words say what it shows).
import type { ReactNode } from 'react';

export const BOARD = '0 0 520 380';

export const INK = 'stroke-slate-900 dark:stroke-slate-200';
export const PAPER = 'fill-white dark:fill-slate-800';
const WORDS = 'fill-slate-900 dark:fill-slate-50';
const QUIET = 'fill-slate-500 dark:fill-slate-400';
const BRAND = 'fill-brand-800 dark:fill-brand-200';

// The panel: a lime-tinted ground with the canvas's dot grid. content-visibility lets the browser skip
// painting and animating a drawing while it is off screen. A board keeps its aspect ratio, so skipping it never
// moves anything; `fluid` is for a drawing made of markup, which takes the height its content needs and holds a
// remembered size while skipped.
export function ArtPanel({ children, fluid = false }: { children: ReactNode; fluid?: boolean }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-3xl border border-brand-200 bg-brand-50 [content-visibility:auto] dark:border-slate-700 dark:bg-slate-950 ${fluid ? '[contain-intrinsic-size:auto_24rem]' : ''}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-brand-200)_1px,transparent_1px)] bg-[size:18px_18px] dark:bg-[radial-gradient(var(--color-slate-800)_1px,transparent_1px)]" />
      <div className={`relative w-full ${fluid ? 'p-5 sm:p-8' : 'aspect-[26/19] p-2 sm:p-3'}`}>
        {children}
      </div>
    </div>
  );
}

export function Board({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={BOARD} className="h-full w-full" fontFamily="inherit">
      {children}
    </svg>
  );
}

// A card: paper with a dark outline, and a lime shadow set off down and right.
export function Card({
  x,
  y,
  w,
  h,
  children,
  className,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <g className={className}>
      <rect x={x + 5} y={y + 5} width={w} height={h} rx={12} className="fill-brand-400" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        strokeWidth={2}
        className={`${PAPER} ${INK}`}
      />
      {children}
    </g>
  );
}

type Tone = 'words' | 'quiet' | 'brand';
const TONES: Record<Tone, string> = { words: WORDS, quiet: QUIET, brand: BRAND };

// A line of words. `anchor` centres or right-aligns it on x.
export function T({
  x,
  y,
  size = 12,
  weight = 400,
  tone = 'words',
  anchor,
  className,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  weight?: number;
  tone?: Tone;
  anchor?: 'middle' | 'end';
  className?: string;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      className={className ?? TONES[tone]}
    >
      {children}
    </text>
  );
}

// A small capital label above a group ("PAGE HEALTH").
export function Label({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fontSize={9.5} fontWeight={700} letterSpacing={0.7} className={QUIET}>
      {children}
    </text>
  );
}

// Lines of writing, as bars: each entry is a line's width.
export function Bars({
  x,
  y,
  widths,
  gap = 16,
}: {
  x: number;
  y: number;
  widths: readonly number[];
  gap?: number;
}) {
  return (
    <>
      {widths.map((w, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={w}
          height={7}
          rx={3.5}
          className={
            i % 2 ? 'fill-slate-200 dark:fill-slate-700' : 'fill-slate-300 dark:fill-slate-600'
          }
        />
      ))}
    </>
  );
}

// The verified tick: a green disc with a white tick, centred on (cx, cy).
export function Tick({ cx, cy, r = 9 }: { cx: number; cy: number; r?: number }) {
  const k = r / 9;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} className="fill-emerald-500" />
      <path
        d={`M${cx - 4.2 * k} ${cy + 0.4 * k} l${3 * k} ${3 * k} l${5.6 * k} ${-6.4 * k}`}
        fill="none"
        strokeWidth={2.2 * k}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-white"
      />
    </>
  );
}

type PillTone = 'verified' | 'due' | 'brand' | 'plain';
const PILLS: Record<PillTone, { ground: string; words: string }> = {
  verified: {
    ground: 'fill-emerald-100 dark:fill-emerald-900',
    words: 'fill-emerald-800 dark:fill-emerald-100',
  },
  // Review Due, in orange: the nearest hue to the editor's pill that keeps the fork's brand hue off the site.
  due: {
    ground: 'fill-orange-100 dark:fill-orange-900',
    words: 'fill-orange-800 dark:fill-orange-100',
  },
  brand: {
    ground: 'fill-brand-100 dark:fill-brand-900',
    words: 'fill-brand-800 dark:fill-brand-100',
  },
  plain: {
    ground: 'fill-slate-100 dark:fill-slate-700',
    words: 'fill-slate-700 dark:fill-slate-100',
  },
};

// A pill of words, its text centred. Its width is given, since SVG cannot measure text.
export function Pill({
  x,
  y,
  w,
  h = 22,
  tone = 'plain',
  children,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  tone?: PillTone;
  children: ReactNode;
}) {
  const look = PILLS[tone];
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} className={look.ground} />
      <text
        x={x + w / 2}
        y={y + h / 2 + 3.9}
        fontSize={11}
        fontWeight={600}
        textAnchor="middle"
        className={look.words}
      >
        {children}
      </text>
    </>
  );
}

// A button: filled in the brand's deep lime, or outlined in ink.
export function Button({
  x,
  y,
  w,
  h = 28,
  filled = false,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  filled?: boolean;
  children: string;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        strokeWidth={filled ? 0 : 1.75}
        className={filled ? 'fill-brand-700' : `${PAPER} ${INK}`}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 4}
        fontSize={11.5}
        fontWeight={600}
        textAnchor="middle"
        className={filled ? 'fill-white' : WORDS}
      >
        {children}
      </text>
    </>
  );
}

// A person: a coloured disc with their initial.
export function Avatar({
  cx,
  cy,
  r = 11,
  fill,
  initial,
}: {
  cx: number;
  cy: number;
  r?: number;
  fill: string;
  initial: string;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} className={fill} />
      <text
        x={cx}
        y={cy + r * 0.36}
        fontSize={r * 1.05}
        fontWeight={700}
        textAnchor="middle"
        className="fill-white"
      >
        {initial}
      </text>
    </>
  );
}

// A page: a sheet with a folded corner, its top left at (x, y), 12 by 14.
export function PageGlyph({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y} h7.5 l4.5 4.5 v9.5 h-12 z`}
      strokeWidth={1.4}
      strokeLinejoin="round"
      className="fill-white stroke-brand-700 dark:fill-brand-950 dark:stroke-brand-300"
    />
  );
}

// An agent: a dark head with two lime eyes and an antenna, its top left at (x, y), `s` square.
export function AgentGlyph({ x, y, s = 26 }: { x: number; y: number; s?: number }) {
  const k = s / 26;
  return (
    <>
      <path
        d={`M${x + s / 2} ${y} v${-5 * k}`}
        strokeWidth={2 * k}
        strokeLinecap="round"
        className={INK}
      />
      <circle cx={x + s / 2} cy={y - 6.5 * k} r={2.2 * k} className="fill-brand-400" />
      <rect
        x={x}
        y={y}
        width={s}
        height={s}
        rx={7 * k}
        className="fill-slate-900 dark:fill-slate-950"
      />
      <circle cx={x + 8.5 * k} cy={y + 11 * k} r={2.6 * k} className="fill-brand-300" />
      <circle cx={x + 17.5 * k} cy={y + 11 * k} r={2.6 * k} className="fill-brand-300" />
      <path
        d={`M${x + 8.5 * k} ${y + 18.5 * k} h${9 * k}`}
        strokeWidth={2 * k}
        strokeLinecap="round"
        className="stroke-brand-300"
      />
    </>
  );
}

// A rule across a card.
export function Rule({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <path
      d={`M${x} ${y} h${w}`}
      strokeWidth={1.25}
      className="stroke-slate-200 dark:stroke-slate-700"
    />
  );
}
