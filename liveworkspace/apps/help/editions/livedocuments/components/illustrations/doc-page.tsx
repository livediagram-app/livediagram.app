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
            <Label
              x={at + 13}
              y={cy + 0.5}
              size={9}
              weight={500}
              tone={tinted ? 'accent' : 'body'}
            >
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

// --- What a page holds -------------------------------------------------------

/** Running text: `n` muted bars from (x, y), `gap` apart, the last one short. */
export function Lines({
  x,
  y,
  w,
  n = 3,
  gap = 6,
  h = 2.5,
  tone = 'fill-slate-200',
}: {
  x: number;
  y: number;
  w: number;
  n?: number;
  gap?: number;
  h?: number;
  tone?: string;
}) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={i === n - 1 && n > 1 ? w * 0.62 : w}
          height={h}
          rx={h / 2}
          className={tone}
        />
      ))}
    </g>
  );
}

/** A heading set in the page's ink, from (x, y) as its middle. */
export function Heading({
  x,
  y,
  children,
  size = 12,
  anchor = 'start',
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <Label x={x} y={y} size={size} weight={700} tone="strong" anchor={anchor}>
      {children}
    </Label>
  );
}

/** A short accent rule under a title, as the theme's slide layouts draw one. */
export function Rule({ x, y, w = 18 }: { x: number; y: number; w?: number }) {
  return <rect x={x} y={y} width={w} height={2.5} rx={1.25} className="fill-brand-500" />;
}

/** A bar chart: `values` (0 to 1) as bars in the theme's brand ramp, standing on a hairline, filling `w` by `h`. */
export function BarChart({
  x,
  y,
  w,
  h,
  values = [0.45, 0.7, 0.55, 0.95],
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  values?: readonly number[];
}) {
  const step = w / values.length;
  const bw = step * 0.62;
  const tones = ['fill-brand-300', 'fill-brand-400', 'fill-brand-300', 'fill-brand-500'];
  return (
    <g>
      {values.map((v, i) => (
        <rect
          key={i}
          x={x + i * step + (step - bw) / 2}
          y={y + h - v * h}
          width={bw}
          height={v * h}
          rx={1}
          className={tones[i % tones.length]}
        />
      ))}
      <line
        x1={x}
        y1={y + h + 0.5}
        x2={x + w}
        y2={y + h + 0.5}
        className="stroke-slate-300"
        strokeWidth={0.75}
      />
    </g>
  );
}

/** A picture: a soft sky, two hills and a sun, clipped to its frame's corners. */
export function Picture({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} className="fill-brand-100" />
      <path
        d={`M${x} ${y + h * 0.78} L${x + w * 0.32} ${y + h * 0.42} L${x + w * 0.55} ${y + h * 0.66} L${x + w * 0.72} ${y + h * 0.5} L${x + w} ${y + h * 0.8} V${y + h - 2} a2 2 0 0 1 -2 2 H${x + 2} a2 2 0 0 1 -2 -2 Z`}
        className="fill-brand-300"
      />
      <circle cx={x + w * 0.76} cy={y + h * 0.26} r={Math.min(w, h) * 0.09} className="fill-brand-400" />
    </g>
  );
}

/** A big number with its label under it, as the Big Number and Stat Row components set one. */
export function Stat({
  x,
  y,
  value,
  label,
  size = 14,
  anchor = 'start',
}: {
  x: number;
  y: number;
  value: string;
  label: string;
  size?: number;
  anchor?: 'start' | 'middle';
}) {
  return (
    <g>
      <Label x={x} y={y} size={size} weight={700} tone="accent" anchor={anchor}>
        {value}
      </Label>
      <Label x={x} y={y + size * 0.6 + 6} size={9} tone="muted" anchor={anchor}>
        {label}
      </Label>
    </g>
  );
}

/** A slide's whole content laid out in its box: `title` slides a title and subtitle, `chart` a heading over a chart
 *  and a caption, `picture` a heading and text beside a picture. */
export function SlideContent({
  x,
  y,
  w,
  h,
  title,
  layout = 'chart',
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  layout?: 'title' | 'chart' | 'picture';
}) {
  const pad = w * 0.08;
  const size = Math.max(9, Math.min(14, w / 14));
  if (layout === 'title') {
    return (
      <g>
        <Heading x={x + pad} y={y + h * 0.42} size={size * 1.15}>
          {title}
        </Heading>
        <Rule x={x + pad} y={y + h * 0.42 + size * 0.9} />
        <Lines x={x + pad} y={y + h * 0.42 + size * 0.9 + 9} w={w * 0.45} n={1} />
      </g>
    );
  }
  if (layout === 'picture') {
    return (
      <g>
        <Heading x={x + pad} y={y + pad + size * 0.6} size={size}>
          {title}
        </Heading>
        <Lines x={x + pad} y={y + pad + size * 1.7} w={w * 0.4} n={4} />
        <Picture x={x + w * 0.54} y={y + pad} w={w * 0.38} h={h - 2 * pad} />
      </g>
    );
  }
  return (
    <g>
      <Heading x={x + pad} y={y + pad + size * 0.6} size={size}>
        {title}
      </Heading>
      <Lines x={x + pad} y={y + pad + size * 1.6} w={w * 0.34} n={3} />
      <BarChart x={x + w * 0.5} y={y + pad + size * 0.3} w={w * 0.42} h={h - 2 * pad - size * 0.3} />
    </g>
  );
}

/** Your own mouse pointer, tip at (x, y): the system arrow in ink with its white keyline. */
export function Pointer({ x, y }: { x: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(0.8)`}
      d="M0 0 L0 15.5 L4.2 11.8 L6.8 17.6 L9.4 16.4 L6.9 10.7 L12.4 10.3 Z"
      className="fill-slate-800 stroke-white"
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  );
}
