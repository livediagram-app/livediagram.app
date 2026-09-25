'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { POPOVER_VIEWPORT_MARGIN, clampIntoRange } from '@livediagram/ui';

// The popover an open chart stack deals its members into (spec/22).
//
// Floating, not in the flow: a tray that pushed the page down made every open
// and close reflow everything below, and a tall one sent the reader scrolling
// to find the cards. This sits over the page, anchored to the head card, and
// is placed to fit the viewport so the whole set is on screen at once.
//
// Portalled to document.body at fixed coordinates, like the Timeline's filter
// popover, so no ancestor's overflow or stacking context can clip it.

// Roughly one grid column of the dashboard at xl, so a member card in the
// popover reads the same as a card on the page.
const COLUMN_PX = 340;
const GAP_PX = 16;
const PADDING_PX = 16;
// The gap between the head card and the popover.
const OFFSET_PX = 10;

// Columns for N members: one row up to three, a square 2-up grid for four
// (two rows, not a row of three and a straggler), then three across.
const columnsFor = (n: number) => (n <= 3 ? n : n === 4 ? 2 : 3);

const GRID_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
};

export function StackPopover({
  anchor,
  title,
  subtitle,
  count,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  title: string;
  subtitle: string;
  count: number; // members, for the column count
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cols = columnsFor(count);
  const naturalWidth = cols * COLUMN_PX + (cols - 1) * GAP_PX + PADDING_PX * 2;
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number }>();

  // Place before paint so it never flashes at the wrong spot. Centred on the
  // head, clamped into the viewport; below the head if it fits, else above,
  // else as high as it can go with its body scrolling.
  useLayoutEffect(() => {
    const place = () => {
      const panel = ref.current;
      if (!panel) return;
      const a = anchor.getBoundingClientRect();
      const m = POPOVER_VIEWPORT_MARGIN;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(naturalWidth, vw - m * 2);
      const height = panel.scrollHeight;
      const left = clampIntoRange(a.left + a.width / 2 - width / 2, m, vw - width - m);
      let top: number;
      if (a.bottom + OFFSET_PX + height <= vh - m) top = a.bottom + OFFSET_PX;
      else if (a.top - OFFSET_PX - height >= m) top = a.top - OFFSET_PX - height;
      else top = clampIntoRange(vh - m - height, m, vh - m);
      setPosition({ left, top, maxHeight: vh - m * 2 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, naturalWidth]);

  // Focus moves in so Escape works straight away, and back to the head on
  // close so a keyboard user lands where they started.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    return () => anchor.focus({ preventScroll: true });
  }, [anchor]);

  useEffect(() => {
    // Clicks on the head are left to the head: it toggles the popover shut
    // itself, and closing here first would let that click reopen it.
    const outside = (target: EventTarget | null) =>
      target instanceof Node && !ref.current?.contains(target) && !anchor.contains(target);
    const onDown = (e: MouseEvent) => {
      if (outside(e.target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // The page scrolling would leave the popover floating away from its head,
    // so it closes; scrolling inside the popover's own body does not.
    const onScroll = (e: Event) => {
      if (outside(e.target)) onClose();
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      style={{
        position: 'fixed',
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        width: `min(${naturalWidth}px, calc(100vw - ${POPOVER_VIEWPORT_MARGIN * 2}px))`,
        maxHeight: position?.maxHeight,
        visibility: position ? 'visible' : 'hidden',
      }}
      className="z-[var(--z-popover)] flex animate-fade-in flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-950"
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div
        className={`grid grid-cols-1 gap-4 overflow-y-auto ${GRID_COLS[cols] ?? ''}`}
        style={{ padding: PADDING_PX, paddingTop: 12 }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
