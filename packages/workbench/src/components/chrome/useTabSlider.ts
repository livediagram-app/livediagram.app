'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { MOTION_MS } from '@liveworkspace/style-guards/motion';

// The open tab's card, one for the whole strip, that slides from the tab you left to the tab you opened
// (docs/specs/007-editor/editor-app.md "How a tab looks"). It lives in the tablist, under every tab, so it scrolls
// with them for free; only its transform and width are ever written, straight to the element, never through React.
//
// When it moves:
// - The open tab changes: it slides there over MOTION_MS.long on a gentle spring (at once under reduced motion). A
//   folder easing shut or open in the same commit moves the new tab while the card travels, so the card aims at
//   where the tab will stand once those widths settle (each easing box already carries its end width inline).
// - The strip's layout changes under it (a folder opening before it, a rename, presence avatars arriving, the tabs
//   reordered): it follows at once, measured by a ResizeObserver, so it never lags its tab.
// - On mount it appears in place: no slide in from the left edge.
// Until it has measured (or when no tab in the strip is open), each tab's own card shows instead (tab-shape.ts).

export const TAB_SLIDE_MS = MOTION_MS.long;
// A light spring: a touch of overshoot, then settled.
export const TAB_SLIDE_EASE = 'cubic-bezier(0.3, 1.15, 0.45, 1)';
// The card's foot runs past the strip's bottom edge, which clips it, so no ring line runs along the bottom.
export const TAB_SLIDER_FOOT_PX = 8;

export type SliderBox = { x: number; y: number; w: number; h: number };

// Where the card stands for `tab`, in the tablist's own coordinates (scroll cancels out: both move together). With
// `settled`, widths still easing (CollapseWidth) before the tab count at their end width.
export function measureSlot(list: HTMLElement, tab: HTMLElement, settled: boolean): SliderBox {
  const l = list.getBoundingClientRect();
  const t = tab.getBoundingClientRect();
  let x = t.left - l.left;
  if (settled) {
    for (const box of list.querySelectorAll<HTMLElement>('[data-collapse-width]')) {
      if (box.contains(tab)) continue;
      if (!(box.compareDocumentPosition(tab) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const end = parseFloat(box.style.width);
      if (Number.isNaN(end)) continue;
      x += end - box.getBoundingClientRect().width;
    }
  }
  return { x, y: t.top - l.top, w: t.width, h: t.height + TAB_SLIDER_FOOT_PX };
}

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

const OPEN_TAB = '[data-tab][data-active]';

export function useTabSlider(
  listRef: RefObject<HTMLElement | null>,
  sliderRef: RefObject<HTMLElement | null>,
  activeId: string,
  // Changes whenever the order of what the strip shows changes (a reorder keeps every size, so no observer hears it).
  layoutKey: string,
): void {
  // Until when a slide is under way: layout changes inside it are the slide's own folder easing, already aimed for.
  const slidingUntil = useRef(0);
  const settleTimer = useRef<number | null>(null);
  const shownFor = useRef<string | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const observed = useRef<HTMLElement | null>(null);

  // Writes the card's place; `slide` eases it there, otherwise it jumps.
  const place = useRef((slide: boolean): void => {
    const list = listRef.current;
    const slider = sliderRef.current;
    if (!list || !slider) return;
    const tab = list.querySelector<HTMLElement>(OPEN_TAB);
    if (!tab) {
      // Nothing open in the strip (a tab outside a tab-scoped share): no card, and each tab keeps its own.
      delete list.dataset.tabSlide;
      slider.style.opacity = '0';
      shownFor.current = null;
      return;
    }
    if (observed.current !== tab) {
      if (observed.current) observer.current?.unobserve(observed.current);
      observer.current?.observe(tab);
      observed.current = tab;
    }
    // A card not yet showing appears where it belongs, never sliding in from wherever it last stood.
    const glide = slide && slider.style.opacity === '1';
    const box = measureSlot(list, tab, glide);
    slider.style.transition = glide
      ? `transform ${TAB_SLIDE_MS}ms ${TAB_SLIDE_EASE}, width ${TAB_SLIDE_MS}ms ${TAB_SLIDE_EASE}, height ${TAB_SLIDE_MS}ms ${TAB_SLIDE_EASE}`
      : 'none';
    slider.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
    slider.style.width = `${box.w}px`;
    slider.style.height = `${box.h}px`;
    slider.style.opacity = '1';
    list.dataset.tabSlide = '';
  });

  // One observer for the strip's life: the tablist (every width change in the strip) and the open tab.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (performance.now() < slidingUntil.current) return;
      place.current(false);
    });
    ro.observe(list);
    observer.current = ro;
    return () => {
      ro.disconnect();
      observer.current = null;
      observed.current = null;
      if (settleTimer.current != null) window.clearTimeout(settleTimer.current);
    };
  }, [listRef]);

  // The open tab changed (slide) or the strip's order did (jump).
  useLayoutEffect(() => {
    const changed = shownFor.current !== null && shownFor.current !== activeId;
    const slide = changed && !reducedMotion();
    shownFor.current = activeId;
    place.current(slide);
    if (!slide) return;
    slidingUntil.current = performance.now() + TAB_SLIDE_MS;
    if (settleTimer.current != null) window.clearTimeout(settleTimer.current);
    // Once it lands, one exact measure catches anything that moved while it travelled.
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      slidingUntil.current = 0;
      place.current(false);
    }, TAB_SLIDE_MS + 20);
  }, [activeId, layoutKey]);
}
