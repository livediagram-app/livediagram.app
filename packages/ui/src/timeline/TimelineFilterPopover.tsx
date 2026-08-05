'use client';

// The filter popover: per-source-type chips plus a mini calendar
// (spec/138 §2.3).
//
// Portalled to document.body at fixed coordinates. That is mandatory,
// not a preference: this popover opens inside a rounded card with
// `overflow: hidden`, and an in-tree absolute element is clipped by
// that ancestor no matter what z-index it carries.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { POPOVER_VIEWPORT_MARGIN, clampIntoRange } from '../popover';
import { buildMonthCells, formatMonth, shiftMonth } from './monthCells';
import { sourceTypeColor, sourceTypeLabel } from './sourceTypeMeta';

const WIDTH = 272;
const GAP = 8;

export function TimelineFilterPopover({
  anchor,
  allSourceTypes,
  excluded,
  onToggle,
  onReset,
  eventDates,
  monthKey,
  onMonthChange,
  onPickDate,
  onClose,
}: {
  anchor: DOMRect;
  allSourceTypes: string[];
  excluded: Set<string>;
  onToggle: (sourceType: string) => void;
  onReset: () => void;
  // YYYY-MM-DD keys that have at least one event.
  eventDates: Set<string>;
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  onPickDate: (dateKey: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchor.left, top: anchor.bottom + GAP });

  // Re-anchor before paint so the popover never renders once at the
  // wrong coordinates and jumps.
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 320;
    setPosition({
      left: clampIntoRange(
        anchor.right - WIDTH,
        POPOVER_VIEWPORT_MARGIN,
        window.innerWidth - WIDTH - POPOVER_VIEWPORT_MARGIN,
      ),
      // Flip above the trigger when there isn't room below, rather than
      // letting the panel run off the bottom of a short viewport.
      top:
        anchor.bottom + GAP + height > window.innerHeight - POPOVER_VIEWPORT_MARGIN
          ? Math.max(POPOVER_VIEWPORT_MARGIN, anchor.top - GAP - height)
          : anchor.bottom + GAP,
    });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Capture phase: the trigger button's own click handler would
    // otherwise toggle the popover straight back open.
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const cells = buildMonthCells(monthKey);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Timeline filters"
      style={{ position: 'fixed', left: position.left, top: position.top, width: WIDTH }}
      className="z-[var(--z-popover)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Show
        </p>
        {excluded.size > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-brand-600 hover:underline dark:text-brand-400"
          >
            Reset
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allSourceTypes.map((sourceType) => {
          const on = !excluded.has(sourceType);
          return (
            <button
              key={sourceType}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(sourceType)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                on
                  ? 'border-transparent text-white'
                  : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
              }`}
              style={on ? { backgroundColor: sourceTypeColor(sourceType) } : undefined}
            >
              {sourceTypeLabel(sourceType)}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonth(monthKey, -1))}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Chevron direction={-1} />
          </button>
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {formatMonth(monthKey)}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(shiftMonth(monthKey, 1))}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Chevron direction={1} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, index) => {
            if (!cell.key) return <div key={`pad-${index}`} className="h-7" />;
            const has = eventDates.has(cell.key);
            return (
              <button
                key={cell.key}
                type="button"
                disabled={!has}
                onClick={() => {
                  onPickDate(cell.key!);
                  onClose();
                }}
                className={`h-7 rounded text-[11px] transition ${
                  has
                    ? 'font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Chevron({ direction }: { direction: 1 | -1 }) {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 1 ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
      />
    </svg>
  );
}
