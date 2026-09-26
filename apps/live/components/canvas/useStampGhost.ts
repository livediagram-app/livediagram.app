import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { pointerToCanvas } from '@/lib/canvas';
import { setLanePreview } from '@/lib/lane-preview';
import { stampPlacement, stampSizeFor, type StampPlacement } from '@/lib/stamp-placement';

type StampGhostDeps = Pick<
  CanvasProps,
  'pendingDraw' | 'elements' | 'tabKind' | 'tabLayers' | 'viewportZoom'
> & { wrapperRef: RefObject<HTMLDivElement | null> };

// The ghost as the preview draws it: the placement, and the same box in
// SCREEN coords, worked out in the pointer handler that produced it so the
// preview never reads the canvas's position during render.
export type StampGhost = StampPlacement & {
  screen: { x: number; y: number; width: number; height: number };
};

// The ghost of an armed fixed-size note (docs/specs/021-event-storming/event-storming.md Phase 4). While a workshop
// note's tile is armed, a ghost of the note follows the pointer over the
// canvas, snapped to the lanes, and the lane it would take lights. `stampAt`
// is the same placement for the draw gesture to press, drag and drop by, so
// the ghost is exactly what lands. Null for every tile that draws to size.
export function useStampGhost({
  pendingDraw,
  elements,
  tabKind,
  tabLayers,
  viewportZoom,
  wrapperRef,
}: StampGhostDeps): {
  stamp: StampGhost | null;
  stampAt: ((canvasX: number, canvasY: number) => StampPlacement) | null;
  showStamp: (placement: StampPlacement | null) => void;
} {
  const board = { elements, kind: tabKind, layers: tabLayers };
  const size = pendingDraw ? stampSizeFor(pendingDraw, board) : null;
  const width = size?.width;
  const height = size?.height;

  const stampAt = useCallback(
    (canvasX: number, canvasY: number) =>
      stampPlacement(
        canvasX,
        canvasY,
        { width: width!, height: height! },
        { elements, kind: tabKind, layers: tabLayers },
      ),
    [width, height, elements, tabKind, tabLayers],
  );

  const [stamp, setStamp] = useState<StampGhost | null>(null);
  const zoomRef = useRef(viewportZoom);
  useEffect(() => {
    zoomRef.current = viewportZoom;
  });
  const showStamp = useCallback(
    (placement: StampPlacement | null) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const zoom = zoomRef.current;
      setStamp(
        placement && rect
          ? {
              ...placement,
              screen: {
                x: rect.left + placement.bounds.x * zoom,
                y: rect.top + placement.bounds.y * zoom,
                width: placement.bounds.width * zoom,
                height: placement.bounds.height * zoom,
              },
            }
          : null,
      );
      setLanePreview(placement?.lane ?? null);
    },
    [wrapperRef],
  );

  // The listener subscribes once per arm and reads the latest board and zoom
  // through this ref, so a peer's edit or a zoom does not blank the ghost.
  const latest = useRef({ stampAt, viewportZoom });
  useEffect(() => {
    latest.current = { stampAt, viewportZoom };
  });

  const armed = width !== undefined;
  useEffect(() => {
    if (!armed) return;
    const onMove = (e: PointerEvent) => {
      const wrapper = wrapperRef.current;
      const target = e.target as Element | null;
      const overCanvas = !!wrapper && target instanceof Node && wrapper.contains(target);
      const overPanel = !!target?.closest?.('[data-floating-panel]');
      if (!overCanvas || overPanel) {
        showStamp(null);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const { x, y } = pointerToCanvas(e.clientX, e.clientY, rect, latest.current.viewportZoom);
      showStamp(latest.current.stampAt(x, y));
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      showStamp(null);
    };
  }, [armed, showStamp, wrapperRef]);

  return { stamp: armed ? stamp : null, stampAt: armed ? stampAt : null, showStamp };
}
