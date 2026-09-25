'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// The modal an open stack deals its members into (spec/22): centred over the
// whole page, which dims behind it and holds still (scroll locked).
//
// Always a modal. Earlier versions were in the flow (a box, then a tray that
// pushed the page down on every open and close) and then a popover anchored
// to the head; the popover had to hunt for room above or below the head and
// covered it whenever there was none. Centred, the set always has the whole
// viewport and always lands in the same place.
//
// Portalled to document.body so no ancestor's overflow or stacking context
// can clip it. Centred by a flex container rather than measured, so it needs
// no layout pass and follows a resize for free.

// Roughly one grid column of the dashboard at xl, so a member card in the
// modal reads the same as a card on the page.
const COLUMN_PX = 340;
const GAP_PX = 16;
const PADDING_PX = 16;

// Columns for N members: one row up to three, a square 2-up grid for four
// (two rows, not a row of three and a straggler), then three across.
const columnsFor = (n: number) => (n <= 3 ? n : n === 4 ? 2 : 3);

const GRID_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
};

export function StackModal({
  anchor,
  title,
  subtitle,
  count,
  onClose,
  footer,
  children,
}: {
  anchor: HTMLElement; // the head card, which gets focus back on close
  title: string;
  subtitle: string;
  count: number; // members, for the column count
  onClose: () => void;
  // Pinned under the scrolling cards, full width (a See also link).
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cols = columnsFor(count);
  const width = cols * COLUMN_PX + (cols - 1) * GAP_PX + PADDING_PX * 2;

  // Focus moves in so Escape works straight away, and back to the head on
  // close so a keyboard user lands where they started.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    return () => anchor.focus({ preventScroll: true });
  }, [anchor]);

  // The page holds still behind the modal.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    // The dim takes a click on the page and closes, so closing never also
    // presses whatever sat beneath (a tab, a card). Only a press that starts
    // on the dim itself counts, not one inside the modal.
    <div
      className="stack-dim fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-2"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal
        aria-label={title}
        tabIndex={-1}
        style={{ width: `min(${width}px, 100%)` }}
        className="flex max-h-full animate-fade-in flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-950"
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
          className={`scrollbar-slim grid grid-cols-1 gap-4 overflow-y-auto overscroll-contain ${GRID_COLS[cols] ?? ''}`}
          style={{ padding: PADDING_PX, paddingTop: 12 }}
        >
          {children}
        </div>
        {footer ? <div className="px-4 pb-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
