'use client';

// A row of category chips, each with its count, one pressed at a time (All first, by the caller's list): the layout
// gallery's categories and a logo page's display library. The row scrolls sideways rather than wrapping, unless
// `wrap` is set for a narrow home (a menu flyout). A sideways row takes a mouse wheel's up and down as left and right
// (it has nothing to scroll the other way), and the edge with chips past it fades out (the editors' `scroll-edge-fade`),
// so a chip past the edge is neither out of a mouse's reach nor out of sight.

import { useEffect, useRef } from 'react';

export type CategoryChip = { id: string; label: string; count: number };

export function CategoryChips({
  chips,
  value,
  onChoose,
  ariaLabel,
  wrap = false,
}: {
  chips: readonly CategoryChip[];
  value: string;
  onChoose: (id: string) => void;
  ariaLabel: string;
  wrap?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (wrap || !el) return;
    // Not passive: a wheel the row takes must not also scroll what is behind it. At either end the wheel passes on.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const room = el.scrollWidth - el.clientWidth;
      if (room <= 0) return;
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const to = Math.min(room, Math.max(0, el.scrollLeft + step));
      if (to === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = to;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wrap]);
  return (
    <div
      ref={row}
      role="group"
      aria-label={ariaLabel}
      className={
        wrap
          ? 'flex shrink-0 flex-wrap gap-1.5'
          : 'scroll-edge-fade -mx-1 flex shrink-0 gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }
    >
      {chips.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChoose(c.id)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
              on
                ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="text-optical-line">{c.label}</span>
            <span
              className={`text-optical-line tabular-nums text-[10px] ${on ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
