'use client';

// An article page's header and footer on the canvas (docs/specs/007-editor/article-pages.md "Headers and
// footers"): the page number's 12 px muted type, the left part on the left margin, the centre one
// centred, the right one on the right margin, each cut short with an ellipsis rather than running into
// the next. A view of the style, never pressed. Laid out by pageBandLayout, as an export draws them.
import type { CSSProperties } from 'react';
import type { BandLine, PageBandLayout } from '@/lib/article/article-band-layout';

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

export function PageBands({ layout, dark }: { layout: PageBandLayout; dark: boolean }) {
  const colour = dark ? 'rgb(255 255 255 / 0.55)' : 'rgb(71 85 105 / 0.8)';
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
