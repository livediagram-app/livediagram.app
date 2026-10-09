'use client';

// A layout's preview tile art (docs/specs/007-editor/illustrate-pages.md "Layouts"): the layout
// built for THIS page's size and orientation, drawn small as a wireframe, so the tile shows what
// will land rather than a stock picture. Text is drawn as bars (a title thicker), images as a
// shaded block, icons as dots, everything else as an outlined box.
import { useMemo } from 'react';
import {
  arcGeometry,
  hasWordmarkType,
  labelFontPx,
  type Element,
  type LaidOutPage,
} from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { buildPageLayout } from '@/lib/page-layout-build';

// Wide enough to read a layout's parts: two tiles to a row in the panel and the in-page card.
const THUMB_W = 120;

function ElementGlyph({ el }: { el: Element }) {
  if (el.type === 'arrow') return null;
  const { x, y, width: w, height: h } = el;
  if (el.type === 'text' && el.textArc) {
    // Arched text (a logo's badge or seal): a bar along its arc.
    const px = labelFontPx(el.textSize) * (el.textScale ?? 1);
    const { d } = arcGeometry({ width: w, height: h }, el.textArc, px);
    return (
      <path
        d={d}
        transform={`translate(${x} ${y})`}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.75}
        strokeWidth={px * 0.7}
        strokeLinecap="round"
        strokeDasharray={`${px * 4} ${px * 6}`}
      />
    );
  }
  if (el.type === 'text' && hasWordmarkType(el)) {
    // Wordmark type (a logo's name): a bar as long and as tall as the words would set, placed by
    // the text's alignment, so a short name in a large box stays a short name.
    const px = labelFontPx(el.textSize) * (el.textScale ?? 1);
    const chars = (el.label ?? '').length;
    const barW = Math.min(w * 0.95, chars * px * (0.58 + (el.letterSpacing ?? 0)));
    const barH = Math.min(h * 0.6, px * 0.72);
    const ax = el.textAlignX ?? 'center';
    const bx = ax === 'left' ? x : ax === 'right' ? x + w - barW : x + (w - barW) / 2;
    return (
      <rect
        x={bx}
        y={y + (h - barH) / 2}
        width={barW}
        height={barH}
        rx={barH / 3}
        fill="currentColor"
        opacity={0.75}
      />
    );
  }
  if (el.type === 'text') {
    const big = el.textSize === 'scale' || (el.textScale ?? 1) > 1;
    const barH = big ? h * 0.55 : Math.min(h * 0.4, 14);
    const barW = big ? Math.min(w, w * 0.9) : w * 0.85;
    return (
      <rect
        x={x}
        y={big ? y + (h - barH) / 2 : y}
        width={barW}
        height={barH}
        rx={barH / 3}
        fill="currentColor"
        opacity={big ? 0.75 : 0.35}
      />
    );
  }
  if (el.type === 'image') {
    return <rect x={x} y={y} width={w} height={h} rx={12} fill="currentColor" opacity={0.16} />;
  }
  if (el.type === 'shape' && el.shape === 'icon') {
    return <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 2.4} fill="var(--accent)" />;
  }
  // A shape's own outline where it has a simple one (a logo is made of rings, discs and
  // diamonds); an outlined shape (no fill) drawn as its line alone.
  const outlined = el.type === 'shape' && el.fillColor === 'transparent';
  const paint = {
    fill: 'var(--accent)',
    fillOpacity: outlined ? 0 : 0.14,
    stroke: 'var(--accent)',
    strokeOpacity: outlined ? 0.85 : 0.6,
    strokeWidth: Math.max(w, h) / (outlined ? 50 : 90),
  };
  if (el.type === 'shape' && el.shape === 'circle') {
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...paint} />;
  }
  if (el.type === 'shape' && el.shape === 'diamond') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    return <polygon points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`} {...paint} />;
  }
  if (el.type === 'shape' && el.shape === 'hexagon') {
    const q = w * 0.25;
    return (
      <polygon
        points={`${x + q},${y} ${x + w - q},${y} ${x + w},${y + h / 2} ${x + w - q},${y + h} ${x + q},${y + h} ${x},${y + h / 2}`}
        {...paint}
      />
    );
  }
  if (el.type === 'shape' && el.shape === 'triangle') {
    return <polygon points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} {...paint} />;
  }
  if (el.type === 'shape' && el.shape === 'star') {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? 0.5 : 0.2;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      return `${x + w / 2 + w * r * Math.cos(a)},${y + h / 2 + h * r * Math.sin(a)}`;
    });
    return <polygon points={pts.join(' ')} {...paint} />;
  }
  if (el.type === 'shape' && el.shape === 'stadium') {
    return <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) / 2} {...paint} />;
  }
  return <rect x={x} y={y} width={w} height={h} rx={10} {...paint} />;
}

export function LayoutThumb({
  layout,
  page,
  width = THUMB_W,
}: {
  layout: PageLayoutId;
  page: LaidOutPage;
  // The tile's width in px (a category card's fan draws them smaller).
  width?: number;
}) {
  const { rect } = page;
  const els = useMemo(
    () => buildPageLayout(layout, page),
    // Rebuilt only when the page's shape changes (it mints fresh ids each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, rect.x, rect.y, rect.width, rect.height],
  );
  const h = (width * rect.height) / rect.width;
  return (
    <svg
      width={width}
      height={Math.min(h, width * 1.5)}
      viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className="rounded-sm bg-white text-slate-700 shadow-sm ring-1 ring-slate-900/10 [--accent:var(--color-brand-500)] dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10"
    >
      {els.map((el) => (
        <ElementGlyph key={el.id} el={el} />
      ))}
    </svg>
  );
}
