'use client';

// The page surface in the canvas (docs/specs/030-knowledgebase/blueprints/page-surface.md "The lock"): keeps the
// view locked to where the open page's column belongs, and hands the canvas the lock to draw its world at and the
// scroll container to put it in. The lock is worked out again only when what it reads changes: the surface's size,
// the side chrome's, the page's corner or its margin. Never on a scroll, never on a keystroke.
import { useCallback, useEffect, useLayoutEffect, useSyncExternalStore, type Ref } from 'react';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useViewportStore } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import {
  PAGE_FREE_HEIGHT_VAR,
  computePageLock,
  worldHeight,
  pageFreeHeight,
} from '@/lib/page-surface/page-lock';
import { pageScrollOf } from '@/lib/page-surface/page-keys';
import { pageViewportOf } from '@/lib/page-surface/page-viewport-store';
import { sideChromeInsets } from '@/lib/side-chrome-insets';

const SIDE_CHROME = '[data-contents-sidebar], [data-page-rail="docked"]';
const noSubscribe = () => () => {};

export type PageSurface = {
  /** The view the canvas world is drawn at: the lock, or the store's own view outside a page surface. */
  view: View;
  /** Ref of the element that scrolls the page. */
  scrollerRef: (el: HTMLElement | null) => void;
};

export function usePageSurface({
  mainRef,
  page,
  margin,
}: {
  mainRef: Ref<HTMLElement>;
  /** The open page's sheet in canvas px; absent while the tab has no page yet. */
  page: { x: number; y: number; width: number } | undefined;
  margin: number;
}): PageSurface {
  const store = useViewportStore();
  const pageStore = pageViewportOf(store);
  const phone = useIsMobileViewport();
  const view = useSyncExternalStore(
    pageStore?.subscribeLock ?? noSubscribe,
    pageStore?.lock ?? store.get,
    pageStore?.lock ?? store.get,
  );
  const x = page?.x;
  const y = page?.y;
  const pageWidth = page?.width;
  useLayoutEffect(() => {
    const main = mainRef && typeof mainRef === 'object' ? mainRef.current : null;
    if (!main || !pageStore || x === undefined || y === undefined || pageWidth === undefined)
      return;
    const relock = () => {
      // What the world is laid in: the scroll container's own box (it ends where a docked rail begins), less its
      // scrollbar. Chrome over its left (the page tree) is room the column keeps clear of.
      const scroller = pageStore.scroller();
      const box = scroller ?? main;
      const width = scroller ? scroller.clientWidth : main.offsetWidth;
      const height = scroller ? scroller.clientHeight : main.offsetHeight;
      if (width === 0 || height === 0) return;
      const sides = sideChromeInsets(main);
      const railRoom = main.offsetWidth - box.offsetWidth;
      const lock = computePageLock({
        width,
        // The world's own box (worldHeight), which its transform is about.
        height: worldHeight(height),
        sides: { left: sides.left, right: Math.max(0, sides.right - railRoom) },
        page: { x, y, width: pageWidth },
        margin,
        phone,
      });
      pageStore.lockTo(lock.view);
      // How tall the window lets a page be: the writing fills it, however short the stored page is.
      const free = `${pageFreeHeight(height, lock.view.zoom)}px`;
      if (scroller && scroller.style.getPropertyValue(PAGE_FREE_HEIGHT_VAR) !== free)
        scroller.style.setProperty(PAGE_FREE_HEIGHT_VAR, free);
    };
    relock();
    if (typeof ResizeObserver === 'undefined') return;
    // The surface's own size, and the side chrome's (the tree collapsing to its rail, the rail docking).
    const sizes = new ResizeObserver(relock);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(main);
      const scroller = pageStore.scroller();
      if (scroller) sizes.observe(scroller);
      main.querySelectorAll(SIDE_CHROME).forEach((el) => sizes.observe(el));
    };
    watch();
    // The side chrome arriving or leaving: it is drawn as the surface's own children.
    const chrome = new MutationObserver(() => {
      watch();
      relock();
    });
    chrome.observe(main, { childList: true });
    return () => {
      sizes.disconnect();
      chrome.disconnect();
    };
  }, [mainRef, pageStore, x, y, pageWidth, margin, phone]);
  // The page's own scroll keys, while the focus is on the page and not in its writing or a field.
  useEffect(() => {
    if (!pageStore) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const scroller = pageStore.scroller();
      const target = e.target;
      const main = mainRef && typeof mainRef === 'object' ? mainRef.current : null;
      if (!scroller || (target !== document.body && target !== main)) return;
      // An element is selected: the arrows nudge it and the other keys are the engine's.
      if (pageStore.followsScroll()) return;
      const scroll = pageScrollOf(e.key, e.shiftKey, scroller.clientHeight);
      if (!scroll) return;
      e.preventDefault();
      if ('to' in scroll) scroller.scrollTop = scroll.to === 'top' ? 0 : scroller.scrollHeight;
      else scroller.scrollTop += scroll.by;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mainRef, pageStore]);
  const scrollerRef = useCallback(
    (el: HTMLElement | null) => {
      pageStore?.attach(el);
    },
    [pageStore],
  );
  return { view, scrollerRef };
}
