'use client';

// Palette drag-drop onto the canvas, lifted out of Canvas. Accepts drops
// carrying a palette shape / line-art icon / tech-icon / sticker MIME,
// converts the drop point to world-space canvas coords, and dispatches
// onDropPalette. Returns the onDragOver / onDrop handlers to spread onto the
// canvas <main>.

import type { DragEvent as ReactDragEvent, RefObject } from 'react';
import type { ShapeKind } from '@livediagram/diagram';
import { pointerToCanvas } from '@/lib/canvas';
import { ICON_DND_MIME, PALETTE_DND_MIME } from '@/lib/icons';
import { STICKER_DND_MIME } from '@/lib/stickers';
import { getPaletteDragSnap, setPaletteDragSnap } from '@/lib/palette-drag-preview';
import { TECH_ICON_DND_MIME } from '@/lib/tech-icons';

type PaletteDropDeps = {
  // 'sticky' rides beside the shape kinds (docs/specs/021-event-storming/event-storming.md): a sticky is its own
  // element type, and the drop needs to build one rather than a shape.
  onDropPalette?: (
    kind: ShapeKind | 'sticky',
    canvasX: number,
    canvasY: number,
    art?: { iconId?: string; stickerId?: string; choice?: string },
  ) => void;
  viewportZoom: number;
  // The TRANSFORMED canvas wrapper (scale + translate applied), same as the
  // double-click add path: its rect already bakes in zoom, pan AND the
  // origin-center pivot, so dividing by zoom yields world coords directly.
  wrapperRef: RefObject<HTMLElement | null>;
  // A photo dropped on an EVENT-STORMING board is a piece of wall, not a
  // picture (docs/specs/021-event-storming/event-storming.md Phase 8): it is read, and nothing becomes an image
  // element. Supplied only on such a board with the model configured, so
  // every other board — and this one without a key — keeps today's behaviour
  // exactly, which is that a dropped file does nothing here at all.
  onDropPhoto?: (file: File) => void;
};

export function usePaletteDrop({
  onDropPalette,
  viewportZoom,
  wrapperRef,
  onDropPhoto,
}: PaletteDropDeps) {
  // The one file the drop would read, or null. `image/*` only, and only when
  // the board is one that reads photos.
  const photoFrom = (e: ReactDragEvent<HTMLElement>): File | null => {
    if (!onDropPhoto) return null;
    const file = e.dataTransfer.files?.[0];
    return file && file.type.startsWith('image/') ? file : null;
  };
  const onDragOver = (e: ReactDragEvent<HTMLElement>) => {
    // A drag back over a floating panel (the Palette itself) is a "changed my
    // mind" — show no-drop and don't let the drop below add anything. The
    // dragover events still bubble here from the panel, so check the target,
    // not just the MIME type.
    if ((e.target as Element | null)?.closest?.('[data-floating-panel]')) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    // A photo on an event-storming board is accepted the same way a tile is,
    // so the cursor says it will land rather than showing the no-drop sign.
    if (onDropPhoto && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      return;
    }
    // Allow dropping palette tiles (shapes / devices / icons).
    if (
      e.dataTransfer.types.includes(PALETTE_DND_MIME) ||
      e.dataTransfer.types.includes(ICON_DND_MIME) ||
      e.dataTransfer.types.includes(TECH_ICON_DND_MIME) ||
      e.dataTransfer.types.includes(STICKER_DND_MIME)
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
    // `kind` or `kind|choice` — the creation-time choice a split tile
    // carries (docs/specs/009-elements/mode-button.md, /105, /123, /135). Without parsing it back out, a
    // dragged Poll tile dropped a timer.
    // A photograph of the wall, read rather than placed (docs/specs/021-event-storming/event-storming.md Phase 8).
    const photo = photoFrom(e);
    if (photo) {
      e.preventDefault();
      onDropPhoto?.(photo);
      return;
    }
    const payload = e.dataTransfer.getData(PALETTE_DND_MIME);
    const [shapeKind, dragChoice] = payload.split('|');
    // A line-art icon and a tech (brand) icon both drop as an 'icon' shape
    // carrying the id; dropPaletteItem picks the telemetry type.
    const iconId =
      e.dataTransfer.getData(ICON_DND_MIME) || e.dataTransfer.getData(TECH_ICON_DND_MIME);
    // A sticker carries its OWN mime (docs/specs/010-palette/stickers.md) precisely so it can't be
    // mistaken for an icon: an icon dropped on a shape folds into that
    // shape's label, and a sticker must never do that.
    const stickerId = e.dataTransfer.getData(STICKER_DND_MIME);
    if (!shapeKind && !iconId && !stickerId) return;
    e.preventDefault();
    // Invert via the transformed wrapper rect (like the double-click add):
    // measuring the untransformed <main> instead misses the origin-center
    // pivot term, landing drops off-cursor at any zoom other than 100%.
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const raw = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    // Land where the ghost + guides promised (docs/specs/021-event-storming/event-storming.md): the alignment snap
    // the drag latched onto, not the raw cursor. Cleared immediately so a
    // later drag can't inherit a stale offset.
    const snap = getPaletteDragSnap();
    setPaletteDragSnap(null);
    const cx = raw.x + (snap?.dx ?? 0);
    const cy = raw.y + (snap?.dy ?? 0);
    if (stickerId) onDropPalette?.('sticker', cx, cy, { stickerId });
    else if (iconId) onDropPalette?.('icon', cx, cy, { iconId });
    else
      onDropPalette?.(
        shapeKind as ShapeKind,
        cx,
        cy,
        dragChoice ? { choice: dragChoice } : undefined,
      );
  };
  return { onDragOver, onDrop };
}
