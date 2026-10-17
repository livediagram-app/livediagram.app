'use client';

// Measures the toast stack's floor (toast-floor.ts) while it shows a toast: on mount, whenever the
// number of toasts changes, when the window or a piece of bottom chrome resizes, and when an animation
// lands (a banner that flew up into place moves without resizing), and when bottom chrome says it came or
// went (TOAST_FLOOR_CHANGED_EVENT). Nothing runs while the stack is empty.
import { useLayoutEffect, useState } from 'react';
import {
  TOAST_EDGE_PX,
  TOAST_FLOOR_CHANGED_EVENT,
  TOAST_FLOOR_SELECTOR,
  toastFloor,
} from './toast-floor';

export function useToastFloor(active: boolean, count: number): number {
  const [floor, setFloor] = useState(TOAST_EDGE_PX);
  useLayoutEffect(() => {
    if (!active) return;
    let observed: Element[] = [];
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    function measure() {
      const found = Array.from(document.querySelectorAll(TOAST_FLOOR_SELECTOR));
      if (
        observer &&
        (found.length !== observed.length || found.some((el, i) => el !== observed[i]))
      ) {
        observer.disconnect();
        for (const el of found) observer.observe(el);
        observed = found;
      }
      const next = toastFloor({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        obstacles: found.map((el) => el.getBoundingClientRect()),
      });
      setFloor((prev) => (prev === next ? prev : next));
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
  }, [active, count]);
  return floor;
}
