'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import { placeTourPopover } from './tour-position';
import type { TourTargetRect } from './TourHost';

// The tour's step card (spec/79). Two faces:
// - welcome: the centred offer card ("Show me around" / "No thanks"),
//   no step count, dots, or Back — declining must be one obvious click.
// - step: step count, title, copy, dots, Back / Next / Skip, anchored to
//   the highlighted target.
// Positioning is measured two-pass (render off-screen, measure, place)
// against the current target rect; once placed, left/top transitions are
// enabled so the card GLIDES between steps instead of teleporting, and
// the content slides directionally (the wizard's tip-next / tip-prev).
// On narrow (mobile) viewports anchored steps dock above the tab bar as
// a bottom sheet, which sidesteps every clamping headache; the welcome
// card stays centred everywhere.
export function TourPopover({
  stepNumber,
  stepCount,
  stepId,
  stepDir,
  welcome,
  title,
  body,
  targetRect,
  onBack,
  onNext,
  onSkip,
}: {
  // 1-based within the countable steps; 0 for the welcome card.
  stepNumber: number;
  stepCount: number;
  // Stable step id — keys the content wrapper so the slide animation
  // replays exactly once per step change.
  stepId: string;
  stepDir: 'forward' | 'backward';
  welcome: boolean;
  title: string;
  body: string;
  // Viewport rect of the highlighted target; null while the step is still
  // preparing (the card then centres itself).
  targetRect: TourTargetRect | null;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Position transitions are enabled one frame AFTER the first placement,
  // so the initial park-offscreen → placed jump doesn't animate as a fly-in
  // from the corner (the PaletteTabBar height-animation gate pattern).
  const [animatePos, setAnimatePos] = useState(false);
  const isLast = stepNumber === stepCount;
  const sheetMode = !welcome && typeof window !== 'undefined' && window.innerWidth < 640;

  useLayoutEffect(() => {
    if (sheetMode) return;
    const node = ref.current;
    if (!node) return;
    const place = () => {
      const size = { width: node.offsetWidth, height: node.offsetHeight };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const placed = targetRect
        ? placeTourPopover(targetRect, size, viewport)
        : {
            left: (viewport.width - size.width) / 2,
            top: (viewport.height - size.height) / 2,
          };
      setPos({ left: placed.left, top: placed.top });
    };
    place();
    const raf = requestAnimationFrame(() => setAnimatePos(true));
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
    };
  }, [targetRect, sheetMode, stepId]);

  return (
    <div
      ref={ref}
      data-tour-popover=""
      role="dialog"
      aria-label={welcome ? title : `Tour step ${stepNumber} of ${stepCount}: ${title}`}
      onPointerDown={(e) => e.stopPropagation()}
      className={`pointer-events-auto fixed z-[var(--z-toast)] flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40 ${
        sheetMode ? 'inset-x-3 bottom-16' : welcome ? 'w-[21rem]' : 'w-80'
      } ${animatePos && !sheetMode ? 'transition-[left,top] duration-300 ease-out' : ''}`}
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
      {/* Keyed on the step so each phase slides in directionally (forward
          from the right, back from the left) — the same motion the New
          Diagram wizard uses between its phases. */}
      <div
        key={stepId}
        className={`flex flex-col gap-2 ${stepDir === 'forward' ? 'animate-tip-next' : 'animate-tip-prev'}`}
      >
        {welcome ? (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
              Quick tour
            </span>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>
            <div className="mt-2 flex items-center justify-end gap-2">
              {/* Declining is a first-class, same-weight choice — the offer
                  must never feel like a trap. It also never comes back. */}
              <button
                type="button"
                onClick={onSkip}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                No thanks
              </button>
              <Button size="xs" onClick={onNext}>
                Show me around
              </Button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
