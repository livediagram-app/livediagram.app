'use client';

// The shape under the pointer while it is dragged onto or off the pinned side; outside the dock
// (a portal on the body), so the dock's transform and scroll never clip or offset it.

import { createPortal } from 'react-dom';
import { whiteboardShapeEntry, type WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';
import { ShapePreview } from './ShapePreview';

export function SlotGhost({
  dragKey,
  x,
  y,
  refusing,
}: {
  dragKey: WhiteboardShapeKey;
  x: number;
  y: number;
  refusing: boolean;
}) {
  const entry = whiteboardShapeEntry(dragKey);
  if (!entry || typeof document === 'undefined') return null;
  return createPortal(
    <span
      aria-hidden
      data-slot-ghost={dragKey}
      className={`pointer-events-none fixed z-[var(--z-toolbar)] flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-slate-700 shadow-lg dark:bg-slate-900 dark:text-slate-200 ${
        refusing ? 'border-rose-500' : 'border-brand-500'
      }`}
      style={{ left: x - 22, top: y - 22 }}
    >
      <ShapePreview entry={entry} />
    </span>,
    document.body,
  );
}
