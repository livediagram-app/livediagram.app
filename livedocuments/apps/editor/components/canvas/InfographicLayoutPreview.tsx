'use client';

import { htmlProps } from '@livedocuments/ui';

// A layout previewed on its page while its tile is hovered (docs/specs/007-editor/
// pages-mode.md "Layouts"): the layout built for the page, drawn over the whole sheet in the
// page's own background so it covers what is there now, through the same renderer the exports
// use. A picture only: nothing is placed, nothing enters the history, and it goes when the hover
// does. The page's own words and pictures are carried into it as placing it would carry them
// (buildPageLayoutOver), so the preview shows exactly what a press lands. Above the element
// layer, taking no presses.
import { sanitizedHtml } from '@liveworkspace/trusted-types/sanitize';
import { useEffect, useMemo, useState } from 'react';
import {
  arrowLabelFontStack,
  arrowLabelPass,
  elementsOnPage,
  elementsImageIds,
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
import {
  useCanvasChartPalette,
  useCanvasSurface,
} from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { useImageSources } from './page-image-access';

// How long a hovered layout takes to settle in, and the one it replaces (or the whole preview) to fade out.
export const LAYOUT_PREVIEW_IN_MS = 220;
export const LAYOUT_PREVIEW_OUT_MS = 160;

function LayoutLayer({
  page,
  layout,
  tabFont,
  elements,
  pages,
  phase,
}: {
  page: LaidOutPage;
  layout: PageLayoutId;
  tabFont?: string;
  // The tab's elements and its laid-out pages: the content on this page the layout carries over.
  elements?: Element[];
  pages?: readonly LaidOutPage[];
  // Settling in, or fading out as the next layout takes its place.
  phase: Phase;
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
    // oxlint-disable-next-line react/exhaustive-deps -- the page's shape, not its identity, decides the layout; its content, what carries over
    [layout, rect.x, rect.y, rect.width, rect.height, elements, pages],
  );
  // The carried pictures, fetched while the preview shows them (inline bytes paint as they are).
  const imageIds = elementsImageIds(els);
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
    <svg
      // LAYOUT_PREVIEW_IN_MS in, LAYOUT_PREVIEW_OUT_MS out, as literal classes the motion budget reads.
      className={`absolute inset-0 origin-center transition-[opacity,transform] ease-out motion-reduce:transition-none ${
        phase === 'leaving' ? 'duration-[160ms]' : 'duration-[220ms]'
      } ${
        phase === 'shown'
          ? 'scale-100 opacity-100'
          : phase === 'entering'
            ? 'scale-[0.985] opacity-0'
            : 'opacity-0'
      }`}
      width={rect.width}
      height={rect.height}
      viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`}
      // Our own renderer's output (every label is xmlEscaped inside it).
      {...htmlProps(sanitizedHtml(markup, 'svg-content'))}
    />
  );
}

type Phase = 'entering' | 'shown' | 'leaving';

/** A layout previewed on its page: the page's sheet, steady, and the hovered layout settling in over it (a fade and
 *  a slight lift into place), the one before fading out underneath, so moving across the tiles reads as one page
 *  changing rather than pictures swapping. `leaving` fades the whole preview away as the hover ends. */
export function InfographicLayoutPreview({
  page,
  layout,
  tabFont,
  elements,
  pages,
  leaving = false,
}: {
  page: LaidOutPage;
  layout: PageLayoutId;
  tabFont?: string;
  elements?: Element[];
  pages?: readonly LaidOutPage[];
  leaving?: boolean;
}) {
  const { rect } = page;
  // The layouts on the sheet: the hovered one last, any it replaced still fading out under it.
  const [layers, setLayers] = useState<{ id: PageLayoutId; phase: Phase }[]>([
    { id: layout, phase: 'entering' },
  ]);
  // A new hovered layout goes on top as the render sees it; at most the one before stays to fade, so a quick sweep
  // across the tiles never stacks pictures up.
  const top = layers.at(-1);
  if (top?.id !== layout) {
    setLayers([
      ...(top ? [{ id: top.id, phase: 'leaving' as const }] : []),
      { id: layout, phase: 'entering' },
    ]);
  }
  // A frame after it mounts, an entering layout settles (so its transition runs); a leaving one goes when done.
  const entering = layers.some((l) => l.phase === 'entering');
  const fading = layers.some((l) => l.phase === 'leaving');
  useEffect(() => {
    if (!entering) return;
    const raf = requestAnimationFrame(() =>
      setLayers((now) => now.map((l) => (l.phase === 'entering' ? { ...l, phase: 'shown' } : l))),
    );
    return () => cancelAnimationFrame(raf);
  }, [entering]);
  useEffect(() => {
    if (!fading) return;
    const timer = window.setTimeout(
      () => setLayers((now) => now.filter((l) => l.phase !== 'leaving')),
      LAYOUT_PREVIEW_OUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [fading]);
  return (
    <div
      aria-hidden
      data-layout-preview={layout}
      className={`pointer-events-none absolute z-[1] transition-opacity duration-[160ms] ease-out motion-reduce:transition-none ${
        leaving ? 'opacity-0' : 'animate-fade-in opacity-100 motion-reduce:animate-none'
      } ${
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
      {layers.map((l) => (
        <LayoutLayer
          key={l.id}
          page={page}
          layout={l.id}
          phase={l.phase}
          {...(tabFont ? { tabFont } : {})}
          {...(elements ? { elements } : {})}
          {...(pages ? { pages } : {})}
        />
      ))}
    </div>
  );
}

/** The preview while a layout tile is hovered, and for a moment after: the last one stays to fade out
 *  (InfographicLayoutPreview's `leaving`) rather than vanishing as the pointer leaves the tiles. */
export function LayoutPreviewHost({
  page,
  layout,
  ...rest
}: {
  page: LaidOutPage | undefined;
  layout: PageLayoutId | undefined;
  tabFont?: string;
  elements?: Element[];
  pages?: readonly LaidOutPage[];
}) {
  const live = page && layout ? { page, layout } : null;
  const [last, setLast] = useState(live);
  if (live && (live.page !== last?.page || live.layout !== last?.layout)) setLast(live);
  const hovering = live !== null;
  const lingering = last !== null;
  useEffect(() => {
    if (hovering || !lingering) return;
    const timer = window.setTimeout(() => setLast(null), LAYOUT_PREVIEW_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [hovering, lingering]);
  const shown = live ?? last;
  if (!shown) return null;
  return (
    <InfographicLayoutPreview
      key={shown.page.id}
      page={shown.page}
      layout={shown.layout}
      leaving={!live}
      {...(rest.tabFont ? { tabFont: rest.tabFont } : {})}
      {...(rest.elements ? { elements: rest.elements } : {})}
      {...(rest.pages ? { pages: rest.pages } : {})}
    />
  );
}
