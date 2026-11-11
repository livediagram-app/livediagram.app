// The shared bits of the style-panel illustrations (./style-panels and ./style-panel-categories):
// section titles, swatches, option boxes and the menu card they sit on.
import type { ReactNode } from 'react';
import { Label } from '../primitives';

// --- Shared bits -------------------------------------------------------------------------------

/** A small uppercase section title, as the panel and the menu print them. */
export function SectionTitle({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Label x={x} y={y} size={10} weight={700} tone="muted">
      {children}
    </Label>
  );
}

/** A colour swatch target; `on` rings it as the chosen option. */
export function Swatch({
  x,
  y,
  cls,
  on = false,
}: {
  x: number;
  y: number;
  cls: string;
  on?: boolean;
}) {
  return (
    <g>
      {on && (
        <rect
          x={x - 2.5}
          y={y - 2.5}
          width={19}
          height={19}
          rx={5}
          className="fill-none stroke-brand-500"
          strokeWidth={1.6}
        />
      )}
      <rect x={x} y={y} width={14} height={14} rx={3.5} className={cls} />
    </g>
  );
}

/** A small option button holding a glyph; `on` fills it as the chosen option. */
export function OptionBox({
  x,
  y,
  w = 34,
  h = 20,
  on = false,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  on?: boolean;
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
        className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={1.3}
      />
      {children}
    </g>
  );
}

/** The element menu's card: a white rounded surface with a category header row. */
export function MenuCard({
  x,
  y,
  w,
  h,
  title,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 14} y={y + 17} size={11} weight={700} tone="strong">
        {title}
      </Label>
      {/* The open category's chevron, pointing up. */}
      <path
        d={`M${x + w - 22} ${y + 19} l4 -4 l4 4`}
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={x}
        y1={y + 30}
        x2={x + w}
        y2={y + 30}
        className="stroke-slate-200"
        strokeWidth={1}
      />
      {children}
    </g>
  );
}
