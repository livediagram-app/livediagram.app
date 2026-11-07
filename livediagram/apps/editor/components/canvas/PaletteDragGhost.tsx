'use client';

import { useEffect, useState } from 'react';
import { ShapeGlyph } from '@/components/primitives/shape-icon';
import { usePaletteDragPreview, usePaletteDragSnap } from '@/lib/palette-drag-preview';
import { overFloatingPanel } from '@liveworkspace/workbench/lib/canvas-pointer';
import { placingSize, usePlacingFacing } from '@/lib/placing-facing';
import { usePlacingTurnKeys } from '@/hooks/canvas/usePlacingTurnKeys';

// Drag-to-add ghost (docs/specs/010-palette/palette-drag-ghost.md). While a palette tile is being dragged, this
// paints a translucent footprint of what will land — sized to the shape's
// default footprint × the current zoom, centred on the cursor (matching where
// dropPaletteItem places it) — so the drop has live, on-canvas feedback
// instead of the browser's default tile snapshot.
//
// A piece that turns (docs/specs/009-elements/furniture-facing.md "Turning while placing") is turned by Space while
// its tile is armed (`armedKind`) or dragged: the ghost takes the turned footprint, and a tile carried by the pointer
// (lib/palette-carry.ts) moves it by pointermoves rather than dragovers.
export function PaletteDragGhost({
  zoom,
  armedKind = null,
}: {
  zoom: number;
  armedKind?: string | null;
}) {
  const preview = usePaletteDragPreview();
  // What is being placed: the dragged tile's kind, else the armed one. Space turns it while it is.
  const placing = preview?.kind ?? armedKind;
  usePlacingTurnKeys(placing);
  // Read so the ghost re-renders when Space turns the piece; placingSize measures the turned box.
  usePlacingFacing(placing);
  // The live alignment snap (docs/specs/021-event-storming/event-storming.md), published by usePaletteDragGuides:
  // the ghost draws where the element will LAND, not under the raw cursor,
  // so the guide lines and the footprint agree.
  const snap = usePaletteDragSnap();
  // Live cursor + whether it's over a valid drop target (the canvas, not a
  // floating panel). Reset whenever a drag isn't in progress.
  const [cursor, setCursor] = useState<{ x: number; y: number; over: boolean } | null>(null);
  // A finished drag forgets its cursor, so the next one starts from none.
  if (!preview && cursor) setCursor(null);

  useEffect(() => {
    if (!preview) return;
    const onDragOver = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // Panels live inside the canvas <main> for layout, so a drag back over
      // the palette still reports the canvas — exclude panels explicitly,
      // mirroring usePaletteDrop's no-drop guard.
      const overPanel = overFloatingPanel(target);
      const overCanvas = !!target?.closest?.('main');
      setCursor({ x: e.clientX, y: e.clientY, over: overCanvas && !overPanel });
    };
    const move = preview.carried ? 'pointermove' : 'dragover';
    document.addEventListener(move, onDragOver);
    return () => document.removeEventListener(move, onDragOver);
  }, [preview]);

  if (!preview || !cursor || !cursor.over) return null;

  const size = placingSize(preview.kind, preview);
  const w = size.width * zoom;
  const h = size.height * zoom;
  // A crisp dashed footprint box (consistent 2px) with the shape's glyph
  // centred inside, rather than a stretched silhouette (whose stroke would
  // scale with the box). Communicates footprint + which shape, cleanly.
  const glyph = Math.max(16, Math.min(w, h) * 0.5);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[var(--z-overlay)] flex animate-fade-in items-center justify-center rounded-lg border-2 border-dashed border-brand-500/70 bg-brand-500/5 text-brand-500/80 dark:border-brand-400/70 dark:bg-brand-400/10 dark:text-brand-300/90"
      style={{
        left: cursor.x + (snap?.dx ?? 0) * zoom,
        top: cursor.y + (snap?.dy ?? 0) * zoom,
        width: w,
        height: h,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <ShapeGlyph kind={preview.kind} size={glyph} stroke="currentColor" />
    </div>
  );
}
