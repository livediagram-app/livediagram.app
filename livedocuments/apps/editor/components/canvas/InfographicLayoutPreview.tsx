'use client';

import { trustedHtml } from '@livedocuments/ui';

// A layout previewed on its page while its tile is hovered (docs/specs/007-editor/
// pages-mode.md "Layouts"): the layout built for the page, drawn over the whole sheet in the
// page's own background so it covers what is there now, through the same renderer the exports
// use. A picture only: nothing is placed, nothing enters the history, and it goes when the hover
// does. The page's own words and pictures are carried into it as placing it would carry them
// (buildPageLayoutOver), so the preview shows exactly what a press lands. Above the element
// layer, taking no presses.
import { useMemo } from 'react';
import {
  arrowLabelFontStack,
  arrowLabelPass,
  elementsOnPage,
  isBoxed,
  pageSurface,
  svgArrow,
  svgBoxed,
  type Element,
  type LaidOutPage,
} from '@livedocuments/document';
import type { PageLayoutId } from '@livedocuments/templates';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { pageSheetStyle } from '@/lib/page-paint';
import { PageMotionLayer } from './PageMotionLayer';
import { buildPageLayoutOver } from '@livedocuments/templates';
import { useCanvasChartPalette, useCanvasSurface } from './CanvasSurfaceContext';
import { useImageSources } from './page-image-access';

export function InfographicLayoutPreview({
  page,
  layout,
  tabFont,
  elements,
  pages,
}: {
  page: LaidOutPage;
  layout: PageLayoutId;
  tabFont?: string;
  // The tab's elements and its laid-out pages: the content on this page the layout carries over.
  elements?: Element[];
  pages?: readonly LaidOutPage[];
}) {
  const canvas = useCanvasSurface();
  const surface = pageSurface(page) ?? canvas;
  const chartPalette = useCanvasChartPalette();
  const { rect } = page;
  const els = useMemo(
    () =>
      buildPageLayoutOver(
        layout,
        page,
        elements && pages ? elementsOnPage(elements, pages, page.id) : [],
      ),
    // The page's shape, not its identity, decides the layout; its content, what carries over.
    // oxlint-disable-next-line react/exhaustive-deps
    [layout, rect.x, rect.y, rect.width, rect.height, elements, pages],
  );
  // The carried pictures, fetched while the preview shows them (inline bytes paint as they are).
  const imageIds = els.flatMap((el) => (el.type === 'image' && el.imageId ? [el.imageId] : []));
  const imageSource = useImageSources(imageIds);
  const markup = useMemo(() => {
    const labels = arrowLabelPass(els, { fontFamilyOf: (a) => arrowLabelFontStack(a, tabFont) });
    const opts = {
      resolveImageHref: (id: string) => (id.startsWith('data:') ? id : imageSource(id)),
      resolveIconArt: resolveIconArtLoaded,
      resolveStickerArt: resolveStickerArtLoaded,
      tabFont,
      surface,
      chartPalette,
    };
    const drawn = [
      ...els.filter(isBoxed).map((el) => svgBoxed(el, opts)),
      ...els.flatMap((el) =>
        el.type === 'arrow' ? [svgArrow(el, els, surface, tabFont, labels, 'lvd-layout-ko-')] : [],
      ),
    ].join('');
    return drawn;
  }, [els, surface, chartPalette, tabFont, imageSource]);
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
      {/* A slide's animated background keeps moving under the previewed layout. */}
      {page.background?.fill?.kind === 'gradient' && page.background.fill.motion ? (
        <PageMotionLayer
          motion={page.background.fill.motion}
          fill={page.background.fill}
          width={rect.width}
          height={rect.height}
        />
      ) : null}
      <svg
        className="relative"
        width={rect.width}
        height={rect.height}
        viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`}
        // Our own renderer's output (every label is xmlEscaped inside it).
        dangerouslySetInnerHTML={{ __html: trustedHtml(markup) }}
      />
    </div>
  );
}
