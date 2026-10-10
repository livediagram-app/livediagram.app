'use client';

// A layout previewed on its page while its tile is hovered (docs/specs/007-editor/
// illustrate-pages.md "Layouts"): the layout built for the page, drawn over the whole sheet in the
// page's own background so it covers what is there now, through the same renderer the exports
// use. A picture only: nothing is placed, nothing enters the history, and it goes when the hover
// does. Above the element layer, taking no presses.
import { useMemo } from 'react';
import {
  arrowLabelFontStack,
  arrowLabelPass,
  isBoxed,
  pageSurface,
  svgArrow,
  svgBoxed,
  type LaidOutPage,
} from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { resolveIconArtLoaded, resolveStickerArtLoaded } from '@/lib/icon-registry';
import { pageSheetStyle } from '@/lib/illustrate-page-paint';
import { buildPageLayout } from '@livediagram/templates';
import { useCanvasSurface } from './CanvasSurfaceContext';

export function InfographicLayoutPreview({
  page,
  layout,
  tabFont,
}: {
  page: LaidOutPage;
  layout: PageLayoutId;
  tabFont?: string;
}) {
  const canvas = useCanvasSurface();
  const surface = pageSurface(page) ?? canvas;
  const { rect } = page;
  const markup = useMemo(() => {
    const els = buildPageLayout(layout, page);
    const labels = arrowLabelPass(els, { fontFamilyOf: (a) => arrowLabelFontStack(a, tabFont) });
    const opts = {
      resolveIconArt: resolveIconArtLoaded,
      resolveStickerArt: resolveStickerArtLoaded,
      tabFont,
      surface,
    };
    return [
      ...els.filter(isBoxed).map((el) => svgBoxed(el, opts)),
      ...els.flatMap((el) =>
        el.type === 'arrow' ? [svgArrow(el, els, surface, tabFont, labels, 'lvd-layout-ko-')] : [],
      ),
    ].join('');
    // The page's shape and paint, not its identity, decide the picture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, rect.x, rect.y, rect.width, rect.height, surface, tabFont]);
  return (
    <div
      aria-hidden
      data-layout-preview={layout}
      className={`pointer-events-none absolute z-[1] animate-fade-in motion-reduce:animate-none ${
        page.background?.fill
          ? ''
          : 'bg-white text-slate-900/10 dark:bg-slate-900 dark:text-white/10'
      }`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        ...pageSheetStyle(page.background),
      }}
    >
      <svg
        width={rect.width}
        height={rect.height}
        viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`}
        // Our own renderer's output (every label is xmlEscaped inside it).
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}
