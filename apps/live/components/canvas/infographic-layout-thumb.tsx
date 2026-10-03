'use client';

// A layout's preview tile art (docs/specs/007-editor/infographic-pages.md "Layouts"): the layout
// built for THIS page's size and orientation, drawn small as a wireframe, so the tile shows what
// will land rather than a stock picture. Text is drawn as bars (a title thicker), images as a
// shaded block, icons as dots, everything else as an outlined box.
import { useMemo } from 'react';
import type { Element, LaidOutPage } from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { buildPageLayout } from '@/lib/page-layout-build';

const THUMB_W = 76;

function ElementGlyph({ el }: { el: Element }) {
  if (el.type === 'arrow') return null;
  const { x, y, width: w, height: h } = el;
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
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={10}
      fill="var(--accent)"
      fillOpacity={0.14}
      stroke="var(--accent)"
      strokeOpacity={0.6}
      strokeWidth={Math.max(w, h) / 90}
    />
  );
}

export function LayoutThumb({ layout, page }: { layout: PageLayoutId; page: LaidOutPage }) {
  const { rect } = page;
  const els = useMemo(
    () => buildPageLayout(layout, page),
    // Rebuilt only when the page's shape changes (it mints fresh ids each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, rect.x, rect.y, rect.width, rect.height],
  );
  const h = (THUMB_W * rect.height) / rect.width;
  return (
    <svg
      width={THUMB_W}
      height={Math.min(h, THUMB_W * 1.5)}
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
