'use client';

// Where the page toolbar sits (docs/specs/007-editor/article-pages.md "The page toolbar"): at the
// top of its page, inside it, centred in the top margin, shrinking to a thin margin and narrowing to
// the page's width on screen; on a phone, a bar along the bottom of the screen. Written straight to
// the card's style (a pan or a zoom moves the page with no render), and only when something may
// have moved it, never on idle frames (docs/specs/008-canvas/canvas-performance.md "At rest").
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { canvasGestureNow, subscribeCanvasGesture } from '@/lib/canvas-gesture';

// Screen px: the card's breathing room above and below it when it sits in the page's margin.
const MARGIN_PAD = 4;
// Frames the toolbar keeps placing itself after the last cause to (an easing view settling).
const PLACE_TRAILING_FRAMES = 3;
// Screen px: a phone's bar keeps this clear of the screen's sides and the bottom.
const PHONE_GUTTER = 8;
// Screen px: the room the canvas's bottom controls (undo, Fit) take on a phone.
const PHONE_CONTROLS_ROOM = 64;
// The smallest the card shrinks to in a thin margin (zoomed far out), as a share of its size.
const TOOLBAR_MIN_SCALE = 0.55;

/** Places the card the returned ref is on over page `pageId`; nothing while there is no page. */
export function usePageToolbarPlacement({
  pageId,
  phone,
  topRoomOf,
}: {
  pageId: string | null;
  // A phone's bar sits along the bottom.
  phone: boolean;
  // The screen px of a page's top margin at the current zoom: the room the card sits in.
  topRoomOf: (pageId: string) => number;
}): RefObject<HTMLDivElement | null> {
  const bar = useRef<HTMLDivElement>(null);
  // Read when placing: the margin changes with the zoom and the article's style, with no new effect.
  const latest = useRef({ phone, topRoomOf });
  useLayoutEffect(() => {
    latest.current = { phone, topRoomOf };
  });

  // Placed after each render, while a pan or zoom gesture is under way, on the wheel and on a
  // resize of the window or of a phone's visible viewport (the keyboard); then a couple of frames
  // more for anything easing to rest.
  const place = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    if (!pageId) return;
    let raf = 0;
    let trailing = 0;
    const tick = () => {
      raf = 0;
      follow();
      const gesture = canvasGestureNow();
      if (gesture === 'pan' || gesture === 'zoom' || trailing > 0) {
        if (gesture !== 'pan' && gesture !== 'zoom') trailing -= 1;
        raf = requestAnimationFrame(tick);
      }
    };
    const schedule = () => {
      trailing = PLACE_TRAILING_FRAMES;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    place.current = schedule;
    const vv = window.visualViewport;
    window.addEventListener('resize', schedule);
    window.addEventListener('wheel', schedule, { passive: true });
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    const unsubscribe = subscribeCanvasGesture(schedule);
    const follow = () => {
      const el = bar.current;
      const sheet = document.querySelector(`[data-illustrate-page-id="${CSS.escape(pageId)}"]`);
      const canvas = document.querySelector('[data-canvas-a11y-root]');
      if (!el || !sheet || !canvas) return;
      const r = sheet.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      const strip = document
        .querySelector('[data-toolbar-palette]:not(.hidden)')
        ?.getBoundingClientRect();
      const floor =
        c.top +
        8 +
        (strip && strip.bottom > c.top && strip.top < c.top + 80 ? strip.bottom - c.top : 0);
      const h = el.offsetHeight;
      const w = el.offsetWidth;
      // On a phone: a bar along the bottom of the screen, above the keyboard when it is up,
      // across the screen (its controls scroll), for the writing being worked on.
      if (latest.current.phone) {
        const vv = window.visualViewport;
        const keyboard = vv ? vv.offsetTop + vv.height : window.innerHeight;
        // Keyboard up: right above it. Down: above the canvas's own controls along the bottom.
        const bottom = keyboard < c.bottom - 1 ? keyboard : c.bottom - PHONE_CONTROLS_ROOM;
        const across = window.innerWidth - 2 * PHONE_GUTTER;
        if (el.style.maxWidth !== `${across}px`) el.style.maxWidth = `${across}px`;
        const left = Math.max(PHONE_GUTTER, (window.innerWidth - w) / 2);
        el.style.transformOrigin = '0 0';
        el.style.transform = `translate(${Math.round(left)}px, ${Math.round(bottom - h - PHONE_GUTTER)}px)`;
        el.style.visibility = 'visible';
        return;
      }
      // Always at the page's top, inside it, centred in the top margin; zoomed out until the margin
      // is thinner than the card, the card shrinks to fit it (to TOOLBAR_MIN_SCALE), so it never
      // covers the first line. Off with the page's top.
      const roomTop = latest.current.topRoomOf(pageId);
      const scale = Math.min(1, Math.max(TOOLBAR_MIN_SCALE, (roomTop - 2 * MARGIN_PAD) / h));
      const top = r.top + Math.max(MARGIN_PAD * scale, (roomTop - h * scale) / 2);
      const visible = top >= floor && top + h * scale <= c.bottom && r.bottom > top + h * scale;
      // Inside the page across, and inside the canvas: a page narrower on screen than the card
      // narrows it (its controls scroll).
      const lo = Math.max(c.left, r.left) + 8;
      const hi = Math.min(c.right, r.right) - 8;
      const room = Math.max(0, (hi - lo) / scale);
      if (el.style.maxWidth !== `${room}px`) el.style.maxWidth = `${room}px`;
      const sw = w * scale;
      const left = Math.max(lo, Math.min(r.left + r.width / 2 - sw / 2, hi - sw));
      el.style.transformOrigin = '0 0';
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)${
        scale < 1 ? ` scale(${scale.toFixed(3)})` : ''
      }`;
      el.style.visibility = visible ? 'visible' : 'hidden';
    };
    follow();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      place.current = () => {};
      window.removeEventListener('resize', schedule);
      window.removeEventListener('wheel', schedule);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      unsubscribe();
    };
  }, [pageId]);
  // Every render (zoom, offset, writing, selection) may have moved the page.
  useLayoutEffect(() => place.current());

  return bar;
}
