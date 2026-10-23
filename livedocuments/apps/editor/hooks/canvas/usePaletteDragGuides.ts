'use client';

import { useLatest } from '@/hooks/ui/useLatest';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AlignmentGuide, DistributionGuide, Element } from '@livedocuments/document';
import { pointerToCanvas } from '@/lib/canvas';
import { paletteDragSnapAt } from '@/lib/palette-drag-snap';
import { setPaletteDragSnap, usePaletteDragPreview } from '@/lib/palette-drag-preview';

// Alignment guides DURING a palette drag (docs/specs/010-palette/palette-drag-ghost.md) — the single owner of the
// in-flight snap. It tracks the dragover cursor, converts it to canvas coords
// through the transformed wrapper (the same inversion the drop uses, so the
// ghost, the guides and the landed element can't disagree), runs the shared
// snap geometry, and publishes the offset for the ghost + drop to consume.
//
// Why here rather than inside the ghost: the guides need the tab's elements
// and render in the canvas overlay, the ghost is a fixed-position DOM node,
// and the drop happens in a third place — one owner keeps the three honest.
// Stable empties, and set through a functional update, so "no guides" never
// counts as a change: the effect re-runs whenever its inputs' identities move
// (a caller minting a fresh Set per render is enough), and a fresh [] each
// time would re-render, re-run, re-clear — forever.
const NO_GUIDES: AlignmentGuide[] = [];
const NO_DIST_GUIDES: DistributionGuide[] = [];
const emptied = <T>(current: T[]): T[] => current;

export function usePaletteDragGuides({
  elements,
  readZoom,
  wrapperRef,
}: {
  elements: Element[];
  // The zoom now, read on each dragover (docs/specs/008-canvas/blueprints/viewport-store.md).
  readZoom: () => number;
  wrapperRef: RefObject<HTMLElement | null>;
}): { guides: AlignmentGuide[]; distGuides: DistributionGuide[] } {
  const preview = usePaletteDragPreview();
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [distGuides, setDistGuides] = useState<DistributionGuide[]>([]);
  // The board, read at EVENT time rather than captured per render. Keeping it
  // out of the effect's deps means publishing a guide can't tear down the
  // listener that published it (a caller minting a fresh Set or element array
  // per render would otherwise resubscribe on every state change, wiping the
  // in-flight snap with it) — and a peer's mid-drag edit is still
  // seen, because the handler reads the ref.
  const board = useRef({ elements });
  // The zoom reader, through the latest-value ref: the drag's listeners never re-attach for it.
  const zoomOf = useLatest(readZoom);
  useEffect(() => {
    board.current = { elements };
  });

  useEffect(() => {
    const clearGuides = () => {
      setGuides((g) => (g.length === 0 ? emptied(g) : NO_GUIDES));
      setDistGuides((g) => (g.length === 0 ? emptied(g) : NO_DIST_GUIDES));
    };
    if (!preview) {
      clearGuides();
      setPaletteDragSnap(null);
      return;
    }
    const clear = () => {
      clearGuides();
      setPaletteDragSnap(null);
    };
    const onDragOver = (e: DragEvent) => {
      const target = e.target as Element2 | null;
      // A drag back over a floating panel is a "changed my mind": no snap,
      // no guides — matching the ghost's own over-panel guard.
      const overPanel = !!target?.closest?.('[data-floating-panel]');
      const overCanvas = !!target?.closest?.('main');
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect || overPanel || !overCanvas) {
        clear();
        return;
      }
      const { x, y } = pointerToCanvas(e.clientX, e.clientY, rect, zoomOf.current());
      const { elements: live } = board.current;
      const snap = paletteDragSnapAt({
        canvasX: x,
        canvasY: y,
        width: preview.width,
        height: preview.height,
        elements: live,
      });
      setPaletteDragSnap({ dx: snap.dx, dy: snap.dy });
      setGuides(snap.guides);
      setDistGuides(snap.distGuides);
    };
    // Leaving the WINDOW (no relatedTarget) would otherwise strand the last
    // preview: dragover stops firing, so the board would sit open until the
    // cursor came back.
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) clear();
    };
    // Escape cancels the drag in most engines (which fires dragend, and the
    // tile clears the preview) — but not in all, and the board must never be
    // left holding guides the user has abandoned.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('keydown', onKeyDown);
      clearGuides();
      setPaletteDragSnap(null);
    };
  }, [preview, zoomOf, wrapperRef]);

  return { guides, distGuides };
}

// The DOM Element type, aliased so the document package's `Element` (the
// domain model) can keep the unqualified name in this file.
type Element2 = globalThis.Element;
