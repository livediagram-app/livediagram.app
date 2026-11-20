// A category's flyout hanging under the palette strip (docs/specs/007-editor/toolbar-layout.md "The flyout"): a white
// popover with a hairline and the soft lift, its header (the category's glyph on a soft brand plate, its name, one
// line on what it is for and its tile count as a badge), its body, and its fixed footer saying what to do. Drawn once
// for every scene that opens a category.

import type { ReactNode } from 'react';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';
import { STRIP_NAMES, StripGlyph, type StripItem } from './editor-chrome';
import { FlyoutCard, FlyoutGroup, FlyoutTile } from '@liveworkspace/help-site/art/flyout-parts';

export { FlyoutCard, FlyoutGroup, FlyoutTile };

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
            x={x + 40 + name.length * 6.2}
            y={y + 7.5}
            width={15}
            height={11}
            rx={5.5}
            className="fill-slate-100"
          />
          <Label
            x={x + 47.5 + name.length * 6.2}
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

/** A category's flyout in its compact form, for scenes whose body is laid out under a 22-unit title bar: the category's
 *  glyph and its name (or `title`, for a row's side panel), a hairline, then the body. */
export function CategoryPanel({
  x,
  y,
  w,
  h,
  item,
  title,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  item: StripItem;
  title?: string;
  children?: ReactNode;
}) {
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
      <StripGlyph item={item} x={x + 15} y={y + 11.5} size={9} className="stroke-brand-700" />
      <Label x={x + 26} y={y + 12} size={10} weight={650} tone="strong">
        {title ?? STRIP_NAMES[item]}
      </Label>
      <line
        x1={x}
        y1={y + 22}
        x2={x + w}
        y2={y + 22}
        className="stroke-slate-100"
        strokeWidth={0.75}
      />
      {children}
    </g>
  );
}
