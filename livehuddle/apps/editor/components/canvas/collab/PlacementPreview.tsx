'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
  applyShapeVariant,
  createShape,
  dropsAtOwnSize,
  defaultFillColor,
  defaultStrokeColor,
  isPlacedShape,
  snapDoorToWall,
  turnPiece,
  turnsWithFacing,
  type ChairFacing,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { overFloatingPanel } from '@liveworkspace/workbench/lib/canvas-pointer';
import { pointerToCanvas } from '@/lib/canvas';
import { usePaletteDragPreview, usePaletteDragSnap } from '@/lib/palette-drag-preview';
import { armedRoomSnap } from '@/lib/palette-drag-snap';
import type { PendingDraw } from '@/lib/draw-mode';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { PieceArt, hasPieceArt } from '@/components/canvas/PieceArt';
import { ShapeGlyph } from '@/components/primitives/shape-icon';
import { usePlacingFacing } from '@/lib/placing-facing';
import { usePlacingTurnKeys } from '@/hooks/canvas/usePlacingTurnKeys';

// Where a placed piece would land with the pointer at canvas point `at`: at its own size (its preset's, `variant`),
// centred on the point (as a click or a drop places one). A Door then snaps onto the nearest wall, as its click and
// drop do (docs/specs/009-elements/room-builder.md "Door").
// A piece that turns lands at the facing Space gave it (docs/specs/009-elements/furniture-facing.md "Turning while
// placing"), its box the turned drawing's.
export function placementLanding(
  kind: string,
  at: { x: number; y: number },
  elements: readonly Element[],
  variant?: string,
  facing?: ChairFacing,
): { piece: ShapeElement; onWall: boolean } {
  const base = placedPiece(kind, variant, facing);
  const free = { ...base, x: at.x - base.width / 2, y: at.y - base.height / 2 };
  if (kind !== 'door') return { piece: free, onWall: false };
  const door = snapDoorToWall(free, elements);
  return { piece: door, onWall: door !== free };
}

// A new piece of a kind at the origin, turned to `facing` when it turns.
function placedPiece(kind: string, variant?: string, facing?: ChairFacing): ShapeElement {
  const piece = applyShapeVariant(createShape(kind as ShapeElement['shape'], 0, 0), variant);
  return facing && turnsWithFacing(kind) ? turnPiece(piece, facing) : piece;
}

// Whether adding a kind previews the piece itself (docs/specs/010-palette/palette-drag-ghost.md "Placed pieces preview
// themselves"): every placed kind, and every sized kind the art layer draws (a Room, a Stage, Grass), which a tap or a
// drop lands at its default size. Text, stickies and the generic shapes keep the dashed footprint and the draw box.
export function previewsItself(kind: string): boolean {
  return isPlacedShape(kind) || hasPieceArt(kind);
}

// The kind being added that previews itself, or null: its tile armed for a click, or dragged from the palette. A sized
// kind's armed preview steps aside while a press-and-drag draws its box (`drawing`), so the piece never shows twice; a
// kind that drops at its own size (a placed piece, a Room) draws no box, so it keeps previewing.
export function placingKind(
  pendingDraw: PendingDraw | null,
  draggedKind: string | null,
  drawing = false,
) {
  if (
    pendingDraw?.type === 'shape' &&
    previewsItself(pendingDraw.kind) &&
    !(drawing && !dropsAtOwnSize(pendingDraw.kind))
  )
    return pendingDraw.kind;
  return draggedKind && previewsItself(draggedKind) ? draggedKind : null;
}

// The placement preview (docs/specs/010-palette/palette-drag-ghost.md "Placed pieces preview themselves"): the piece
// itself (a placed one, or a sized one with art at its default size), translucent, under the pointer, where a click
// or a drop would put it. Drawn inside the canvas's
// transformed layer, so it pans, zooms and turns with the content; it listens to the pointer only while such a
// piece is being added, and moves at most once a frame.
export function PlacementPreview({
  pendingDraw,
  elements,
  wrapperRef,
  zoom,
  drawing = false,
}: {
  pendingDraw: PendingDraw | null;
  elements: readonly Element[];
  wrapperRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  // A press-and-drag is drawing a box (a sized kind's armed preview steps aside for it).
  drawing?: boolean;
}) {
  const dragged = usePaletteDragPreview();
  const kind = placingKind(pendingDraw, dragged?.kind ?? null, drawing);
  // A drag lands where the alignment snap says, as the ghost and the drop do.
  const snap = usePaletteDragSnap();
  const dragging = !!dragged && dragged.kind === kind;
  // The preset being placed (a Boardroom, a Sliding Door, a Runner): the armed tile's, else the dragged one's.
  const variant =
    pendingDraw?.type === 'shape' && pendingDraw.kind === kind
      ? pendingDraw.variant
      : dragging
        ? dragged.variant
        : undefined;
  const surface = useCanvasSurface();
  // Space turns the piece while it is placed (usePlacingTurnKeys), and the preview draws it turned.
  usePlacingTurnKeys(kind);
  const facing = usePlacingFacing(kind);
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
    const piece = placedPiece(kind, variant, facing);
    return (
      <PieceArt
        element={piece}
        stroke={defaultStrokeColor(piece, surface)}
        fill={defaultFillColor(piece, surface)}
      />
    );
  }, [kind, variant, surface, facing]);

  if (!kind || !at) return null;
  // An armed Room snaps to its neighbours as a dragged one does, wall to wall included (docs/specs/009-elements/
  // office.md "Rooms line up"); the tap commits through the same function, so it lands where it shows.
  const roomSnap = kind === 'room' && !dragging ? armedRoomSnap(at, elements) : null;
  const point = roomSnap
    ? { x: at.x + roomSnap.dx, y: at.y + roomSnap.dy }
    : dragging && snap
      ? { x: at.x + snap.dx, y: at.y + snap.dy }
      : at;
  const { piece, onWall } = placementLanding(kind, point, elements, variant, facing);
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
  const guides = roomSnap?.guides.map((g, i) => (
    <div
      key={i}
      aria-hidden
      data-testid="placement-guide"
      className="pointer-events-none absolute bg-brand-500 dark:bg-brand-400"
      style={
        g.axis === 'x'
          ? { left: g.position, top: g.start, width: 1 / zoom, height: g.end - g.start }
          : { left: g.start, top: g.position, width: g.end - g.start, height: 1 / zoom }
      }
    />
  ));
  const previewBox = (
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
  return guides?.length ? (
    <>
      {guides}
      {previewBox}
    </>
  ) : (
    previewBox
  );
}
