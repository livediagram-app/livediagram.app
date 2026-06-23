'use client';

import { useLayoutEffect, useState } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { VIEWPORT_EDGE_MARGIN as EDGE_MARGIN } from '@/lib/clamp-to-viewport';

// The fixed note glyph inside an annotation marker (spec/38). A small
// speech bubble with text lines, tinted by the marker's stroke colour.
// Sized as a fraction of the circle so it stays centred at any zoom (the
// wrapper handles the scaling). Always the same glyph — annotations are
// not per-marker icon-pickable, on purpose, so they read uniformly.
export function AnnotationGlyph({ stroke }: { stroke: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg
        width="58%"
        height="58%"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
        <path d="M6.5 9.75h11" />
        <path d="M6.5 12.5h7" />
      </svg>
    </div>
  );
}

const GAP = 10;
const MAX_W = 280;

// Read-only note preview that floats ABOVE every canvas element when an
// annotation is hovered (spec/38). Portaled to the body with a high
// z-index so it's legible even when other elements are painted on top of
// the marker. Anchors to the marker's live DOM rect (which already
// includes the canvas pan + zoom) the same way NotePopover does, so it
// stays attached as the canvas moves. No interactivity — hovering is a
// read gesture; clicking the marker opens the editable popover instead.
export function AnnotationHoverNote({ elementId, note }: { elementId: string; note: string }) {
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const node = document.querySelector(`[data-element-id="${elementId}"]`);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const left = Math.max(
        EDGE_MARGIN + MAX_W / 2,
        Math.min(rect.left + rect.width / 2, window.innerWidth - EDGE_MARGIN - MAX_W / 2),
      );
      // Prefer above the marker; flip below when there's no room up top.
      const below = rect.top - GAP < 120;
      const top = below ? rect.bottom + GAP : rect.top - GAP;
      setPos({ left, top, below });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [elementId]);

  if (!pos) return null;

  return (
    <Portal>
      <div
        className="pointer-events-none fixed z-[var(--z-toast)] max-h-60 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-snug text-slate-800 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/50"
        style={{
          left: pos.left,
          top: pos.top,
          maxWidth: MAX_W,
          transform: `translate(-50%, ${pos.below ? '0' : '-100%'})`,
        }}
      >
        {note}
      </div>
    </Portal>
  );
}
