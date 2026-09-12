'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { AlignmentGuide, DistributionGuide, Element } from '@livediagram/diagram';
import { pointerToCanvas } from '@/lib/canvas';
import { paletteDragSnapAt } from '@/lib/palette-drag-snap';
import { setPaletteDragSnap, usePaletteDragPreview } from '@/lib/palette-drag-preview';

// Alignment guides DURING a palette drag (spec/139) — the single owner of the
// in-flight snap. It tracks the dragover cursor, converts it to canvas coords
// through the transformed wrapper (the same inversion the drop uses, so the
// ghost, the guides and the landed element can't disagree), runs the shared
// snap geometry, and publishes the offset for the ghost + drop to consume.
//
// Why here rather than inside the ghost: the guides need the tab's elements
// and render in the canvas overlay, the ghost is a fixed-position DOM node,
// and the drop happens in a third place — one owner keeps the three honest.
export function usePaletteDragGuides({
  elements,
  viewportZoom,
  wrapperRef,
}: {
  elements: Element[];
  viewportZoom: number;
  wrapperRef: RefObject<HTMLElement | null>;
}): { guides: AlignmentGuide[]; distGuides: DistributionGuide[] } {
  const preview = usePaletteDragPreview();
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const [distGuides, setDistGuides] = useState<DistributionGuide[]>([]);

  useEffect(() => {
    if (!preview) {
      setGuides([]);
      setDistGuides([]);
      setPaletteDragSnap(null);
      return;
    }
    const onDragOver = (e: DragEvent) => {
      const target = e.target as Element2 | null;
      // A drag back over a floating panel is a "changed my mind": no snap,
      // no guides — matching the ghost's own over-panel guard.
      const overPanel = !!target?.closest?.('[data-floating-panel]');
      const overCanvas = !!target?.closest?.('main');
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect || overPanel || !overCanvas) {
        setGuides([]);
        setPaletteDragSnap(null);
        return;
      }
      const { x, y } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
      const snap = paletteDragSnapAt({
        canvasX: x,
        canvasY: y,
        width: preview.width,
        height: preview.height,
        elements,
      });
      setPaletteDragSnap({ dx: snap.dx, dy: snap.dy });
      setGuides(snap.guides);
      setDistGuides(snap.distGuides);
    };
    document.addEventListener('dragover', onDragOver);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      setGuides([]);
      setDistGuides([]);
      setPaletteDragSnap(null);
    };
  }, [preview, elements, viewportZoom, wrapperRef]);

  return { guides, distGuides };
}

// The DOM Element type, aliased so the diagram package's `Element` (the
// domain model) can keep the unqualified name in this file.
type Element2 = globalThis.Element;
