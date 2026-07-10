'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import { placeTourPopover } from './tour-position';

// The tour's step card (spec/79): step count, title, copy, and the
// Back / Next / Skip controls. Positioning is measured two-pass (render
// hidden, measure, place) against the current target rect; on narrow
// (mobile) viewports it skips the anchored math and docks above the tab
// bar as a bottom sheet, which sidesteps every clamping headache the
// full-width panel popovers would cause.
export function TourPopover({
  stepNumber,
  stepCount,
  title,
  body,
  targetRect,
  onBack,
  onNext,
  onSkip,
}: {
  stepNumber: number;
  stepCount: number;
  title: string;
  body: string;
  // Viewport rect of the highlighted target; null while the step is still
  // preparing (the card then centres itself).
  targetRect: DOMRect | null;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const isLast = stepNumber === stepCount;
  const sheetMode = typeof window !== 'undefined' && window.innerWidth < 640;

  useLayoutEffect(() => {
    if (sheetMode) return;
    const node = ref.current;
    if (!node) return;
    const place = () => {
      const size = { width: node.offsetWidth, height: node.offsetHeight };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const placed = targetRect
        ? placeTourPopover(
            {
              left: targetRect.left,
              top: targetRect.top,
              width: targetRect.width,
              height: targetRect.height,
            },
            size,
            viewport,
          )
        : {
            left: (viewport.width - size.width) / 2,
            top: (viewport.height - size.height) / 2,
          };
      setPos({ left: placed.left, top: placed.top });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [targetRect, sheetMode, stepNumber]);

  return (
    <div
      ref={ref}
      data-tour-popover=""
      role="dialog"
      aria-label={`Tour step ${stepNumber} of ${stepCount}: ${title}`}
      onPointerDown={(e) => e.stopPropagation()}
      className={`pointer-events-auto fixed z-[var(--z-toast)] flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40 ${
        sheetMode ? 'inset-x-3 bottom-16' : 'w-80'
      }`}
      style={
        sheetMode
          ? undefined
          : pos
            ? { left: pos.left, top: pos.top }
            : // First paint before measurement: park off-screen so the
              // two-pass placement never flashes at 0,0.
              { left: -9999, top: -9999 }
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
          {stepNumber} of {stepCount}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="text-[11px] font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          Skip tour
        </button>
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        {/* Progress dots keep place without reading like pagination. */}
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: stepCount }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i < stepNumber ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Back
            </button>
          ) : null}
          <Button size="xs" onClick={onNext}>
            {isLast ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
