import { alignmentGuides, type AlignmentGuide, type Element } from '@livehuddle/document';
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
  // produced; the in-progress draw's own guides are merged on top.
  snapGuides: AlignmentGuide[];
  snapTargets: SnapTarget[];
}

// Merge the active gesture's guides with the ones a draw-to-size box
// produces as it's being drawn, so the single guide + dot overlay in
// CanvasChrome reads from one pair of arrays. Pure: no DOM, no refs,
// extracted from CanvasChrome so the geometry can be reasoned about (and
// tested) on its own. (The pens' and the arrow's guides left with the
// element engine's part 4, docs/specs/002-project-scope/not-in-livehuddle.md
// "The element engine".)
export function computeDrawGuides({
  drawDrag,
  pendingDraw,
  elements,
  drawHover,
  snapGuides,
  snapTargets,
}: DrawGuideInputs): { alignGuides: AlignmentGuide[]; allSnapTargets: SnapTarget[] } {
  // Alignment guides for the in-progress draw-to-size box, so the user
  // sees which neighbour edges / centres it latched onto: the same faint
  // lines a move / resize shows. drawDrag's start + current are already the
  // SNAPPED points, so alignmentGuides reports a line exactly when a snap
  // is in effect, mirroring the move/resize derivation. Concatenated with
  // the move/resize snapGuides (mutually exclusive in practice) for the
  // single guide overlay.
  const drawBoxGuides =
    drawDrag && pendingDraw
      ? alignmentGuides(
          // The box that will COMMIT, not the raw drag. Same helper the preview + commit use.
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
  // 0x0 candidate), so the user sees the first corner latch before they
  // press. Mutually exclusive with drawBoxGuides (hover is cleared once a
  // drag starts). The snapped dot itself renders below the guide overlay.
  const drawHoverGuides = drawHover
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
  return { alignGuides, allSnapTargets: snapTargets };
}
