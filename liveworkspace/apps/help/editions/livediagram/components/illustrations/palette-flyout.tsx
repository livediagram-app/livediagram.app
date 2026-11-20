// A category's flyout hanging under livediagram's palette strip (docs/specs/007-editor/toolbar-layout.md "The
// flyout"): a white popover with a hairline and the soft lift, its header (the category's glyph on a soft brand
// plate, its name, its one-line tagline and its tile count), its body and its footer. The body's groups, tiles and
// cards are the same component in every editor and drawn once in livedocuments' kit; the header is drawn here with
// livediagram's own categories.

import type { ReactNode } from 'react';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';
import { STRIP_NAMES, StripGlyph, type StripItem } from './strip-glyphs';

export { FlyoutCard, FlyoutGroup, FlyoutTile } from '@liveworkspace/help-site/art/flyout-parts';

export const FLYOUT_HEAD = 34;
export const FLYOUT_FOOT = 18;

/** The flyout, top-left at (x, y), `w` by `h`: header, body (children, from y + FLYOUT_HEAD) and footer (none when
 *  `footer` is empty). */
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
      {footer && (
        <g>
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
      )}
    </g>
  );
}
