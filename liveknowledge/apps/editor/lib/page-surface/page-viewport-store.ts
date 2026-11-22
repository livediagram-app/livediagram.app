// The viewport store of a knowledgebase page (docs/specs/030-knowledgebase/blueprints/page-surface.md "The
// store"). It has the shared store's shape, so everything of the canvas engine that reads or moves the view keeps
// working, but the view is locked: the zoom and the sideways offset are the lock's and nobody else's, and a move
// down or up the page is the scroll container's own scroll. Reads answer the view as it stands on screen (the lock
// less what is scrolled), so a handler that converts a point or reveals a caret is right wherever the page is
// scrolled to. A scroll tells no reader unless something drawn in screen space is following an element.
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import type { Point, View, ViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { sameView } from './page-lock';

export type PageViewportStore = ViewportStore & {
  /** The fixed view (the lock), and a subscription that fires only when it changes: never on a scroll. */
  lock: () => View;
  subscribeLock: (listener: () => void) => () => void;
  /** Sets the lock; the same lock again tells nobody. */
  lockTo: (view: View) => void;
  /** The element that scrolls the page; answers the detach. */
  attach: (scroller: HTMLElement | null) => () => void;
  scroller: () => HTMLElement | null;
  /** Whether an element of the page is selected now: its keys are the engine's, and a scroll tells the readers. */
  followsScroll: () => boolean;
};

export function createPageViewportStore(options: {
  /** Whether screen-space chrome is following something on the page now (an element is selected): only then
   *  does a scroll tell the view's readers, a frame at a time. */
  followsScroll: () => boolean;
}): PageViewportStore {
  let lock: View = { zoom: 1, offset: { x: 0, y: 0 } };
  let scroller: HTMLElement | null = null;
  let scrollTop = 0;
  let shown: View = lock;
  const listeners = createListeners();
  const lockListeners = createListeners();
  let frame = 0;

  const refresh = () => {
    const y = lock.offset.y - scrollTop / lock.zoom;
    if (shown.zoom !== lock.zoom || shown.offset.x !== lock.offset.x || shown.offset.y !== y)
      shown = { zoom: lock.zoom, offset: { x: lock.offset.x, y } };
  };
  const onScroll = () => {
    if (!scroller) return;
    scrollTop = scroller.scrollTop;
    refresh();
    if (!options.followsScroll() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      listeners.notify();
    });
  };
  // A move of the view asked for by the engine (a caret revealed, a match found, a page framed): its vertical part
  // is where the page is scrolled to. The browser holds the scroll inside what there is to scroll.
  const moveTo = (offset: Point) => {
    if (!scroller) return;
    const top = Math.max(0, (lock.offset.y - offset.y) * lock.zoom);
    if (Math.abs(top - scroller.scrollTop) < 0.5) return;
    scroller.scrollTop = top;
    scrollTop = scroller.scrollTop;
    refresh();
  };

  return {
    get: () => shown,
    subscribe: listeners.subscribe,
    // The zoom is the lock's: the browser's own zoom is the page's zoom.
    setZoom() {},
    setOffset(next) {
      moveTo(typeof next === 'function' ? next(shown.offset) : next);
    },
    setView(next) {
      moveTo(next.offset);
    },
    lock: () => lock,
    subscribeLock: lockListeners.subscribe,
    lockTo(view) {
      if (sameView(view, lock)) return;
      lock = view;
      refresh();
      lockListeners.notify();
      listeners.notify();
    },
    attach(el) {
      scroller?.removeEventListener('scroll', onScroll);
      scroller = el;
      scrollTop = el?.scrollTop ?? 0;
      refresh();
      el?.addEventListener('scroll', onScroll, { passive: true });
      return () => {
        if (scroller !== el) return;
        el?.removeEventListener('scroll', onScroll);
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        scroller = null;
        scrollTop = 0;
        refresh();
      };
    },
    scroller: () => scroller,
    followsScroll: options.followsScroll,
  };
}

/** The page store behind a viewport store, or null when the store is the shared, unlocked one (a test's). */
export function pageViewportOf(store: ViewportStore): PageViewportStore | null {
  return 'lockTo' in store ? (store as PageViewportStore) : null;
}
