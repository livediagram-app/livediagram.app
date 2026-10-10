'use client';

import { useEffect, useLayoutEffect, type RefObject } from 'react';

// How tall a growing field may get: a fixed height in px (the comment composer), or a number of its own lines (the
// card panel's title: three), measured from its computed line height and padding.
export type AutoHeightMax = { px: number } | { lines: number };

// The tallest a field may be, border-box, for `max`; Infinity when its line height cannot be read.
function maxHeightOf(field: HTMLElement, max: AutoHeightMax, borders: number): number {
  if ('px' in max) return max.px;
  const style = getComputedStyle(field);
  const line = parseFloat(style.lineHeight);
  if (!Number.isFinite(line)) return Infinity;
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return max.lines * line + (Number.isFinite(padding) ? padding : 0) + borders;
}

// Sizes a textarea to its text: one line when short, growing as it wraps up to `max`, then scrolling. The height is
// border-box, so the borders are added to the content's scrollHeight (without them the field is 2px short of its text
// and shows a scrollbar on one line). It only scrolls, and so only shows a scrollbar, once it is at its tallest. It
// fits again when the text changes and when its width does (a narrower panel wraps it onto more lines).
export function useAutoHeight(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  max: AutoHeightMax,
): void {
  const maxKey = 'px' in max ? `px:${max.px}` : `lines:${max.lines}`;
  useLayoutEffect(() => {
    const field = ref.current;
    if (field) fitHeight(field, max);
    // `max` is read through its key: a new object with the same limit must not refit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, value, maxKey]);
  useEffect(() => {
    const field = ref.current;
    if (!field || typeof ResizeObserver === 'undefined') return;
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return;
      width = field.clientWidth;
      fitHeight(field, max);
    });
    observer.observe(field);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, maxKey]);
}

export function fitHeight(field: HTMLTextAreaElement, max: AutoHeightMax): void {
  field.style.height = 'auto';
  const borders = field.offsetHeight - field.clientHeight;
  const needed = field.scrollHeight + borders;
  const cap = maxHeightOf(field, max, borders);
  field.style.height = `${Math.min(needed, cap)}px`;
  field.style.overflowY = needed > cap ? 'auto' : 'hidden';
}
