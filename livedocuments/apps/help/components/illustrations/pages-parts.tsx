// Shared bits of the Pages illustrations (docs/specs/018-help/help-app.md): a sheet of paper on the canvas,
// a section title and solid segments, drawn by ./pages, ./pages-row-panel and ./pages-layouts.

import type { ReactNode } from 'react';
import { Label } from '@liveworkspace/help-site/art/primitives';

/** A sheet of paper on the canvas, with a soft edge. */
export function Sheet({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect x={x + 2} y={y + 3} width={w} height={h} rx={2} className="fill-slate-200" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {children}
    </g>
  );
}

/** A section title, as the page panel prints it. */
/** A page-panel section heading, set in capitals as the panel sets it. */
export function SectionTitle({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={9.5} weight={700} tone="muted">
      {children.toUpperCase()}
    </Label>
  );
}

/** A segmented control whose chosen half is filled solid, as the export picker draws it. */
export function SolidSegments({
  x,
  y,
  items,
  active,
  segW,
}: {
  x: number;
  y: number;
  items: string[];
  active: number;
  segW: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={segW * items.length}
        height={24}
        rx={7}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1.2}
      />
      {items.map((it, i) => (
        <g key={it}>
          {i === active && (
            <rect
              x={x + i * segW + 2}
              y={y + 2}
              width={segW - 4}
              height={20}
              rx={5}
              className="fill-brand-500"
            />
          )}
          <Label
            x={x + i * segW + segW / 2}
            y={y + 12.5}
            anchor="middle"
            size={10.5}
            weight={600}
            tone={i === active ? 'onAccent' : 'muted'}
          >
            {it}
          </Label>
        </g>
      ))}
    </g>
  );
}
