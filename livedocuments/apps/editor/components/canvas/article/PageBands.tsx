'use client';

// An article page's header and footer on the canvas (docs/specs/007-editor/article-pages.md "Headers and
// footers"): the page number's 12 px muted type, the left part on the left margin, the centre one
// centred, the right one on the right margin, each cut short with an ellipsis rather than running into
// the next. A view of the style, never pressed. Laid out by pageBandLayout, as an export draws them.
import type { CSSProperties } from 'react';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import type { BandLine, PageBandLayout } from '@/lib/article/article-band-layout';

/** The bands' muted ink on a light page and on a dark one: each holds 4.5:1 on its paper (white, and the dark
 *  appearance's slate-900), as their 12 px type needs. */
export const PAGE_BAND_INK = { light: 'rgb(71 85 105 / 0.8)', dark: 'rgb(255 255 255 / 0.55)' };

const PARTS = ['left', 'center', 'right'] as const;

function Line({
  line,
  layout,
  role,
  colour,
}: {
  line: BandLine;
  layout: PageBandLayout;
  role: 'header' | 'footer';
  colour: string;
}) {
  const style: CSSProperties = {
    left: layout.left,
    width: Math.max(0, layout.right - layout.left),
    top: line.y - 9,
    height: 18,
    color: colour,
    fontFamily: layout.font,
  };
  return (
    <div
      aria-hidden
      data-page-band={role}
      // The page number keeps its old hook for what reads it (a test, a check of the page).
      {...(role === 'footer' && line.parts.center ? { 'data-page-number': '' } : {})}
      className="pointer-events-none absolute grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-3 text-[12px] leading-[18px] tabular-nums"
      style={style}
    >
      {PARTS.map((part) => (
        <span
          key={part}
          data-part={part}
          className={`min-w-0 truncate ${
            part === 'left' ? 'text-left' : part === 'center' ? 'text-center' : 'text-right'
          }`}
        >
          {line.parts[part] ?? ''}
        </span>
      ))}
    </div>
  );
}

// `dark`: a page with a fill of its own, by its tone; absent, the plain paper, which is the canvas's own surface
// (white in light, slate-900 in dark), as the writing on it is inked (ArticleFlows' inkOf).
export function PageBands({ layout, dark }: { layout: PageBandLayout; dark?: boolean }) {
  const surface = useCanvasSurface();
  const colour = (dark ?? surface === 'dark') ? PAGE_BAND_INK.dark : PAGE_BAND_INK.light;
  return (
    <>
      {layout.header ? (
        <Line line={layout.header} layout={layout} role="header" colour={colour} />
      ) : null}
      {layout.footer ? (
        <Line line={layout.footer} layout={layout} role="footer" colour={colour} />
      ) : null}
    </>
  );
}
