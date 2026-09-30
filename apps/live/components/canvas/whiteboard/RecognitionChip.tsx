'use client';

import { useEffect, useRef } from 'react';
import type { RecognitionChipState } from '@/hooks/canvas/useRecognitionPreview';

// The chip's corner sits this far above and before the pen's tip, in screen px, so the hand
// holding the pen never covers it (docs/specs/023-whiteboard/whiteboard.md "Shape recognition").
export const RECOGNITION_CHIP_GAP_PX = 12;

const LABEL: Record<RecognitionChipState['action'], string> = {
  make: 'Make shape',
  keep: 'Keep drawing',
};

type RecognitionChipProps = {
  chip: RecognitionChipState;
  /** The canvas zoom, undone so the chip keeps its size on screen. */
  zoom: number;
  onFlip: () => void;
};

// What Alt does, for a pen or finger with no keyboard (docs/specs/023-whiteboard/whiteboard.md
// "Shape recognition"): a tap with the other hand flips the stroke while the pen stays down. It
// sits in the canvas's transformed layer beside the stroke, at the tip, with the zoom undone: a
// 44 x 44 px target at any zoom. Its presses are its own: `data-floating-panel` keeps the canvas's
// capture-phase handler (pan, the pen-seen palm rule, a new stroke) out, the press stops at the
// chip, and its touchstart never reaches the document's pinch detection, so the tap is never a
// pan, a pinch or a stroke, and the stroke under the pen carries on.
export function RecognitionChip({ chip, zoom, onFlip }: RecognitionChipProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const own = (e: TouchEvent) => e.stopPropagation();
    el.addEventListener('touchstart', own, { passive: true });
    return () => el.removeEventListener('touchstart', own);
  }, []);
  const label = LABEL[chip.action];
  return (
    <div
      data-recognition-chip-anchor=""
      className="pointer-events-none absolute left-0 top-0 z-10 origin-top-left"
      style={{ transform: `translate(${chip.at.x}px, ${chip.at.y}px) scale(${1 / (zoom || 1)})` }}
    >
      <button
        ref={ref}
        type="button"
        // Only there while a pen is held down, where the keyboard has Alt: never a tab stop.
        tabIndex={-1}
        data-floating-panel=""
        data-recognition-chip={chip.action}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFlip();
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ right: RECOGNITION_CHIP_GAP_PX, bottom: RECOGNITION_CHIP_GAP_PX }}
        className="pointer-events-auto absolute flex h-11 min-w-11 touch-none select-none items-center whitespace-nowrap rounded-full bg-slate-900 px-4 text-sm font-medium text-white shadow-lg ring-1 ring-white/20 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-900/20"
      >
        <span className="text-optical-centre">{label}</span>
      </button>
    </div>
  );
}
