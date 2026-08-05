// Applies one pointer-move tick of an ARROW-handle drag (spec/09, spec/50).
//
// The five arrow drag kinds — curve, elbow, label, translate, endpoint —
// are siblings: each takes the gesture's canvas-space delta, asks a
// `resolve*` helper for the new geometry, and writes it back through a
// single element mapper. Their bodies lived inline in `useEditorDrag`'s
// pointer-move listener, five branches deep inside a ~700-line effect,
// where the only thing separating arrow geometry from boxed move/resize
// bookkeeping was a `return`.
//
// Extracted so the arrow half of a move tick reads on its own. This is a
// behavioural no-op: the branch order, the guide gating (curve/elbow gate
// `scheduleGuides` on the alignment-guides preference themselves; endpoint
// hands the preference to its resolver and schedules whatever comes back),
// and endpoint-as-fall-through are all preserved exactly.
//
// Not a hook: no React state, no listeners — just the delta in, a mapper
// out through the caller's `tick`. Its callers own the checkpoint/log
// semantics that `tick` carries, and the once-per-gesture guard behind
// `onArrowConnected`.

import type { DragState } from '@/lib/canvas';
import type { SnapTarget } from '@/components/canvas/Canvas.types';
import type { AlignmentGuide, DistributionGuide, Element } from '@livediagram/diagram';
import { resolveArrowEndpointDrag } from './arrow-endpoint-resolve';
import { resolveArrowControlFrame, resolveArrowLabelFrame } from './arrow-control-resolve';

// Every arrow drag kind. `boxed` is handled before this module is reached,
// so the caller has already narrowed it away.
export type ArrowDragState = Exclude<DragState, { kind: 'boxed' }>;

export type ArrowDragMoveArgs = {
  drag: ArrowDragState;
  // Canvas-space delta since the gesture started (screen pixels already
  // divided by the live zoom).
  dx: number;
  dy: number;
  // Cmd / Ctrl held: place freely, skipping the endpoint snap ladder.
  noSnap: boolean;
  // Mutable rather than readonly to match the `resolve*` helpers' existing
  // signatures; nothing here writes to it.
  elements: Element[];
  // The alignment-guides preference (spec/60). Off means no guide lines.
  guidesOn: boolean;
  tick: (mapper: (els: Element[]) => Element[]) => void;
  scheduleGuides: (align: AlignmentGuide[], dist?: DistributionGuide[]) => void;
  scheduleSnapTargets: (targets: SnapTarget[]) => void;
  // Fired when an endpoint lands on another arrow. The caller guards this
  // to once per gesture — it's a telemetry event, not a per-tick signal.
  onArrowConnected: () => void;
};

export function applyArrowDragMove(args: ArrowDragMoveArgs): void {
  const {
    drag,
    dx,
    dy,
    noSnap,
    elements,
    guidesOn,
    tick,
    scheduleGuides,
    scheduleSnapTargets,
    onArrowConnected,
  } = args;

  if (drag.kind === 'arrow-curve') {
    // Snap + offset math live in resolveArrowControlFrame; the base
    // is the chord midpoint captured at gesture start.
    const pointIndex = drag.pointIndex;
    const { offsetDx, offsetDy, guides } = resolveArrowControlFrame({
      els: elements,
      arrowId: drag.arrowId,
      baseX: drag.startMidX,
      baseY: drag.startMidY,
      grabDx: drag.grabDx,
      grabDy: drag.grabDy,
      dx,
      dy,
      pointIndex,
    });
    scheduleGuides(guidesOn ? guides : []);
    tick((els) =>
      els.map((el) => {
        if (el.id !== drag.arrowId || el.type !== 'arrow') return el;
        // Multi-bend: write the dragged control point's slot; otherwise
        // the legacy single bow.
        if (pointIndex != null && el.curvePoints) {
          const next = el.curvePoints.slice();
          if (!next[pointIndex]) return el;
          next[pointIndex] = { dx: offsetDx, dy: offsetDy };
          return { ...el, curvePoints: next };
        }
        return { ...el, curveOffset: { dx: offsetDx, dy: offsetDy } };
      }),
    );
    return;
  }

  if (drag.kind === 'arrow-elbow') {
    // Same shape as arrow-curve, but based at the auto-elbow
    // position captured at gesture start.
    const { offsetDx, offsetDy, guides } = resolveArrowControlFrame({
      els: elements,
      arrowId: drag.arrowId,
      baseX: drag.startBaseX,
      baseY: drag.startBaseY,
      grabDx: drag.grabDx,
      grabDy: drag.grabDy,
      dx,
      dy,
      pointIndex: null,
    });
    scheduleGuides(guidesOn ? guides : []);
    tick((els) =>
      els.map((el) =>
        el.id === drag.arrowId && el.type === 'arrow'
          ? { ...el, elbowOffset: { dx: offsetDx, dy: offsetDy } }
          : el,
      ),
    );
    return;
  }

  if (drag.kind === 'arrow-label') {
    // Projection lives in resolveArrowLabelFrame; null = arrow gone.
    const labelOffset = resolveArrowLabelFrame({
      els: elements,
      arrowId: drag.arrowId,
      startAnchorX: drag.startAnchorX,
      startAnchorY: drag.startAnchorY,
      dx,
      dy,
    });
    if (!labelOffset) return;
    tick((els) =>
      els.map((el) =>
        el.id === drag.arrowId && el.type === 'arrow' ? { ...el, labelOffset } : el,
      ),
    );
    return;
  }

  if (drag.kind === 'arrow-translate') {
    // Shift both free endpoints by the same canvas delta from
    // their captured start positions. No anchor / angle snap:
    // the user explicitly chose a fully-floating arrow.
    tick((els) =>
      els.map((el) => {
        if (el.id !== drag.arrowId || el.type !== 'arrow') return el;
        return {
          ...el,
          from: { kind: 'free', x: drag.startFromX + dx, y: drag.startFromY + dy },
          to: { kind: 'free', x: drag.startToX + dx, y: drag.startToY + dy },
        };
      }),
    );
    return;
  }

  // arrow-endpoint: the snap ladder (element anchor > arrow line >
  // angle lock + alignment) lives in resolveArrowEndpointDrag; this
  // handler just feeds it the frame and applies the result.
  const cursor = { x: drag.startCanvasX + dx, y: drag.startCanvasY + dy };
  const { endpoint, guides, snapTargets, arrowConnected } = resolveArrowEndpointDrag({
    cursor,
    elements,
    arrowId: drag.arrowId,
    end: drag.end,
    reposition: drag.reposition === true,
    noSnap,
    guidesOn,
  });
  scheduleSnapTargets(snapTargets);
  scheduleGuides(guides);
  if (arrowConnected) onArrowConnected();
  tick((els) =>
    els.map((el) =>
      el.id === drag.arrowId && el.type === 'arrow' ? { ...el, [drag.end]: endpoint } : el,
    ),
  );
}
