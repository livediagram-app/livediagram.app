// The card chrome every Collaborate scene draws into (palette-collaborate.tsx and its siblings,
// palette-collab-panels.tsx, palette-qa-board.tsx): the titled card and the dashed accent bar.

import type { ReactNode } from 'react';

import { Label } from '@liveworkspace/help-site/art/primitives';

// --- Shared card chrome ------------------------------------------------------

/** A collaboration element on the canvas: title, the caption on the right, a
 *  body, and whatever the card draws below. */
export function CollabCard({
  x,
  y,
  w,
  h,
  title,
  aside,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  aside?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={11}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      <Label x={x + 14} y={y + 19} size={12} weight={700} tone="strong">
        {title}
      </Label>
      {aside && (
        <Label x={x + w - 14} y={y + 19} anchor="end" size={10} weight={600} tone="muted">
          {aside}
        </Label>
      )}
      <line
        x1={x}
        y1={y + 31}
        x2={x + w}
        y2={y + 31}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      {children}
    </g>
  );
}

/** The dashed accent bar every modern Collaborate card uses for its one
 *  action (Reveal, Open the Box, Take Roll, Add Action). */
export function AccentBar({
  x,
  y,
  w,
  h = 22,
  label,
  count,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  // How many things the action covers, as a badge in the accent
  // (docs/specs/004-interface-design/counts.md), never "(3)" in the label.
  count?: number;
}) {
  // The label and its badge sit centred together, 6px apart.
  const textW = label.length * 5.8;
  const badge = 16;
  const run = count === undefined ? textW : textW + 6 + badge;
  const left = x + (w - run) / 2;
  const cy = y + h / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={7}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1.2}
        strokeDasharray="4 3"
      />
      <Label x={left + textW / 2} y={cy + 1} anchor="middle" size={10} weight={600} tone="accent">
        {label}
      </Label>
      {count !== undefined && (
        <g>
          <rect
            x={left + textW + 6}
            y={cy - badge / 2}
            width={badge}
            height={badge}
            rx={badge / 2}
            className="fill-brand-500"
          />
          <Label
            x={left + textW + 6 + badge / 2}
            y={cy + 1}
            anchor="middle"
            size={9}
            weight={700}
            tone="onAccent"
          >
            {String(count)}
          </Label>
        </g>
      )}
    </g>
  );
}
