'use client';

// Palette drag-drop onto the canvas, lifted out of Canvas. Accepts drops
// carrying a palette shape / line-art icon / tech-icon MIME, converts the drop
// point to world-space canvas coords, and dispatches onDropPalette. Returns the
// onDragOver / onDrop handlers to spread onto the canvas <main>.

import type { DragEvent as ReactDragEvent, RefObject } from 'react';
import type { ShapeKind } from '@livediagram/diagram';
import { pointerToCanvas } from '@/lib/canvas';
import { ICON_DND_MIME, PALETTE_DND_MIME } from '@/lib/icons';
import { TECH_ICON_DND_MIME } from '@/lib/tech-icons';

type PaletteDropDeps = {
  onDropPalette?: (kind: ShapeKind, canvasX: number, canvasY: number, iconId?: string) => void;
  viewportZoom: number;
  // The TRANSFORMED canvas wrapper (scale + translate applied), same as the
  // double-click add path: its rect already bakes in zoom, pan AND the
  // origin-center pivot, so dividing by zoom yields world coords directly.
  wrapperRef: RefObject<HTMLElement | null>;
};

export function usePaletteDrop({ onDropPalette, viewportZoom, wrapperRef }: PaletteDropDeps) {
  const onDragOver = (e: ReactDragEvent<HTMLElement>) => {
    // A drag back over a floating panel (the Palette itself) is a "changed my
    // mind" — show no-drop and don't let the drop below add anything. The
    // dragover events still bubble here from the panel, so check the target,
    // not just the MIME type.
    if ((e.target as Element | null)?.closest?.('[data-floating-panel]')) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    // Allow dropping palette tiles (shapes / devices / icons).
    if (
      e.dataTransfer.types.includes(PALETTE_DND_MIME) ||
      e.dataTransfer.types.includes(ICON_DND_MIME) ||
      e.dataTransfer.types.includes(TECH_ICON_DND_MIME)
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: ReactDragEvent<HTMLElement>) => {
    // Dropped back onto a floating panel (the Palette) — cancel: the drop event
    // bubbles up from the panel to this canvas handler, so without this guard a
    // drop over the Palette would still add an element behind it.
    if ((e.target as Element | null)?.closest?.('[data-floating-panel]')) return;
    const shapeKind = e.dataTransfer.getData(PALETTE_DND_MIME);
    // A line-art icon and a tech (brand) icon both drop as an 'icon' shape
    // carrying the id; dropPaletteItem picks the telemetry type.
    const iconId =
      e.dataTransfer.getData(ICON_DND_MIME) || e.dataTransfer.getData(TECH_ICON_DND_MIME);
    if (!shapeKind && !iconId) return;
    e.preventDefault();
    // Invert via the transformed wrapper rect (like the double-click add):
    // measuring the untransformed <main> instead misses the origin-center
    // pivot term, landing drops off-cursor at any zoom other than 100%.
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: cx, y: cy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    if (iconId) onDropPalette?.('icon', cx, cy, iconId);
    else onDropPalette?.(shapeKind as ShapeKind, cx, cy);
  };
  return { onDragOver, onDrop };
}
