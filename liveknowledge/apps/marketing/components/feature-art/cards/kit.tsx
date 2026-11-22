// What the feature pages' card drawings are made of (docs/specs/019-marketing/marketing-site.md "Feature pages"):
// each card's drawing sits in the shared Frame (@liveworkspace/marketing-site), on a 300 by 96 board. Paper,
// lines of writing, the verified tick, pills, people and agents, in the brand ramp and slate, each colour with its
// dark half as a dark: utility, so a card is right in light and dark. Decorative: the card's words say what each
// shows. Motion is the kb-* timeline (app/feature-art/knowledge.css): lines of writing type in, ticks and pills pop,
// arrows draw, each piece at its own delay (`at`); the Frame is content-visibility: auto, so a card off screen rests,
// and reduced motion shows every drawing finished.
import type { CSSProperties, ReactNode } from 'react';
import { Frame } from '@liveworkspace/marketing-site/components/feature-art/shared';

export const PAPER = 'fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600';
export const INK = 'fill-slate-800 dark:fill-slate-100';
export const QUIET = 'fill-slate-500 dark:fill-slate-400';
export const BRAND = 'fill-brand-700 dark:fill-brand-300';
export const LINE = 'fill-slate-200 dark:fill-slate-600';
export const GUIDE = 'stroke-slate-300 dark:stroke-slate-600';
export const LIME = 'fill-brand-100 stroke-brand-300 dark:fill-brand-900 dark:stroke-brand-700';

/** A delay on the kb-* timeline, so the pieces of one drawing land in turn. */
export const at = (seconds: number) => ({ '--d': `${seconds}s` }) as CSSProperties;

export function Scene({ children }: { children: ReactNode }) {
  return (
    <Frame>
      <svg viewBox="0 0 300 96" className="absolute inset-0 h-full w-full" fontFamily="inherit">
        {children}
      </svg>
    </Frame>
  );
}

/** A sheet of paper or a panel, its top left at (x, y). `lime` draws it as the knowledgebase's own. */
export function Sheet({
  x,
  y,
  w,
  h,
  lime = false,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  lime?: boolean;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        strokeWidth={0.9}
        className={lime ? LIME : PAPER}
      />
      {children}
    </g>
  );
}

type Tone = 'ink' | 'quiet' | 'brand';
const TONES: Record<Tone, string> = { ink: INK, quiet: QUIET, brand: BRAND };

/** A line of words. */
export function Txt({
  x,
  y,
  size = 7,
  weight = 600,
  tone = 'ink',
  anchor,
  mono = false,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  weight?: number;
  tone?: Tone;
  anchor?: 'middle' | 'end';
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      fontFamily={mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined}
      className={TONES[tone]}
    >
      {children}
    </text>
  );
}

/** Lines of writing as bars: each entry is a line's width. */
export function Bars({
  x,
  y,
  widths,
  gap = 7,
  delay = 0.3,
}: {
  x: number;
  y: number;
  widths: readonly number[];
  gap?: number;
  /** When the first line starts typing; each line after it follows a beat later. */
  delay?: number;
}) {
  return (
    <>
      {widths.map((w, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={w}
          height={3}
          rx={1.5}
          className={`kb-type ${LINE}`}
          style={at(delay + i * 0.12)}
        />
      ))}
    </>
  );
}

/** The verified tick: a green disc with a white tick, centred on (cx, cy). */
export function Tick({
  cx,
  cy,
  r = 4.5,
  delay = 0.9,
}: {
  cx: number;
  cy: number;
  r?: number;
  /** When it pops in on the drawing's timeline. */
  delay?: number;
}) {
  const k = r / 4.5;
  return (
    <g className="kb-pop" style={at(delay)}>
      <circle cx={cx} cy={cy} r={r} className="fill-emerald-500" />
      <path
        d={`M${cx - 2.1 * k} ${cy + 0.2 * k} l${1.5 * k} ${1.5 * k} l${2.8 * k} ${-3.2 * k}`}
        fill="none"
        strokeWidth={1.2 * k}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-white"
      />
    </g>
  );
}

