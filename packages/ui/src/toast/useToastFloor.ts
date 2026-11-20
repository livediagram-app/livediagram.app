'use client';

// Measures the toast stack's floor (toast-floor.ts) while it shows a toast: on mount, whenever the
// number of toasts changes, when the window or a piece of bottom chrome resizes, and when an animation
// lands (a banner that flew up into place moves without resizing), and when bottom chrome says it came or
// went (TOAST_FLOOR_CHANGED_EVENT). Nothing runs while the stack is empty.
import { useLayoutEffect, useRef, useState } from 'react';
import {
  TOAST_EDGE_PX,
  TOAST_FLOOR_CHANGED_EVENT,
  TOAST_FLOOR_SELECTOR,
  TOAST_PHONE_FLOOR_SELECTOR,
  TOAST_RISEN_SELECTOR,
  TOAST_SIDE_SELECTOR,
  toastFloor,
  toastPlacement,
  type FloorRect,
  type ToastPlacement,
} from './toast-floor';

const UNPLACED: ToastPlacement = { bottom: TOAST_EDGE_PX, right: null };

/** The toast stack's placement (toastPlacement): its floors, and beside the bottom-right cluster from 640px. */
export function useToastFloor(active: boolean, count: number): ToastPlacement {
  const [placement, setPlacement] = useState(UNPLACED);
  useMeasure(active, count, TOAST_FLOOR_SELECTOR, (found) => {
    const floors: FloorRect[] = [];
    const sides: FloorRect[] = [];
    for (const el of found) {
      // A fresh rect per call, so marking it is safe. Kept terse: this hook is in the Explorer's first load.
      const r: FloorRect = el.getBoundingClientRect();
      r.rises = el.matches(TOAST_RISEN_SELECTOR);
      r.phoneOnly = el.matches(TOAST_PHONE_FLOOR_SELECTOR);
      (el.matches(TOAST_SIDE_SELECTOR) ? sides : floors).push(r);
    }
    const next = toastPlacement({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      floors,
      sides,
    });
    setPlacement((prev) =>
      prev.bottom === next.bottom && prev.right === next.right ? prev : next,
    );
  });
  return placement;
}

/**
 * Where a centred column a toast wide stands over the bottom chrome `selector` names (toast-floor.ts), for a bottom
 * notice other than the stack (a template start's sheet over the tab bar). `key` re-measures when the column's own
 * content changes.
 */
export function useChromeFloor(active: boolean, key: number, selector: string): number {
  const [floor, setFloor] = useState(TOAST_EDGE_PX);
  useMeasure(active, key, selector, (found) => {
    const next = toastFloor({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      obstacles: found.map((el) => el.getBoundingClientRect()),
    });
    setFloor((prev) => (prev === next ? prev : next));
  });
  return floor;
}

// Runs `measure` with the chrome `selector` finds while `active`: at once, on resize (the window's or the chrome's),
// when an animation lands and when chrome says it came or went.
function useMeasure(
  active: boolean,
  key: number,
  selector: string,
  onMeasure: (found: Element[]) => void,
): void {
  const latest = useRef(onMeasure);
  useLayoutEffect(() => {
    latest.current = onMeasure;
  });
  useLayoutEffect(() => {
    if (!active) return;
    let observed: Element[] = [];
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    function measure() {
      const found = Array.from(document.querySelectorAll(selector));
      if (
        observer &&
        (found.length !== observed.length || found.some((el, i) => el !== observed[i]))
      ) {
        observer.disconnect();
        for (const el of found) observer.observe(el);
        observed = found;
      }
      latest.current(found);
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener(TOAST_FLOOR_CHANGED_EVENT, measure);
    document.addEventListener('animationend', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener(TOAST_FLOOR_CHANGED_EVENT, measure);
      document.removeEventListener('animationend', measure, true);
    };
  }, [active, key, selector]);
}
