'use client';

// The Details row's preview: resting the pointer on a row for 600 ms shows the item's snapshot beside it (the
// card's picture, drawn by the host), gone as the pointer leaves. Touch never hovers, so phones never see it;
// it is decoration, hidden from assistive technology.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '../../ui/Portal';

export const HOVER_PREVIEW_MS = 600;
const WIDTH = 224;
const HEIGHT = 140;
const GAP = 12;

type Spot = { left: number; top: number };

export function useHoverPreview(enabled: boolean) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSpot(null);
  }, []);
  useEffect(() => stop, [stop]);
  const onPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || e.pointerType === 'touch') return;
      const row = e.currentTarget;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const box = row.getBoundingClientRect();
        // Beside the row's name, kept on screen.
        const left = Math.min(box.left + 48, window.innerWidth - WIDTH - GAP);
        const below = box.bottom + GAP + HEIGHT <= window.innerHeight;
        setSpot({ left: Math.max(GAP, left), top: below ? box.bottom + 4 : box.top - HEIGHT - 4 });
      }, HOVER_PREVIEW_MS);
    },
    [enabled],
  );
  return { spot, handlers: { onPointerEnter, onPointerLeave: stop, onPointerDown: stop } };
}

export function HoverPreviewCard({ spot, children }: { spot: Spot; children: ReactNode }) {
  return (
    <Portal>
      <div
        aria-hidden
        data-hover-preview=""
        className="pointer-events-none fixed z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
        style={{ left: spot.left, top: spot.top, width: WIDTH, height: HEIGHT }}
      >
        {children}
      </div>
    </Portal>
  );
}