type PillTone = 'verified' | 'due' | 'brand' | 'plain' | 'agent';
const PILLS: Record<PillTone, { ground: string; words: string }> = {
  verified: {
    ground: 'fill-emerald-100 dark:fill-emerald-900',
    words: 'fill-emerald-800 dark:fill-emerald-100',
  },
  // Review Due, in orange, as the landing art draws it.
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
  agent: {
    ground: 'fill-slate-800 dark:fill-slate-950',
    words: 'fill-brand-200 dark:fill-brand-300',
  },
};

/** A pill of words, its text centred. Its width is given, since SVG cannot measure text. */
export function Pill({
  x,
  y,
  w,
  h = 11,
  tone = 'plain',
  delay = 0.6,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  tone?: PillTone;
  /** When it pops in on the drawing's timeline. */
  delay?: number;
  children: ReactNode;
}) {
  const look = PILLS[tone];
  return (
    <g className="kb-pop" style={at(delay)}>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} className={look.ground} />
      <text
        x={x + w / 2}
        y={y + h / 2 + 2}
        fontSize={5.8}
        fontWeight={700}
        textAnchor="middle"
        className={look.words}
      >
        {children}
      </text>
    </g>
  );
}

/** A button: filled in the brand's deep lime, or outlined. */
export function Button({
  x,
  y,
  w,
  filled = false,
  children,
}: {
  x: number;
  y: number;
  w: number;
  filled?: boolean;
  children: string;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={12}
        rx={3.5}
        strokeWidth={filled ? 0 : 0.9}
        className={filled ? 'fill-brand-700' : PAPER}
      />
      <text
        x={x + w / 2}
        y={y + 8.1}
        fontSize={5.8}
        fontWeight={700}
        textAnchor="middle"
        className={filled ? 'fill-white' : INK}
      >
        {children}
      </text>
    </>
  );
}

/** A page: a sheet with a folded corner, its top left at (x, y), 6 by 7.5. */
export function PageGlyph({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y} h4 l2.4 2.4 v5.1 h-6.4 z`}
      strokeWidth={0.8}
      strokeLinejoin="round"
      className="fill-white stroke-brand-700 dark:fill-brand-950 dark:stroke-brand-300"
    />
  );
}

/** A person: a coloured disc with their initial. */
export function Avatar({
  cx,
  cy,
  r = 6,
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

/** An agent: a dark head with two lime eyes, its top left at (x, y), `s` square. */
export function Agent({ x, y, s = 13 }: { x: number; y: number; s?: number }) {
  const k = s / 13;
  return (
    <>
      <rect
        x={x}
        y={y}
        width={s}
        height={s}
        rx={3.5 * k}
        className="fill-slate-900 dark:fill-slate-950 dark:stroke-slate-600"
        strokeWidth={0.8}
      />
      <circle cx={x + 4.3 * k} cy={y + 5.5 * k} r={1.3 * k} className="fill-brand-300" />
      <circle cx={x + 8.7 * k} cy={y + 5.5 * k} r={1.3 * k} className="fill-brand-300" />
      <path
        d={`M${x + 4.3 * k} ${y + 9.2 * k} h${4.4 * k}`}
        strokeWidth={1 * k}
        strokeLinecap="round"
        className="stroke-brand-300"
      />
    </>
  );
}

/** An arrow from (x1, y) to (x2, y), its head at the end. */
export function Arrow({
  x1,
  x2,
  y,
  delay = 0.5,
}: {
  x1: number;
  x2: number;
  y: number;
  /** When it draws on the drawing's timeline. */
  delay?: number;
}) {
  return (
    <path
      style={{ ...at(delay), '--len': `${x2 - x1 + 12}` } as CSSProperties}
      d={`M${x1} ${y} H ${x2} M${x2 - 3} ${y - 2.6} L ${x2} ${y} L ${x2 - 3} ${y + 2.6}`}
      fill="none"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="kb-draw stroke-brand-600 dark:stroke-brand-400"
    />
  );
}

/** A text caret, blinking. */
export function Caret({ x, y, h = 8 }: { x: number; y: number; h?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={0.9}
      height={h}
      className="kb-caret fill-slate-800 dark:fill-slate-100"
    />
  );
}
