// A page on livedocuments' canvas as the editor draws it (docs/specs/007-editor/pages-mode.md): the sheet itself
// (white, a hairline, the soft lift), its label card over the top-left corner (its name in strong ink, its size and
// kind muted: PageLabelCard) and its title bar card over the top-right corner (Style, then Layout and Background,
// then the lock and the cog: PageTitleBar), both at the canvas's small chrome size. Then the content livedocuments
// pages hold, drawn as the real elements look on a slide, an infographic or an article: a heading, running text,
// a bar chart, a picture, a stat.

import type { ReactNode } from 'react';
import {
  lucideLockOpen,
  lucidePaintRoller,
  lucidePalette,
  lucidePanelsTopLeft,
  lucideSettings,
} from '@liveworkspace/icons/lucide';
import { Label, Lift } from '@liveworkspace/help-site/art/primitives';
import { Icon } from './editor-chrome';

// --- The page's own chrome ---------------------------------------------------

const TAG_H = 15;

/** The page's label card, its left edge at `x` and its foot at `bottom`: the name in strong ink, then the rest
 *  muted. */
export function PageTag({
  x,
  bottom,
  name,
  rest = '16:9',
}: {
  x: number;
  bottom: number;
  name?: string;
  rest?: string;
}) {
  const text = name ? `${name} · ${rest}` : rest;
  const w = text.length * 4.75 + 11;
  const y = bottom - TAG_H;
  return (
    <g>
      <Lift x={x} y={y} w={w} h={TAG_H} r={4} />
      <rect
        x={x}
        y={y}
        width={w}
        height={TAG_H}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={x + 5.5} y={y + TAG_H / 2 + 0.5} size={9} weight={500} tone="muted">
        {name ? (
          <tspan className="fill-slate-700" fontWeight={600}>
            {name}
          </tspan>
        ) : null}
        {name ? ' · ' : null}
        {rest}
      </Label>
    </g>
  );
}

/** What the title bar holds: `style` named or not, the look group (Layout, Background) and the page group (lock,
 *  cog). `on` tints one control (its popover open). */
export type BarParts = {
  named?: boolean;
  look?: boolean;
  on?: 'style' | 'layout' | 'background' | 'cog';
};

/** The title bar card, its right edge at `right` and its foot at `bottom`. Returns nothing about its width: the
 *  page label keeps to the left of it. */
export function PageBar({
  right,
  bottom,
  named = false,
  look = true,
  on,
}: BarParts & { right: number; bottom: number }) {
  const cell = 13;
  const styleW = named ? 34 : cell;
  const groups: { key: string; w: number; prims: unknown; label?: string }[][] = [
    [{ key: 'style', w: styleW, prims: lucidePalette, label: named ? 'Style' : undefined }],
    ...(look
      ? [
          [
            { key: 'layout', w: cell, prims: lucidePanelsTopLeft },
            { key: 'background', w: cell, prims: lucidePaintRoller },
          ],
        ]
      : []),
    [
      { key: 'lock', w: cell, prims: lucideLockOpen },
      { key: 'cog', w: cell, prims: lucideSettings },
    ],
  ];
  const inner =
    groups.reduce((s, g) => s + g.reduce((t, b) => t + b.w, 0), 0) + (groups.length - 1) * 7;
  const w = inner + 4;
  const x = right - w;
  const y = bottom - TAG_H;
  const cy = y + TAG_H / 2;
  let at = x + 2;
  const drawn: ReactNode[] = [];
  groups.forEach((g, gi) => {
    if (gi > 0) {
      drawn.push(
        <line
          key={`d${gi}`}
          x1={at + 3.5}
          y1={cy - 4}
          x2={at + 3.5}
          y2={cy + 4}
          className="stroke-slate-200"
          strokeWidth={0.75}
        />,
      );
      at += 7;
    }
    g.forEach((b) => {
      const tinted = b.key === on;
      drawn.push(
        <g key={b.key}>
          {tinted && (
            <rect
              x={at}
              y={y + 1.5}
              width={b.w}
              height={TAG_H - 3}
              rx={3}
              className="fill-brand-50"
            />
          )}
          <Icon
            prims={b.prims as never}
            x={at + (b.label ? 7 : b.w / 2)}
            y={cy}
            size={7.5}
            className={tinted ? 'stroke-brand-700' : 'stroke-slate-600'}
          />
          {b.label && (
            <Label x={at + 13} y={cy + 0.5} size={9} weight={500} tone={tinted ? 'accent' : 'body'}>
              {b.label}
            </Label>
          )}
        </g>,
      );
      at += b.w;
    });
  });
  return (
    <g>
      <Lift x={x} y={y} w={w} h={TAG_H} r={4} />
      <rect
        x={x}
        y={y}
        width={w}
        height={TAG_H}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      {drawn}
    </g>
  );
}

/** The sheet alone: white, a hairline, the soft lift. */
export function Sheet({
  x,
  y,
  w,
  h,
  fill = 'fill-white',
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      <Lift x={x} y={y} w={w} h={h} r={2} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        className={`${fill} stroke-slate-200`}
        strokeWidth={0.75}
      />
      {children}
    </g>
  );
}

/** A page on the canvas: the sheet, and over it the label card (`name`, `rest`) and the title bar (unless `bare`, as
 *  a Viewer sees it or a page drawn small). */
export function Page({
  x,
  y,
  w,
  h,
  name,
  rest,
  bare = false,
  bar,
  fill,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  rest?: string;
  bare?: boolean;
  bar?: BarParts;
  fill?: string;
  children?: ReactNode;
}) {
  return (
    <g>
      {!bare && (
        <>
          <PageTag x={x} bottom={y - 3} name={name} rest={rest} />
          <PageBar right={x + w} bottom={y - 3} {...bar} />
        </>
      )}
      <Sheet x={x} y={y} w={w} h={h} fill={fill}>
        {children}
      </Sheet>
    </g>
  );
}

export * from './doc-content';
