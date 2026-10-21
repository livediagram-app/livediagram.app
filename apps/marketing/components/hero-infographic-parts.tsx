import type { ReactNode } from 'react';
import type { StyledPrim } from '@liveplanner/icons';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideLock,
  lucideSettings,
} from '@liveplanner/icons/lucide';
import { Prims } from '@liveplanner/ui';
import { FONT } from '@/components/art-tokens';

// The pieces every page of the hero's Infographic window is built from (hero-page.tsx):
// the page as Pages mode shows it (its name row above, with the lock and settings, and its
// pager below; docs/specs/007-editor/pages-mode.md), the running footer, a heading, and a
// Lucide glyph placed on the page. The palette is the Year in Review template's, so the scene reads
// as the template it opens.

// The page: A4 portrait at the mock's scale.
export const SHEET = { w: 208, h: 294 } as const;
// Every block on a page starts this far in from its edges.
export const MARGIN = 14;
export const CONTENT = SHEET.w - MARGIN * 2;

export const INK = '#0b2545';
export const MUTED = '#64748b';
export const HAIRLINE = '#e2e8f0';
export const TEAL = '#0d9488';
export const TEAL_DEEP = '#0f766e';
export const NAVY = '#0b2545';

// A Lucide glyph (24 units) drawn at (x, y), `size` units across, in `colour`.
export function InfoIcon({
  prims,
  x,
  y,
  size,
  colour,
  weight = 2.2,
}: {
  prims: readonly StyledPrim[];
  x: number;
  y: number;
  size: number;
  colour: string;
  weight?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size / 24})`}
      fill="none"
      stroke={colour}
      color={colour}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Prims prims={prims} />
    </g>
  );
}

// A page as Pages shows it on the canvas: its name row above (name, size, orientation and
// kind, then the lock and the page's settings), the sheet with its shadow, and its pager below.
export function InfoSheet({
  x,
  y,
  name,
  n,
  of,
  dark = false,
  children,
}: {
  x: number;
  y: number;
  name: string;
  n: number;
  of: number;
  dark?: boolean;
  children?: ReactNode;
}) {
  const { w, h } = SHEET;
  const chrome = 'fill-slate-500 dark:fill-slate-400';
  const pager = { w: 60, h: 16 };
  const px = x + w / 2 - pager.w / 2;
  const py = y + h + 9;
  return (
    <g>
      <text x={x} y={y - 7} fontFamily={FONT} fontSize="7" fontWeight="500" className={chrome}>
        {name} · A4 · Portrait
      </text>
      <InfoIcon prims={lucideLock} x={x + w - 25} y={y - 15} size={9} colour="#94a3b8" />
      <InfoIcon prims={lucideSettings} x={x + w - 10} y={y - 15} size={9} colour="#94a3b8" />
      <rect x={x + 1} y={y + 3} width={w} height={h} rx="2" fill="#0f172a" opacity="0.07" />
      <rect x={x} y={y + 1} width={w} height={h} rx="2" fill="#0f172a" opacity="0.05" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="2"
        className={dark ? 'dark:stroke-slate-700' : 'fill-white dark:fill-slate-50'}
        fill={dark ? NAVY : undefined}
        strokeWidth={dark ? 0.8 : undefined}
      />
      {children}
      <rect
        x={px}
        y={py}
        width={pager.w}
        height={pager.h}
        rx="5"
        strokeWidth="0.8"
        className="fill-white stroke-slate-200 dark:fill-slate-900 dark:stroke-slate-700"
      />
      <InfoIcon prims={lucideChevronLeft} x={px + 3} y={py + 3.5} size={9} colour="#94a3b8" />
      <InfoIcon
        prims={lucideChevronRight}
        x={px + pager.w - 12}
        y={py + 3.5}
        size={9}
        colour="#94a3b8"
      />
      <text
        x={px + pager.w / 2}
        y={py + 10.5}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="7"
        fontWeight="500"
        className="fill-slate-600 dark:fill-slate-300"
      >
        {n} of {of}
      </text>
    </g>
  );
}

// A page's heading: a small coloured kicker over its title.
export function InfoHeading({
  x,
  y,
  kicker,
  title,
  colour,
}: {
  x: number;
  y: number;
  kicker: string;
  title: string;
  colour: string;
}) {
  return (
    <>
      <text
        x={x}
        y={y}
        fontFamily={FONT}
        fontSize="6"
        fontWeight="800"
        letterSpacing="1.1"
        fill={colour}
      >
        {kicker}
      </text>
      <text x={x} y={y + 18} fontFamily={FONT} fontSize="15" fontWeight="800" fill={INK}>
        {title}
      </text>
    </>
  );
}

// The running footer every page closes on: the report's name and the page number.
export function InfoFooter({
  x,
  y,
  n,
  of,
  dark = false,
}: {
  x: number;
  y: number;
  n: number;
  of: number;
  dark?: boolean;
}) {
  const fy = y + SHEET.h - 11;
  const fill = dark ? '#94a3b8' : MUTED;
  return (
    <g>
      <text x={x + MARGIN} y={fy} fontFamily={FONT} fontSize="5" fontWeight="500" fill={fill}>
        Harbour Studio · Year in Review 2026
      </text>
      <text
        x={x + SHEET.w - MARGIN}
        y={fy}
        textAnchor="end"
        fontFamily={FONT}
        fontSize="5"
        fontWeight="600"
        fill={fill}
      >
        {n} / {of}
      </text>
    </g>
  );
}
