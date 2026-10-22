// The pieces the hero's Article window (hero-article-page.tsx) is set from: the page and the editor's
// label row above it, a typed line of body copy, the rich-text toolbar, and the page's own type
// scale. Every page is drawn in its own coordinates (0, 0 at its top-left corner), so the wide
// window's side-by-side row and a phone's stack place the same page.

import {
  lucideBaseline,
  lucideLink,
  lucideList,
  lucideLock,
  lucideSettings,
} from '@livedocuments/icons/lucide';
import { Glyph, Prims } from '@livedocuments/ui';
import type { ReactNode } from 'react';
import { FONT, at } from '@/components/art-tokens';

// An A4 portrait page at the scene's scale (1 : 1.414).
export const SHEET = { w: 260, h: 368 };
// The page's margin and the measure its copy runs to.
export const LEFT = 22;
export const MEASURE = SHEET.w - LEFT * 2;

// The paper's ink: pages are paper in either appearance, so their colours do not follow it.
export const INK = '#0f172a';
export const BODY = '#334155';
export const MUTED = '#64748b';
export const RULE = '#e2e8f0';
export const BRAND = '#0284c7';
export const BRAND_TINT = '#bae6fd';

export const BODY_SIZE = 9.5;
export const LEADING = 14;

type Prim = Parameters<typeof Prims>[0]['prims'];

function Icon({ prims, x, y, size = 10 }: { prims: Prim; x: number; y: number; size?: number }) {
  return (
    <Glyph size={size} units={24} x={x} y={y}>
      <Prims prims={prims} />
    </Glyph>
  );
}

// One line of copy, written out as you type it.
export function Line({
  x = LEFT,
  y,
  d,
  text,
  size = BODY_SIZE,
  fill = BODY,
  weight,
  italic,
}: {
  x?: number;
  y: number;
  d: number;
  text: string;
  size?: number;
  fill?: string;
  weight?: number;
  italic?: boolean;
}) {
  return (
    <text
      className="hm-type"
      style={at(d, { '--steps': text.length })}
      x={x}
      y={y}
      fontFamily={FONT}
      fontSize={size}
      fontWeight={weight}
      fontStyle={italic ? 'italic' : undefined}
      fill={fill}
    >
      {text}
    </text>
  );
}

// A section heading, as the article's Heading style sets it.
export function Heading({ y, d, children }: { y: number; d: number; children: string }) {
  return <Line y={y} d={d} text={children} size={13} weight={700} fill={INK} />;
}

// The page: its paper with a soft shadow, the editor's label row above it (size, orientation and
// kind, with the page's lock and settings), and its folio.
export function Sheet({
  x,
  y,
  folio,
  children,
}: {
  x: number;
  y: number;
  folio: number;
  children: ReactNode;
}) {
  const { w, h } = SHEET;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="fill-slate-500 text-slate-400 dark:fill-slate-400 dark:text-slate-500">
        <text x="0" y="-8" fontFamily={FONT} fontSize="8.5" fontWeight="500">
          A4 · Portrait · Article
        </text>
        <Icon prims={lucideLock} x={w - 28} y={-17} size={10} />
        <Icon prims={lucideSettings} x={w - 11} y={-17} size={10} />
      </g>
      <rect x="1" y="3" width={w} height={h} rx="2" fill="#0f172a" opacity="0.08" />
      <rect x="0" y="0" width={w} height={h} rx="2" className="fill-white dark:fill-slate-50" />
      <text x={w - LEFT} y={h - 12} textAnchor="end" fontFamily={FONT} fontSize="7.5" fill={MUTED}>
        {folio}
      </text>
      {children}
    </g>
  );
}

// The rich-text toolbar, docked at the top of the page you are editing as the editor docks it:
// the text style (Body), Bold (pressed once the phrase is set bold), Italic, Underline, the text
// colour, Link, the list menu and alignment.
export function RichTextToolbar({ d, bold }: { d: number; bold: number }) {
  const y = 8;
  const h = 24;
  const mid = y + h / 2;
  const sep = (x: number) => (
    <path d={`M${x} ${y + 6}V${y + h - 6}`} stroke={RULE} strokeWidth="1" />
  );
  const chev = (x: number) => (
    <path
      d={`M${x} ${mid - 1}l2 2 2-2`}
      fill="none"
      stroke="#94a3b8"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  return (
    <g className="hm-pop" style={at(d)} fontFamily={FONT}>
      <rect
        x={LEFT - 6}
        y={y + 2}
        width={MEASURE + 12}
        height={h}
        rx="7"
        fill="#0f172a"
        opacity="0.06"
      />
      <rect
        x={LEFT - 6}
        y={y}
        width={MEASURE + 12}
        height={h}
        rx="7"
        fill="white"
        stroke="#e2e8f0"
        strokeWidth="1"
      />
      {/* The style picker, on Body. */}
      <rect x={LEFT - 2} y={y + 3} width="56" height={h - 6} rx="4" fill="#f0f9ff" />
      <text x={LEFT + 3} y={mid + 3.3} fontSize="9" fontWeight="700" fill={BRAND}>
        T
      </text>
      <text x={LEFT + 13} y={mid + 3.2} fontSize="8.5" fontWeight="500" fill={BRAND}>
        Body
      </text>
      {chev(LEFT + 45)}
      {sep(LEFT + 59)}
      {/* Bold, pressed when the teammate sets the phrase. */}
      <rect
        className="hm-pop"
        style={at(bold)}
        x={LEFT + 63}
        y={y + 4}
        width="16"
        height={h - 8}
        rx="4"
        fill="#e0f2fe"
        stroke="#7dd3fc"
        strokeWidth="0.8"
      />
      <g fontSize="10" fill="#475569" textAnchor="middle">
        <text x={LEFT + 71} y={mid + 3.5} fontWeight="800" fill={INK}>
          B
        </text>
        <text x={LEFT + 90} y={mid + 3.5} fontStyle="italic" fontFamily="Georgia, serif">
          I
        </text>
        <text x={LEFT + 108} y={mid + 3.5} textDecoration="underline">
          U
        </text>
      </g>
      <g className="text-slate-600">
        <Icon prims={lucideBaseline} x={LEFT + 120} y={mid - 5} />
      </g>
      <rect x={LEFT + 121} y={mid + 4} width="8" height="1.8" rx="0.6" fill="#f59e0b" />
      {chev(LEFT + 132)}
      {sep(LEFT + 142)}
      <g className="text-slate-600">
        <Icon prims={lucideLink} x={LEFT + 148} y={mid - 5} />
        <Icon prims={lucideList} x={LEFT + 166} y={mid - 5} />
      </g>
      {chev(LEFT + 178)}
      {/* Alignment: left. */}
      <path
        d={`M${LEFT + 190} ${mid - 4}h9M${LEFT + 190} ${mid - 1.3}h6M${LEFT + 190} ${mid + 1.4}h9M${LEFT + 190} ${mid + 4.1}h5`}
        stroke="#475569"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {chev(LEFT + 202)}
    </g>
  );
}
