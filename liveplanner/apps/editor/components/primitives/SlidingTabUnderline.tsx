'use client';

// A tab bar's underline as ONE shared bar that slides (and resizes) to the selected tab, rather than each tab
// drawing its own: the underline tabs' counterpart of SegmentSlider, for tabs of differing widths. The host
// tablist is `relative`; the bar measures the tab marked `aria-selected="true"` inside it on every change of
// `selected` and whenever the list resizes, writing its place straight onto itself (no re-render), and stays
// hidden until it has measured.
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useObservedSize } from '@/hooks/canvas/useObservedSize';

export function SlidingTabUnderline({
  list,
  selected,
  className = 'bg-brand-500',
}: {
  list: RefObject<HTMLElement | null>;
  // The selected tab's key: a change re-measures.
  selected: string;
  className?: string;
}) {
  const size = useObservedSize(list);
  const bar = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const tab = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const el = bar.current;
    if (!tab || !el) return;
    el.style.width = `${tab.offsetWidth}px`;
    el.style.transform = `translateX(${tab.offsetLeft}px)`;
    el.style.opacity = '1';
  }, [list, selected, size]);
  return (
    <span
      ref={bar}
      aria-hidden
      data-tab-underline=""
      className={`pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full opacity-0 transition-[transform,width] duration-short ease-out motion-reduce:transition-none ${className}`}
    />
  );
}
