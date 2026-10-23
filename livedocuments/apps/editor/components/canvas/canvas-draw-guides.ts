import {
  alignmentGuides,
  arrowSnapPoints,
  snapToArrowPoint,
  type AlignmentGuide,
  type ArrowElement,
  type Element,
} from '@livedocuments/document';
import { ARROW_SNAP_REVEAL_PX, ARROW_SNAP_THRESHOLD_PX } from '@/lib/canvas';
import type { PendingDraw } from '@/lib/draw-mode';
import { drawnDragBox } from '@/lib/draw-commit';
import type { SnapTarget } from '@/components/canvas/Canvas.types';

type Point = { x: number; y: number };
type DrawRect = { startX: number; startY: number; currentX: number; currentY: number };

// Nothing to exclude when guiding a draw-to-size box: the element doesn't
// exist yet, so every neighbour is a candidate.
const NO_GUIDE_EXCLUDE: Set<string> = new Set();

interface DrawGuideInputs {
  drawDrag: DrawRect | null;
  pendingDraw: PendingDraw | null;
  elements: Element[];
  drawHover: Point | null;
  // Move/resize guides + reposition snap targets the active gesture already
  // produced; the in-progress draw's own guides/snaps are merged on top.
  snapGuides: AlignmentGuide[];
  snapTargets: SnapTarget[];
}

// Merge the active gesture's guides/snap-targets with the ones a draw-to-size
// box / new arrow produces as it's being drawn, so the
// single guide + dot overlay in CanvasChrome reads from one pair of arrays.
// Pure: no DOM, no refs — extracted from CanvasChrome so the geometry can be
// reasoned about (and tested) on its own.
export function computeDrawGuides({
  drawDrag,
  pendingDraw,
  elements,
  drawHover,
  snapGuides,
  snapTargets,
}: DrawGuideInputs): { alignGuides: AlignmentGuide[]; allSnapTargets: SnapTarget[] } {
  // Alignment guides for the in-progress draw-to-size box, so the user
  // sees which neighbour edges / centres it latched onto — the same faint
  // lines a move / resize shows. Box intents only (arrows are a line). drawDrag's start + current are already the
  // SNAPPED points, so alignmentGuides reports a line exactly when a snap
  // is in effect, mirroring the move/resize derivation. Concatenated with
  // the move/resize snapGuides (mutually exclusive in practice) for the
  // single guide overlay below.
  const drawBoxGuides =
    drawDrag && pendingDraw && pendingDraw.type !== 'arrow'
      ? alignmentGuides(
          // The box that will COMMIT, not the raw drag — an embed is fitted
          // to 16:9 inside it (docs/specs/009-elements/youtube-video.md), and guiding off the un-fitted
          // rectangle would promise the user an alignment the element then
          // doesn't have. Same helper the preview + commit use.
          drawnDragBox(
            pendingDraw,
            drawDrag.startX,
            drawDrag.startY,
            drawDrag.currentX,
            drawDrag.currentY,
          ),
          elements,
          NO_GUIDE_EXCLUDE,
        )
      : [];
  // Pre-press start-snap preview: guides for the snapped hover point (a
  // 0×0 candidate), so the user sees the first corner latch before they
  // press. Mutually exclusive with drawBoxGuides (hover is cleared once a
  // drag starts). The snapped dot itself renders below the guide overlay.
  const drawHoverGuides =
    drawHover
      ? alignmentGuides(
          { x: drawHover.x, y: drawHover.y, width: 0, height: 0 },
          elements,
          NO_GUIDE_EXCLUDE,
        )
      : [];
  const alignGuides =
    drawBoxGuides.length > 0 || drawHoverGuides.length > 0
      ? [...snapGuides, ...drawBoxGuides, ...drawHoverGuides]
      : snapGuides;
  // While drawing a NEW arrow near another arrow, reveal that arrow's snap
  // points (docs/specs/008-canvas/arrow-to-arrow.md) — the same dots the reposition drag shows — so the user
  // can line the new endpoint up as they draw, not only after dropping it.
  const drawArrowSnaps: SnapTarget[] = (() => {
    if (!drawDrag || !pendingDraw || pendingDraw.type !== 'arrow') return [];
    const cursor = { x: drawDrag.currentX, y: drawDrag.currentY };
    const hit = snapToArrowPoint(cursor, elements, ARROW_SNAP_REVEAL_PX, '');
    if (!hit) return [];
    const target = elements.find((e) => e.id === hit.arrowId && e.type === 'arrow') as
      ArrowElement | undefined;
    if (!target) return [];
    const snapped = hit.dist <= ARROW_SNAP_THRESHOLD_PX;
    return arrowSnapPoints(target, elements).map((sp) => ({
      x: sp.x,
      y: sp.y,
      active: snapped && Math.abs(sp.t - hit.t) < 1e-6,
    }));
  })();
  // The reposition-drag targets and the draw-time targets never coexist (one
  // gesture at a time), so a simple concat drives the single dot overlay.
  const allSnapTargets =
    drawArrowSnaps.length > 0 ? [...snapTargets, ...drawArrowSnaps] : snapTargets;

  return { alignGuides, allSnapTargets };
}
