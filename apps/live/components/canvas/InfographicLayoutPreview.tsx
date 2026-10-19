'use client';

import { trustedHtml } from '@livediagram/ui';

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
  pageIsDark,
  pageSurface,
  wireframeFrameSvg,
  svgArrow,
  svgBoxed,
  type Element,
  type LaidOutPage,
  type WireframeFrameTheme,
} from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { resolveIconArtLoaded, resolveStickerArtLoaded } from '@/lib/icon-registry';
import { pageSheetStyle } from '@/lib/page-paint';
import { PageMotionLayer } from './PageMotionLayer';
import { buildPageLayoutOver } from '@livediagram/templates';
import { useCanvasSurface } from './CanvasSurfaceContext';
import { WireframeDeviceSheet } from './WireframeDeviceSheet';
import { useImageSources } from './page-image-access';

export function InfographicLayoutPreview({
  page,
  layout,
  tabFont,
  elements,
  pages,
  frameTheme,
}: {
  // The tab theme's colours, for a wireframe page's frame in the Theme look.
  frameTheme?: WireframeFrameTheme;
  page: LaidOutPage;
  layout: PageLayoutId;
  tabFont?: string;
  // The tab's elements and its laid-out pages: the content on this page the layout carries over.
  elements?: Element[];
  pages?: readonly LaidOutPage[];
}) {
  const canvas = useCanvasSurface();
  const surface = pageSurface(page) ?? canvas;
  const { rect } = page;
  // A wireframe page previews on its device (WireframeDeviceSheet), not a bare sheet.
  const wireframe = page.kind === 'wireframe';
  const dark = pageIsDark(page);
  const device = useMemo(
    () =>
      wireframe
        ? wireframeFrameSvg(page, { dark, ...(frameTheme ? { theme: frameTheme } : {}) })
        : null,
    // oxlint-disable-next-line react/exhaustive-deps
    [
      wireframe,
      dark,
      frameTheme,
      rect.x,
      rect.y,
      page.device,
      page.orientation,
      page.frameLook,
      page.systemBars,
    ],
  );
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
    };
    const drawn = [
      ...els.filter(isBoxed).map((el) => svgBoxed(el, opts)),
      ...els.flatMap((el) =>
        el.type === 'arrow' ? [svgArrow(el, els, surface, tabFont, labels, 'lvd-layout-ko-')] : [],
      ),
    ].join('');
    // A wireframe page's layout is cut to its screen, its system bars over it, as placed.
    return device
      ? `<defs><clipPath id="lvd-layout-screen"><path d="${device.screen}"/></clipPath></defs>` +
          `<g clip-path="url(#lvd-layout-screen)">${drawn}</g>${device.over}`
      : drawn;
  }, [els, surface, tabFont, imageSource, device]);
  return (
    <div
      aria-hidden
      data-layout-preview={layout}
      className={`pointer-events-none absolute z-[1] animate-fade-in motion-reduce:animate-none ${
        page.background?.fill || wireframe
          ? ''
          : 'bg-white text-slate-900/10 dark:bg-slate-900 dark:text-white/10'
      }`}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        ...(wireframe ? {} : pageSheetStyle(page.background)),
      }}
    >
      {wireframe ? (
        <WireframeDeviceSheet page={page} background={page.background} frameTheme={frameTheme} />
      ) : null}
      {/* A slide's animated background keeps moving under the previewed layout. */}
      {!wireframe && page.background?.fill?.kind === 'gradient' && page.background.fill.motion ? (
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
