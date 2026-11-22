'use client';

// The open suggested edit (docs/specs/030-knowledgebase/ai-knowledge.md "On the page"): a popover beside what opened
// it (a margin marker, the pill, a rail row), centred when nothing did (an Inbox link), and the shared bottom sheet on
// a phone. Measured once as it opens and again on a scroll or a resize while open, never per frame otherwise.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  clampIntoRange,
  Portal,
  POPOVER_VIEWPORT_MARGIN,
  useClickOutside,
} from '@liveknowledge/ui';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';

/** The popover's width, as the approved design draws it. */
export const SUGGESTION_POPOVER_WIDTH = 500;
const GAP = 8;

type Place = { left: number; top: number; width: number } | null;

function placeOf(anchor: HTMLElement | null, el: HTMLElement | null): Place {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(SUGGESTION_POPOVER_WIDTH, vw - POPOVER_VIEWPORT_MARGIN * 2);
  const height = el?.offsetHeight ?? 0;
  if (!anchor || !anchor.isConnected)
    return {
      width,
      left: (vw - width) / 2,
      top: Math.max(POPOVER_VIEWPORT_MARGIN, (vh - height) / 2),
    };
  const r = anchor.getBoundingClientRect();
  const below = r.bottom + GAP;
  const top =
    below + height <= vh - POPOVER_VIEWPORT_MARGIN || r.top - GAP - height < POPOVER_VIEWPORT_MARGIN
      ? below
      : r.top - GAP - height;
  return {
    width,
    left: clampIntoRange(r.left, POPOVER_VIEWPORT_MARGIN, vw - width - POPOVER_VIEWPORT_MARGIN),
    top: clampIntoRange(
      top,
      POPOVER_VIEWPORT_MARGIN,
      Math.max(POPOVER_VIEWPORT_MARGIN, vh - height - POPOVER_VIEWPORT_MARGIN),
    ),
  };
}

export function SuggestionPopover({
  anchor,
  sheet,
  onClose,
  children,
}: {
  anchor: HTMLElement | null;
  sheet: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place>(null);
  useLayoutEffect(() => {
    if (sheet) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPlace(placeOf(anchor, ref.current)));
    };
    setPlace(placeOf(anchor, ref.current));
    measure();
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, { capture: true });
    };
  }, [anchor, sheet]);
  // A press outside closes it; one on what opened it is that control's own (it toggles).
  useClickOutside(
    ref,
    (event) => {
      if (anchor && event.target instanceof Node && anchor.contains(event.target)) return;
      onClose();
    },
    !sheet,
  );
  if (sheet)
    return (
      <BottomSheet
        role="dialog"
        aria-label="Suggested Edit"
        data-suggestion-sheet=""
        onClose={onClose}
        zClassName="z-[var(--z-modal)]"
      >
        <div className="px-5 pb-6 pt-2">{children}</div>
      </BottomSheet>
    );
  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        aria-label="Suggested Edit"
        data-suggestion-popover=""
        onPointerDown={(e) => e.stopPropagation()}
        style={
          place
            ? { left: place.left, top: place.top, width: place.width }
            : { visibility: 'hidden', width: SUGGESTION_POPOVER_WIDTH }
        }
        className="fixed z-[var(--z-modal)] max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl motion-safe:transition-opacity motion-safe:duration-150 motion-safe:starting:opacity-0 dark:border-slate-800 dark:bg-slate-900"
      >
        {children}
      </div>
    </Portal>
  );
}
