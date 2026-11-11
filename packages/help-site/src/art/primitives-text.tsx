// The text primitives of the help illustrations' kit (./primitives): labels, disc text and
// the muted bars that stand in for running copy.
import { type ReactNode } from 'react';
import { capBandBaselineY } from '@liveworkspace/icons';

// --- Text --------------------------------------------------------------------

/** A label. `tone` picks a slate weight; `accent`/`onAccent` for brand text. */
export function Label({
  x,
  y,
  children,
  size = 12,
  weight = 400,
  tone = 'body',
  anchor = 'start',
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  weight?: number | 'bold';
  tone?: 'body' | 'muted' | 'strong' | 'accent' | 'onAccent';
  anchor?: 'start' | 'middle' | 'end';
  className?: string;
}) {
  const toneClass =
    className ??
    {
      body: 'fill-slate-600',
      muted: 'fill-slate-400',
      strong: 'fill-slate-800',
      accent: 'fill-brand-600',
      // White on a solid accent in both appearances (see packages/help-site/src/help-art.css).
      onAccent: 'fill-white help-art-as-drawn',
    }[tone];
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight === 'bold' ? 700 : weight}
      textAnchor={anchor}
      dominantBaseline="middle"
      className={toneClass}
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {children}
    </text>
  );
}

/** A glyph in a disc (an initial, a numeral), white on the disc's solid fill, centred on its cap band rather than
 *  its em box: SVG has no text trimming, so `dominant-baseline: middle` leaves the letters low
 *  (docs/specs/004-interface-design/optical-alignment.md, "SVG text centres on its cap band too"). */
export function DiscText({
  cx,
  cy,
  size,
  weight = 700,
  className = 'fill-white help-art-as-drawn',
  children,
}: {
  cx: number;
  cy: number;
  size: number;
  weight?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <text
      x={cx}
      y={capBandBaselineY(cy, size)}
      fontSize={size}
      fontWeight={weight}
      textAnchor="middle"
      className={className}
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {children}
    </text>
  );
}

/** A muted "lorem" bar standing in for a run of text. */
export function TextBar({
  x,
  y,
  w,
  h = 6,
  tone = 'muted',
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  tone?: 'muted' | 'faint' | 'accent';
}) {
  const cls = { muted: 'fill-slate-300', faint: 'fill-slate-200', accent: 'fill-brand-200' }[tone];
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} className={cls} />;
}
