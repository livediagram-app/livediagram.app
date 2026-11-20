// What a livedocuments page holds, drawn as the real elements look on a slide, an infographic or an article: running
// text, a heading and its rule, a bar chart, a picture, a stat, a slide's whole content, and your own pointer. The
// page itself (its sheet, label card and title bar) is ./doc-page's.

import type { ReactNode } from 'react';
import { Label } from '@liveworkspace/help-site/art/primitives';

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
      <circle
        cx={x + w * 0.76}
        cy={y + h * 0.26}
        r={Math.min(w, h) * 0.09}
        className="fill-brand-400"
      />
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
      <BarChart
        x={x + w * 0.5}
        y={y + pad + size * 0.3}
        w={w * 0.42}
        h={h - 2 * pad - size * 0.3}
      />
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
