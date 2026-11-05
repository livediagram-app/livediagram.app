'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
  createShape,
  defaultFillColor,
  defaultStrokeColor,
  isPlacedShape,
  snapDoorToWall,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { overFloatingPanel } from '@liveworkspace/workbench/lib/canvas-pointer';
import { pointerToCanvas } from '@/lib/canvas';
import { usePaletteDragPreview, usePaletteDragSnap } from '@/lib/palette-drag-preview';
import type { PendingDraw } from '@/lib/draw-mode';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { PieceArt, hasPieceArt } from '@/components/canvas/PieceArt';
import { ShapeGlyph } from '@/components/primitives/shape-icon';

// Where a placed piece would land with the pointer at canvas point `at`: at its own size, centred on the point (as a
// click or a drop places one). A Door then snaps onto the nearest wall, as its click and drop do
// (docs/specs/009-elements/room-builder.md "Door").
export function placementLanding(
  kind: string,
  at: { x: number; y: number },
  elements: readonly Element[],
): { piece: ShapeElement; onWall: boolean } {
  const base = createShape(kind as ShapeElement['shape'], 0, 0);
  const free = { ...base, x: at.x - base.width / 2, y: at.y - base.height / 2 };
  if (kind !== 'door') return { piece: free, onWall: false };
  const door = snapDoorToWall(free, elements);
  return { piece: door, onWall: door !== free };
}

// The placed kind being added, or null: its tile armed for a click, or dragged from the palette.
export function placingKind(pendingDraw: PendingDraw | null, draggedKind: string | null) {
  if (pendingDraw?.type === 'shape' && isPlacedShape(pendingDraw.kind)) return pendingDraw.kind;
  return draggedKind && isPlacedShape(draggedKind) ? draggedKind : null;
}

// The placement preview (docs/specs/010-palette/palette-drag-ghost.md "Placed pieces preview themselves"): the piece
// itself, translucent, under the pointer, where a click or a drop would put it. Drawn inside the canvas's
// transformed layer, so it pans, zooms and turns with the content; it listens to the pointer only while a placed
// piece is being added, and moves at most once a frame.
export function PlacementPreview({
  pendingDraw,
  elements,
  wrapperRef,
  zoom,
}: {
  pendingDraw: PendingDraw | null;
  elements: readonly Element[];
  wrapperRef: RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const dragged = usePaletteDragPreview();
  const kind = placingKind(pendingDraw, dragged?.kind ?? null);
  // A drag lands where the alignment snap says, as the ghost and the drop do.
  const snap = usePaletteDragSnap();
  const dragging = !!dragged && dragged.kind === kind;
  const surface = useCanvasSurface();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  if (!kind && at) setAt(null);

  useEffect(() => {
    if (!kind) return;
    let frame: number | null = null;
    let latest: { x: number; y: number } | null = null;
    const track = (e: PointerEvent | DragEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const overCanvas = !!(e.target as HTMLElement | null)?.closest?.('main');
      latest =
        rect && overCanvas && !overFloatingPanel(e.target)
          ? pointerToCanvas(e.clientX, e.clientY, rect, zoom)
          : null;
      frame ??= requestAnimationFrame(() => {
        frame = null;
        setAt(latest);
      });
    };
    window.addEventListener('pointermove', track);
    document.addEventListener('dragover', track);
    return () => {
      window.removeEventListener('pointermove', track);
      document.removeEventListener('dragover', track);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [kind, wrapperRef, zoom]);

  // The art is drawn once per kind, at the origin, and only its box moves: a pointer move re-renders a div, not the
  // piece (the Door is the exception, as its wall turns it).
  const art = useMemo(() => {
    if (!kind || kind === 'door' || !hasPieceArt(kind)) return null;
    const piece = createShape(kind as ShapeElement['shape'], 0, 0);
    return (
      <PieceArt
        element={piece}
        stroke={defaultStrokeColor(piece, surface)}
        fill={defaultFillColor(piece, surface)}
      />
    );
  }, [kind, surface]);

  if (!kind || !at) return null;
  const point = dragging && snap ? { x: at.x + snap.dx, y: at.y + snap.dy } : at;
  const { piece, onWall } = placementLanding(kind, point, elements);
  const door = kind === 'door';
  const drawn = door ? (
    <PieceArt
      element={piece}
      stroke={defaultStrokeColor(piece, surface)}
      fill={defaultFillColor(piece, surface)}
    />
  ) : (
    art
  );
  return (
    <div
      aria-hidden
      data-testid="placement-preview"
      data-kind={kind}
      data-on-wall={onWall ? '' : undefined}
      className={`pointer-events-none absolute rounded-sm outline-2 outline-offset-2 ${
        door && onWall
          ? 'opacity-80 outline outline-brand-500 dark:outline-brand-400'
          : drawn
            ? `opacity-60 ${door ? 'outline-dashed outline-brand-500/60 dark:outline-brand-400/60' : ''}`
            : 'flex items-center justify-center rounded-lg border-2 border-dashed border-brand-500/70 bg-brand-500/5 text-brand-500/80 dark:border-brand-400/70 dark:bg-brand-400/10 dark:text-brand-300/90'
      }`}
      style={{
        left: piece.x,
        top: piece.y,
        width: piece.width,
        height: piece.height,
        transform: piece.rotation ? `rotate(${piece.rotation}deg)` : undefined,
      }}
    >
      {drawn ?? (
        // A kind the art layer does not draw (a Portal, a mode button): its footprint and glyph, as the drag ghost.
        <ShapeGlyph
          kind={kind as ShapeElement['shape']}
          size={Math.max(16, Math.min(piece.width, piece.height) * 0.5)}
          stroke="currentColor"
        />
      )}
    </div>
  );
}
