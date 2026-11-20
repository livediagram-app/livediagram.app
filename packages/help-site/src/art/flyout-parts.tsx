// The body parts of a palette category's flyout, the same in every editor (liveworkspace/docs/specs/017-help/help-centre.md
// "Figures"): a group heading with its hairline, a picture tile (as Shapes shows its tiles) and a card (glyph, name,
// one-line blurb, as every other category shows them). Each edition draws its own flyout header around them.

import type { ReactNode } from 'react';
import { Label } from './primitives';

/** A group's small heading with its hairline, from (x, y) across `w`. */
export function FlyoutGroup({ x, y, w, name }: { x: number; y: number; w: number; name: string }) {
  return (
    <g>
      <Label x={x} y={y} size={9} weight={600} tone="muted">
        {name}
      </Label>
      <line
        x1={x + name.length * 5 + 6}
        y1={y}
        x2={x + w}
        y2={y}
        className="stroke-slate-100"
        strokeWidth={0.75}
      />
    </g>
  );
}

/** A picture tile, as Shapes shows its tiles: the picture on a pale plate, the name under it. */
export function FlyoutTile({
  x,
  y,
  w = 36,
  name,
  children,
  hover = false,
}: {
  x: number;
  y: number;
  w?: number;
  name: string;
  children: ReactNode;
  hover?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={w}
        rx={5}
        className={hover ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-100'}
        strokeWidth={0.75}
      />
      <g transform={`translate(${x + w / 2} ${y + w / 2})`}>{children}</g>
      <Label x={x + w / 2} y={y + w + 7} size={9} tone="body" anchor="middle">
        {name}
      </Label>
    </g>
  );
}

/** A card, as every category but Shapes shows its tiles: the glyph on a plate, the name and the one-line blurb. */
export function FlyoutCard({
  x,
  y,
  w,
  name,
  blurb,
  glyph,
  hover = false,
}: {
  x: number;
  y: number;
  w: number;
  name: string;
  blurb: string;
  glyph?: ReactNode;
  hover?: boolean;
}) {
  return (
    <g>
      {hover && (
        <rect
          x={x - 3}
          y={y - 3}
          width={w + 6}
          height={26}
          rx={5}
          className="fill-brand-50 stroke-brand-200"
          strokeWidth={0.75}
        />
      )}
      <rect x={x} y={y} width={20} height={20} rx={4.5} className="fill-brand-50" />
      <g transform={`translate(${x + 10} ${y + 10})`}>{glyph}</g>
      <Label x={x + 26} y={y + 5.5} size={9.5} weight={600} tone="strong">
        {name}
      </Label>
      <Label x={x + 26} y={y + 15.5} size={9} tone="muted">
        {blurb}
      </Label>
    </g>
  );
}
