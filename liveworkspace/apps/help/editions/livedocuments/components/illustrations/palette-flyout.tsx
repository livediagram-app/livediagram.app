// A category's flyout hanging under the palette strip (docs/specs/007-editor/toolbar-layout.md "The flyout"): a white
// popover with a hairline and the soft lift, its header (the category's glyph on a soft brand plate, its name, one
// line on what it is for and its tile count as a badge), its body, and its fixed footer saying what to do. Drawn once
// for every scene that opens a category.

import type { ReactNode } from 'react';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';
import { STRIP_NAMES, StripGlyph, type StripItem } from './editor-chrome';

export const FLYOUT_HEAD = 34;
export const FLYOUT_FOOT = 18;

/** The flyout, top-left at (x, y), `w` by `h`: header, body (children, from y + FLYOUT_HEAD) and footer. */
export function Flyout({
  x,
  y,
  w,
  h,
  item,
  blurb,
  count,
  footer = 'Click to add one, or drag it onto the canvas.',
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  item: StripItem;
  blurb: string;
  count?: number;
  footer?: string;
  children?: ReactNode;
}) {
  const name = STRIP_NAMES[item];
  return (
    <g>
      <Lift x={x} y={y} w={w} h={h} r={7} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <rect x={x + 8} y={y + 7} width={20} height={20} rx={5} className="fill-brand-50" />
      <StripGlyph item={item} x={x + 18} y={y + 17} size={10} className="stroke-brand-700" />
      <Label x={x + 34} y={y + 13} size={10} weight={650} tone="strong">
        {name}
      </Label>
      <Label x={x + 34} y={y + 24} size={9} tone="muted">
        {blurb}
      </Label>
      {count !== undefined && (
        <g>
          <rect
            x={x + 38 + name.length * 5.6}
            y={y + 7.5}
            width={15}
            height={11}
            rx={5.5}
            className="fill-slate-100"
          />
          <Label
            x={x + 45.5 + name.length * 5.6}
            y={y + 13.5}
            size={9}
            weight={600}
            tone="body"
            anchor="middle"
          >
            {String(count)}
          </Label>
        </g>
      )}
      <line
        x1={x}
        y1={y + FLYOUT_HEAD}
        x2={x + w}
        y2={y + FLYOUT_HEAD}
        className="stroke-slate-100"
        strokeWidth={0.75}
      />
      {children}
      <line
        x1={x}
        y1={y + h - FLYOUT_FOOT}
        x2={x + w}
        y2={y + h - FLYOUT_FOOT}
        className="stroke-slate-100"
        strokeWidth={0.75}
      />
      <Label x={x + 10} y={y + h - FLYOUT_FOOT / 2} size={9} tone="muted">
        {footer}
      </Label>
    </g>
  );
}

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
