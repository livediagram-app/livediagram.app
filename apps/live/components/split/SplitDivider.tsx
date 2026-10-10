'use client';

import { useRef, useState } from 'react';
import { SPLIT_KEY_STEP_LARGE_PX, SPLIT_KEY_STEP_PX, SPLIT_MIN_PANE_PX } from '@/lib/split-view';

// The seam between the two panes (docs/specs/007-editor/split-view.md "Resizing"): drag it to share
// the screen differently, double-click it to go back to halves. A focusable separator, so the
// arrow keys move it too (Shift for bigger steps, Home / End for the extremes).
export function SplitDivider({
  rightWidth,
  viewportWidth,
  onResize,
  onReset,
}: {
  rightWidth: number;
  viewportWidth: number;
  onResize: (width: number, commit?: boolean) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const grab = useRef<{ startX: number; startWidth: number; id: number } | null>(null);
  const frame = useRef(0);
  const max = Math.max(SPLIT_MIN_PANE_PX, viewportWidth - SPLIT_MIN_PANE_PX);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Side by Side"
      aria-valuemin={SPLIT_MIN_PANE_PX}
      aria-valuemax={max}
      aria-valuenow={rightWidth}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        grab.current = { startX: e.clientX, startWidth: rightWidth, id: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const g = grab.current;
        if (!g || g.id !== e.pointerId) return;
        const width = g.startWidth - (e.clientX - g.startX);
        // One layout per frame: the editor's canvas re-measures on every width it is given.
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => onResize(width));
      }}
      onPointerUp={(e) => {
        const g = grab.current;
        if (!g || g.id !== e.pointerId) return;
        cancelAnimationFrame(frame.current);
        onResize(g.startWidth - (e.clientX - g.startX), true);
        grab.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        grab.current = null;
        setDragging(false);
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? SPLIT_KEY_STEP_LARGE_PX : SPLIT_KEY_STEP_PX;
        const next =
          e.key === 'ArrowLeft'
            ? rightWidth + step
            : e.key === 'ArrowRight'
              ? rightWidth - step
              : e.key === 'Home'
                ? max
                : e.key === 'End'
                  ? SPLIT_MIN_PANE_PX
                  : null;
        if (next === null) return;
        e.preventDefault();
        onResize(next, true);
      }}
      className="group absolute inset-y-0 -left-2 z-10 flex w-4 cursor-col-resize touch-none justify-center outline-none"
    >
      {/* The visible seam: a hairline that thickens into a brand rule under the pointer, with a
          grip in the middle so it reads as something to hold. */}
      <span
        aria-hidden
        className={`h-full transition-all duration-150 ${
          dragging
            ? 'w-[3px] bg-brand-500'
            : 'w-px bg-slate-200 group-hover:w-[3px] group-hover:bg-brand-400 group-focus-visible:w-[3px] group-focus-visible:bg-brand-500 dark:bg-slate-700'
        }`}
      />
      <span
        aria-hidden
        className={`absolute top-1/2 flex h-10 w-2.5 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-colors duration-150 ${
          dragging
            ? 'border-brand-700 bg-brand-700 text-white dark:bg-brand-600'
            : 'border-slate-200 bg-white text-slate-400 group-hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
        }`}
      >
        <svg viewBox="0 0 2 14" className="h-3.5 w-0.5" fill="currentColor">
          <circle cx="1" cy="1" r="1" />
          <circle cx="1" cy="7" r="1" />
          <circle cx="1" cy="13" r="1" />
        </svg>
      </span>
    </div>
  );
}
