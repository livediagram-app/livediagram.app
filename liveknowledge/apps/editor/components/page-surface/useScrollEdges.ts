'use client';

// Whether a row that scrolls sideways has more to show past each edge, and how to page it (docs/specs/030-knowledgebase/
// page-surface.md "The formatting bar": "Narrow"). The same idea as the tab strip's scroll buttons
// (@liveworkspace/workbench components/chrome/TabStrip.tsx). It reads the row's scroll box only when that can have
// changed: a scroll (once a frame), the row or its content resizing, its content being swapped. Never on a
// keystroke.
import { useCallback, useEffect, useRef, useState } from 'react';

export type ScrollEdges = { left: boolean; right: boolean };
const NONE: ScrollEdges = { left: false, right: false };
// A sub-pixel of scroll range is rounding, not content.
const SLACK_PX = 1;
/** How much of the row's width one press pages by. */
export const SCROLL_PAGE_SHARE = 0.7;

/** The edges with more past them, for a scroll box. Pure, for the hook and its test. */
export function scrollEdgesOf(box: {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}): ScrollEdges {
  const range = box.scrollWidth - box.clientWidth;
  if (range <= SLACK_PX) return NONE;
  return { left: box.scrollLeft > SLACK_PX, right: box.scrollLeft < range - SLACK_PX };
}

export function useScrollEdges(): {
  ref: (el: HTMLElement | null) => void;
  edges: ScrollEdges;
  page: (direction: 'left' | 'right') => void;
} {
  const row = useRef<HTMLElement | null>(null);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [edges, setEdges] = useState<ScrollEdges>(NONE);
  const ref = useCallback((next: HTMLElement | null) => {
    row.current = next;
    setEl(next);
  }, []);

  useEffect(() => {
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const next = scrollEdgesOf(el);
      // The same answer keeps the same state: nothing renders.
      setEdges((was) => (was.left === next.left && was.right === next.right ? was : next));
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    el.addEventListener('scroll', soon, { passive: true });
    // The row's own width, and the width of what it holds (controls arriving and leaving with the selection).
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    const watch = () => {
      sizes?.disconnect();
      sizes?.observe(el);
      for (const child of el.children) sizes?.observe(child);
      soon();
    };
    const swaps = new MutationObserver(watch);
    swaps.observe(el, { childList: true });
    watch();
    return () => {
      el.removeEventListener('scroll', soon);
      sizes?.disconnect();
      swaps.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [el]);

  const page = useCallback((direction: 'left' | 'right') => {
    const box = row.current;
    if (!box) return;
    const by = Math.max(1, Math.round(box.clientWidth * SCROLL_PAGE_SHARE));
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    box.scrollBy({ left: direction === 'left' ? -by : by, behavior: still ? 'auto' : 'smooth' });
  }, []);

  return { ref, edges, page };
}
