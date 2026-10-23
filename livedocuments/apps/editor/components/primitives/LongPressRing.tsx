'use client';

import { Portal } from '@livedocuments/ui';

// The touch "hold" ring at the finger (docs/specs/008-canvas/canvas-and-palette.md, press and hold): it shows once a
// press has been held past useLongPress's reveal delay and completes as the long press fires. Portalled so a canvas
// transform never moves it off the finger; `point` is useLongPress's `pressPoint`.
export function LongPressRing({ point }: { point: { x: number; y: number } | null }) {
  if (!point) return null;
  return (
    <Portal>
      <div
        aria-hidden
        className="animate-longpress-hold pointer-events-none fixed z-[var(--z-toast)] h-9 w-9 rounded-full border-2 border-brand-500/70"
        style={{ left: point.x, top: point.y }}
      />
    </Portal>
  );
}
