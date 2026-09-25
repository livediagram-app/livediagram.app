'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// The tray an open chart stack deals its members into (spec/22).
//
// It spans the full row UNDER the head card rather than wrapping it: a box
// that included the head would have to start a fresh row, pulling the head
// out of its cell (a stack in the second column jumped to the next line).
// The group's grid packs densely, so the cards after the head still fill the
// head's row and the tray lands directly beneath it.
//
// What ties the two together is a caret on the tray's top edge pointing up at
// the head, plus the head's ring in the tray's colour. The head is the tray's
// previous DOM sibling (MetricGroups renders them as a pair), so the caret is
// measured from it, re-measured whenever the grid resizes (columns reflow).

// The tray's tint + border, shared with the caret so the caret reads as part
// of the tray's edge. Opaque, because the caret overlaps the tray's border.
const TRAY_COLORS = 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-[#0b1a2a]';

export function StackTray({ grid, children }: { grid: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [caretX, setCaretX] = useState<number | null>(null);

  useLayoutEffect(() => {
    const tray = ref.current;
    const head = tray?.previousElementSibling;
    const container = tray?.parentElement;
    if (!tray || !head || !container) return;
    const measure = () => {
      const h = head.getBoundingClientRect();
      const t = tray.getBoundingClientRect();
      setCaretX(h.left + h.width / 2 - t.left);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    // `-mx-3` cancels the horizontal padding so the cards inside keep the
    // columns of the cards around the tray and it reads as drawn around them.
    <div
      ref={ref}
      className={`stack-box relative col-span-full -mx-3 rounded-3xl border p-3 ${TRAY_COLORS}`}
    >
      {caretX != null ? (
        <span
          aria-hidden
          className={`absolute -top-[7px] h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t ${TRAY_COLORS}`}
          style={{ left: caretX }}
        />
      ) : null}
      <div className={grid}>{children}</div>
    </div>
  );
}
