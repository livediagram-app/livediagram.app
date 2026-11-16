'use client';

// One screen of Prototype mode (docs/specs/007-editor/wireframe-pages.md "Prototype mode"): the page drawn as an
// export draws it (its device frame, the content cut to the screen, the system bars over it), fitted to the space it
// is given, with its hotspots over it. On a phone the frame steps aside and the screen alone is shown. The markup is
// our own renderer's (user text is xmlEscaped inside it), but it draws a person's design (its words, colours and
// pictures), so it goes in through sanitizedHtml like every other sink of a design's drawing.
import { sanitizedHtml } from '@liveworkspace/trusted-types/sanitize';
import { useMemo } from 'react';
import {
  elementIdsOnPage,
  pageScreenRect,
  screenName,
  type LaidOutPage,
  type Tab,
} from '@livedesign/design';
import { htmlProps } from '@livedesign/ui';
import { useImageSources } from '@/components/canvas/page-image-access';
import { renderTabToSvg } from '@/lib/export-tab';
import { thumbImageHref, thumbImageIds } from '@/lib/thumb-images';
import type { Hotspot } from '@/lib/prototype-player';

// The prefix of the screen's gradient, pattern and clip ids, so none meets the canvas's own.
const ID_PREFIX = 'lvd-proto';

/** The markup inside an SVG document's root element (the renderer's own `<svg …>` and `</svg>` taken off). */
export function svgInner(svg: string): string {
  const start = svg.indexOf('>', svg.indexOf('<svg'));
  const end = svg.lastIndexOf('</svg>');
  return start < 0 || end < start ? '' : svg.slice(start + 1, end);
}

export function PrototypeScreen({
  tab,
  page,
  pages,
  index,
  hotspots,
  lit,
  screenOnly,
  onFollow,
}: {
  tab: Tab;
  page: LaidOutPage;
  pages: readonly LaidOutPage[];
  // The screen's place among the tab's, for its name.
  index: number;
  // Null for a screen leaving: it draws, and takes no presses.
  hotspots: readonly Hotspot[] | null;
  lit: boolean;
  // A phone: the screen alone, its frame stepped aside.
  screenOnly: boolean;
  onFollow: (hotspot: Hotspot) => void;
}) {
  // The pictures on the screen, fetched once and shared with the canvas's copy.
  const imageIds = useMemo(() => {
    const on = elementIdsOnPage(tab.elements, pages, page.id);
    return thumbImageIds(
      tab.elements.filter((el) => on.has(el.id)),
      page,
    );
  }, [tab.elements, pages, page]);
  const source = useImageSources(imageIds);
  const markup = useMemo(
    () =>
      svgInner(
        renderTabToSvg(tab, {
          page,
          imageHref: thumbImageHref(source),
          idPrefix: ID_PREFIX,
          fontsFromPage: true,
        }),
      ),
    [tab, page, source],
  );
  const box = screenOnly ? pageScreenRect(page) : page.rect;
  return (
    <svg
      role="group"
      aria-label={screenName(page, index)}
      data-prototype-screen={page.id}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
    >
      <g aria-hidden {...htmlProps(sanitizedHtml(markup, 'svg-content'))} />
      {hotspots?.map((h) => (
        <rect
          key={h.elementId}
          data-hotspot-id={h.elementId}
          role="button"
          tabIndex={0}
          aria-label={h.label}
          x={h.rect.x}
          y={h.rect.y}
          width={h.rect.width}
          height={h.rect.height}
          rx={4}
          pointerEvents="all"
          className={`cursor-pointer outline-none transition-[fill,stroke] duration-150 [fill-opacity:0.22] [stroke-width:2] [vector-effect:non-scaling-stroke] focus-visible:fill-brand-500 focus-visible:stroke-brand-600 dark:focus-visible:stroke-brand-400 ${
            lit
              ? 'fill-brand-500 stroke-brand-600 dark:stroke-brand-400'
              : 'fill-transparent stroke-transparent'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onFollow(h);
          }}
        />
      ))}
    </svg>
  );
}
