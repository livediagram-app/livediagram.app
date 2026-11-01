'use client';

// Every page's picture for the Contents popover (docs/specs/007-editor/pages-mode.md
// "Contents"): each page drawn by the headless renderer the exports use (lib/page-thumb.ts). Only while the list is on screen (the caller mounts this then); redrawn when the tab's
// elements or pages change, with the tab's arrow labels laid out once rather than once a page.
// The docked sidebar stays on screen while the person works, so it passes `settleMs`: the pictures
// redraw once the tab has rested that long, never on every frame of a drag or every key typed.
// Each page draws from its own elements only (lib/page-element-buckets.ts), and a page whose own
// elements and page are unchanged keeps its picture: an edit redraws the page it touched, not the tab.
import { useEffect, useMemo, useRef, useState } from 'react';
import { pagesOf, layOutPages, type Element, type LaidOutPage, type Tab } from '@livedesign/design';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import { pageElementBuckets } from '@/lib/page-element-buckets';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useImageSources } from '@/components/canvas/page-image-access';
import { thumbImageHref, thumbImageIds } from '@/lib/thumb-images';
import { pageThumbFor, tabArrowLabels, type PageThumb } from '@/lib/page-thumb';

export type PageThumbTab = Pick<
  Tab,
  'id' | 'name' | 'elements' | 'pages' | 'layers' | 'font' | 'finish'
>;

// One page's picture and what it was drawn from.
// `hrefs`: its pictures' URLs as drawn, so a picture arriving redraws only the pages that show it.
type Drawn = {
  page: LaidOutPage;
  elements: readonly Element[];
  hrefs: readonly (string | undefined)[];
  thumb: PageThumb | null;
};
// What every picture shares: a change to any redraws them all.
type Shared = readonly unknown[];

export function usePageThumbnails(
  tab: PageThumbTab,
  pageIds: readonly string[],
  settleMs = 0,
  // Each photo page's picture by page id (usePhotoThumbHrefs): a photo page is its picture.
  photoHrefs: ReadonlyMap<string, string> = NO_PHOTOS,
): Map<string, PageThumb> {
  const iconsLoaded = useIconCatalogs();
  // The canvas's surface: a page with no fill is pictured on the paper as the canvas shows it.
  const surface = useCanvasSurface();
  const key = pageIds.join(',');
  // What a picture shows, as one value, so a rest can hold the last one drawn.
  const live = useMemo(
    () => ({ tab, pageIds }),
    // On the inputs a picture shows, not on the tab object's identity.
    // oxlint-disable-next-line react/exhaustive-deps
    [tab.elements, tab.pages, tab.layers, tab.font, tab.finish, key],
  );
  const drawn = useSettled(live, settleMs);
  const cache = useRef<{ shared: Shared; pages: Map<string, Drawn> }>({
    shared: [],
    pages: new Map(),
  });
  // The drawn rows' pages and their own elements, and the pictures on them for the image store.
  const laidOut = useMemo(() => {
    const full = drawn.tab as Tab;
    const laid = layOutPages(pagesOf(full));
    const buckets = pageElementBuckets(full.elements, laid);
    const byId = new Map(laid.map((p) => [p.id, p]));
    const imageIds = drawn.pageIds.flatMap((pageId) =>
      thumbImageIds(buckets.get(pageId) ?? [], byId.get(pageId)),
    );
    return { byId, buckets, imageIds };
  }, [drawn]);
  // Each picture fetched once while a drawn row shows it, shared with the canvas's copy.
  const imageSource = useImageSources(laidOut.imageIds);
  return useMemo(() => {
    const full = drawn.tab as Tab;
    const { byId, buckets } = laidOut;
    const resolveImageHref = thumbImageHref(imageSource);
    const shared: Shared = [full.id, full.layers, full.font, full.finish, iconsLoaded, surface];
    const kept = sameList(shared, cache.current.shared)
      ? cache.current.pages
      : new Map<string, Drawn>();
    let labels: ReturnType<typeof tabArrowLabels> | undefined;
    const next = new Map<string, Drawn>();
    const out = new Map<string, PageThumb>();
    for (const pageId of drawn.pageIds) {
      const page = byId.get(pageId);
      if (!page) continue;
      const elements = buckets.get(pageId) ?? [];
      const was = kept.get(pageId);
      let entry = was;
      const hrefs = [
        ...thumbImageIds(elements, page).map(resolveImageHref),
        // A photo page's picture arriving (or changing) redraws that page.
        photoHrefs.get(pageId),
      ];
      if (
        !was ||
        !samePage(was.page, page) ||
        !sameList(was.elements, elements) ||
        !sameList(was.hrefs, hrefs)
      ) {
        // Arrow labels laid out once for the tab, and only when a page with an arrow redraws.
        if (!labels && full.elements.some((e) => e.type === 'arrow')) labels = tabArrowLabels(full);
        const thumb = pageThumbFor(
          pageId,
          { ...full, elements },
          {
            iconsLoaded,
            surface,
            resolveImageHref,
            photoHref: (id) => photoHrefs.get(id),
            ...(labels ? { labels } : {}),
          },
        );
        entry = { page, elements, hrefs, thumb };
      }
      next.set(pageId, entry!);
      if (entry!.thumb) out.set(pageId, entry!.thumb);
    }
    cache.current = { shared, pages: next };
    return out;
  }, [drawn, laidOut, imageSource, iconsLoaded, surface, photoHrefs]);
}

const NO_PHOTOS: ReadonlyMap<string, string> = new Map();

function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

// The same page, where it was: its own fields (the stored page's), and its place on the canvas.
function samePage(a: LaidOutPage, b: LaidOutPage): boolean {
  const { rect: ra, ...fa } = a;
  const { rect: rb, ...fb } = b;
  if (ra.x !== rb.x || ra.y !== rb.y || ra.width !== rb.width || ra.height !== rb.height)
    return false;
  const ka = Object.keys(fa) as (keyof typeof fa)[];
  return ka.length === Object.keys(fb).length && ka.every((k) => Object.is(fa[k], fb[k]));
}

// `value`, or with `ms` the value it last held for `ms` without changing (the first at once).
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (ms <= 0 || Object.is(value, settled)) return;
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, settled, ms]);
  return ms > 0 ? settled : value;
}
