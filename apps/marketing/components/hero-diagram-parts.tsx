import type { CSSProperties, ReactNode } from 'react';
import type { IconPrim } from '@livediagram/icons';
import { Prims } from '@livediagram/ui';
import { cursorRide, type Point } from '@/lib/hero-motion';
import { FONT, at } from '@/components/art-tokens';
import { CursorMark } from '@/components/hero-cursor';

// The marks the hero's Diagram window (hero-diagram-board.tsx) is drawn from, each as the editor
// draws it on the Default theme (the --art-* palette): a node's icon and label centred together,
// connectors that draw on head last with their label on a canvas-coloured chip, and the two
// collaborators' cursors riding their motion paths.

export const INK = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
const ARROW = 'stroke-(--art-arrow)';

// How wide a node label sets at its size, near enough to centre an icon beside it.
const CHAR_EM = 0.53;
const ICON = 13;
const ICON_GAP = 5;

// A node's label (typed out once its shape lands) with an optional icon before it, the pair centred
// on the node as the editor centres a shape's icon and label.
export function NodeLabel({
  cx,
  cy,
  d,
  icon,
  children,
  size = 12.5,
}: {
  cx: number;
  cy: number;
  d: number;
  icon?: readonly IconPrim[];
  children: string;
  size?: number;
}) {
  const textW = children.length * size * CHAR_EM;
  const shift = icon ? (ICON + ICON_GAP) / 2 : 0;
  const iconX = cx - textW / 2 - shift;
  return (
    <>
      {icon ? (
        <g className="hm-pop" style={at(d)}>
          <g
            transform={`translate(${iconX} ${cy - ICON / 2}) scale(${ICON / 24})`}
            className="stroke-(--hd-ink-stroke,var(--art-ink-stroke))"
            fill="none"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Prims prims={icon} />
          </g>
        </g>
      ) : null}
      <text
        className="hm-type fill-(--hd-ink-text,var(--art-ink-text))"
        style={at(d + 0.1, { '--steps': children.length })}
        x={cx + shift}
        y={cy + size * 0.36}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={size}
        fontWeight="600"
        stroke="none"
      >
        {children}
      </text>
    </>
  );
}

export type Link = {
  d: string;
  len: number;
  head: string;
  label?: { x: number; y: number; text: string };
};

// A connector that draws on, its arrowhead landing as the line arrives, with an optional label on a
// canvas-coloured chip as the editor sets a connector's text.
export function Connector({
  d: path,
  head,
  at: start,
  len,
  dashed = false,
  label,
}: Link & { at: number; dashed?: boolean }) {
  const dur = Math.min(0.75, 0.3 + len / 500);
  return (
    <g>
      <path
        className={`${dashed ? 'hm-fade' : 'hm-draw'} ${ARROW}`}
        style={at(start, { '--dur': `${dur}s`, '--len': len })}
        d={path}
        fill="none"
        strokeWidth="1.75"
        strokeDasharray={dashed ? '5 4' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className={`hm-fade fill-(--art-arrow) ${ARROW}`}
        style={at(start + dur - 0.05)}
        d={head}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {label ? (
        <g className="hm-pop" style={at(start + dur * 0.6)}>
          <rect
            x={label.x - (label.text.length * 5.6 + 12) / 2}
            y={label.y - 8.5}
            width={label.text.length * 5.6 + 12}
            height="16"
            rx="4"
            className="fill-(--art-paper)"
          />
          <text
            x={label.x}
            y={label.y + 3}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize="9.5"
            fontWeight="600"
            className="fill-(--art-arrow-label)"
          >
            {label.text}
          </text>
        </g>
      ) : null}
    </g>
  );
}

// A filled arrowhead pointing `dir` with its tip at (x, y), the editor's default end.
export function head(x: number, y: number, dir: 'up' | 'down' | 'left' | 'right'): string {
  const [a, b] = [9, 4.5];
  switch (dir) {
    case 'down':
      return `M${x} ${y} L${x - b} ${y - a} L${x + b} ${y - a} Z`;
    case 'up':
      return `M${x} ${y} L${x - b} ${y + a} L${x + b} ${y + a} Z`;
    case 'right':
      return `M${x} ${y} L${x - a} ${y - b} L${x - a} ${y + b} Z`;
    case 'left':
      return `M${x} ${y} L${x + a} ${y - b} L${x + a} ${y + b} Z`;
  }
}

// A shape that lands with a small overshoot.
export function Drop({ d, children }: { d: number; children: ReactNode }) {
  return (
    <g className="hm-pop" style={at(d)}>
      {children}
    </g>
  );
}

export function Cursor({
  className,
  color,
  name,
  ride,
}: {
  className: string;
  color: string;
  name: string;
  ride: readonly Point[];
}) {
  return (
    <g className={className} style={cursorRide(ride) as CSSProperties} aria-hidden>
      <CursorMark colour={color} label={name} badge="name" />
    </g>
  );
}

// The teammate's sticky note, as the editor draws one: a square of paper with a soft lift under it,
// its text, and its author's initials in the corner.
export function Sticky({
  x,
  y,
  lines,
  author,
}: {
  x: number;
  y: number;
  lines: string[];
  author: string;
}) {
  const w = 122;
  const h = 72;
  return (
    <g transform={`rotate(-1.5 ${x + w / 2} ${y + h / 2})`}>
      <path
        d={`M${x + 4} ${y + h - 2} Q${x + w / 2} ${y + h + 5} ${x + w - 4} ${y + h - 2} L${x + w - 4} ${y + h - 10} L${x + 4} ${y + h - 10} Z`}
        fill="#0f172a"
        opacity="0.12"
      />
      <rect x={x} y={y} width={w} height={h} rx="2" fill="#fde68a" />
      <rect x={x} y={y} width={w} height="7" rx="2" fill="#fcd34d" opacity="0.7" />
      {lines.map((line, i) => (
        <text
          key={line}
          x={x + 11}
          y={y + 26 + i * 15}
          fontFamily={FONT}
          fontSize="11"
          fontWeight="600"
          fill="#1c1917"
        >
          {line}
        </text>
      ))}
      <circle cx={x + w - 13} cy={y + h - 12} r="7" fill="#ec4899" />
      <text
        x={x + w - 13}
        y={y + h - 9.5}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize="6.5"
        fontWeight="700"
        fill="white"
      >
        {author}
      </text>
    </g>
  );
}
