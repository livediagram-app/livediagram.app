'use client';

import { useEffect, useState } from 'react';
import { ShapeGlyph } from '@/components/primitives/shape-icon';
import { usePaletteDragPreview } from '@/lib/palette-drag-preview';

// Drag-to-add ghost (spec/58). While a palette tile is being dragged, this
// paints a translucent footprint of what will land — sized to the shape's
// default footprint × the current zoom, centred on the cursor (matching where
// dropPaletteItem places it) — so the drop has live, on-canvas feedback
// instead of the browser's default tile snapshot.
export function PaletteDragGhost({ zoom }: { zoom: number }) {
  const preview = usePaletteDragPreview();
  // Live cursor + whether it's over a valid drop target (the canvas, not a
  // floating panel). Reset whenever a drag isn't in progress.
  const [cursor, setCursor] = useState<{ x: number; y: number; over: boolean } | null>(null);

  useEffect(() => {
    if (!preview) {
      setCursor(null);
      return;
    }
    const onDragOver = (e: DragEvent) => {
      const target = e.target as Element | null;
      // Panels live inside the canvas <main> for layout, so a drag back over
      // the palette still reports the canvas — exclude panels explicitly,
      // mirroring usePaletteDrop's no-drop guard.
      const overPanel = !!target?.closest?.('[data-floating-panel]');
      const overCanvas = !!target?.closest?.('main');
      setCursor({ x: e.clientX, y: e.clientY, over: overCanvas && !overPanel });
    };
    document.addEventListener('dragover', onDragOver);
    return () => document.removeEventListener('dragover', onDragOver);
  }, [preview]);

  if (!preview || !cursor || !cursor.over) return null;

  const w = preview.width * zoom;
  const h = preview.height * zoom;
  // A crisp dashed footprint box (consistent 2px) with the shape's glyph
  // centred inside, rather than a stretched silhouette (whose stroke would
  // scale with the box). Communicates footprint + which shape, cleanly.
  const glyph = Math.max(16, Math.min(w, h) * 0.5);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[var(--z-overlay)] flex animate-fade-in items-center justify-center rounded-lg border-2 border-dashed border-brand-500/70 bg-brand-500/5 text-brand-500/80 dark:border-brand-400/70 dark:bg-brand-400/10 dark:text-brand-300/90"
      style={{
        left: cursor.x,
        top: cursor.y,
        width: w,
        height: h,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <ShapeGlyph kind={preview.kind} size={glyph} stroke="currentColor" />
    </div>
  );
}
