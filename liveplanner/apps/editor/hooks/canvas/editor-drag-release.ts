// How a drag gesture ends: the pointer-up (land the result, then the release rules: a
// touch tap that places a quick-connect arrow, a shift-chained next arrow, the shift-duplicate
// finalisation, folding an icon into a shape and the rest) and the placing click of a
// click-to-place arrow. Split out of useEditorDrag's listener effect verbatim; built once per
// drag start by attachDragListeners (editor-drag-listeners.ts), never per pointer move.

import {
  acceptsInlineIcon,
  anchorOutward,
  isBoxed,
  nearestElementTowards,
  opposingAnchor,
  withRelationshipHeads,
  type ArrowElement,
} from '@liveplanner/project';
import { track } from '@/lib/telemetry';
import { trackDuplicated } from '@/lib/element-telemetry';
import { isTechIconId } from '@liveworkspace/workbench/lib/tech-icons';
import { iconDropSide } from '@/lib/canvas';
import { elementHostsAtPoint } from '@liveworkspace/workbench/lib/dom-hit-test';
import { applyCollisionAvoidance } from './arrow-avoidance-apply';
import { translateBoxedSelection } from './boxed-drag-resolve';
import { planCardCanvasDropAt } from './plan-card-canvas-drop';
import type { DragListenerContext } from './editor-drag-listeners';

type DragReleaseContext = Pick<
  DragListenerContext,
  | 'drag'
  | 'depsRef'
  | 'setDrag'
  | 'scheduleGuides'
  | 'scheduleSnapTargets'
  | 'checkpointPendingRef'
  | 'dupSwapRef'
  | 'setShiftDupGhostIds'
  | 'virtualTab'
  | 'previewTick'
  | 'commitPreview'
> & {
  // The listener effect's own flush of a pending (rAF-coalesced) pointer move.
  flushMove: () => void;
  cancelDrag: () => void;
};

export function createDragRelease({
  drag,
  depsRef,
  setDrag,
  scheduleGuides,
  scheduleSnapTargets,
  checkpointPendingRef,
  dupSwapRef,
  setShiftDupGhostIds,
  virtualTab,
  previewTick,
  commitPreview,
  flushMove,
  cancelDrag,
}: DragReleaseContext) {
  // Shift-chaining (docs/specs/008-canvas/canvas-and-palette.md quick-connect): landing a NEW arrow's endpoint
  // with Shift held immediately starts ANOTHER arrow from the same source
  // end, endpoint following the cursor — a hub fans out to several targets
  // in one flow without reopening the ring. Only for freshly drawn arrows
  // (never a reposition of an existing endpoint) whose source is pinned.
  // Returns true when the chain took over the gesture.
  const chainNextArrow = (e: PointerEvent): boolean => {
    if (!e.shiftKey) return false;
    if (drag?.kind !== 'arrow-endpoint' || drag.end !== 'to' || drag.reposition) return false;
    const d = depsRef.current;
    if (d.isReadOnly) return false;
    const placed = d.activeTab.elements.find(
      (el): el is ArrowElement => el.id === drag.arrowId && el.type === 'arrow',
    );
    if (!placed || placed.from.kind !== 'pinned') return false;
    const cursor = {
      x: drag.startCanvasX + (e.clientX - drag.startClientX) / d.zoomRef.current,
      y: drag.startCanvasY + (e.clientY - drag.startClientY) / d.zoomRef.current,
    };
    const arrow: ArrowElement = d.styleNewElement({
      id: crypto.randomUUID(),
      type: 'arrow',
      from: placed.from,
      to: { kind: 'free', x: cursor.x, y: cursor.y },
      ...(placed.strokeColor ? { strokeColor: placed.strokeColor } : {}),
    });
    d.commit((els) => [...els, arrow]);
    d.setSelectedId(arrow.id);
    track('Element', 'Added', 'Arrow');
    setDrag({
      kind: 'arrow-endpoint',
      arrowId: arrow.id,
      end: 'to',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: cursor.x,
      startCanvasY: cursor.y,
      following: true,
    });
    return true;
  };
  const onUp = (e: PointerEvent) => {
    // Land on the final pointer position even if it arrived in the same
    // frame as a pending rAF (which the cleanup below cancels). Without
    // this a fast release drops up to one frame of movement, so the element
    // finishes a few pixels behind the cursor.
    flushMove();
    // Quick-connect arrow "click to place": if the arrow was started by a
    // click (clickToPlace) and this release ends a gesture that never
    // really moved, don't commit — flip into `following` so the endpoint
    // trails the cursor and the NEXT click (handled in capture below)
    // places it. A real press-drag (moved past the threshold) falls
    // through and commits like any anchor drag.
    if (drag?.kind === 'arrow-endpoint' && drag.clickToPlace && !drag.following) {
      const px = drag.pressClientX ?? drag.startClientX;
      const py = drag.pressClientY ?? drag.startClientY;
      const moved = Math.hypot(e.clientX - px, e.clientY - py) > 6;
      if (!moved) {
        setDrag({ ...drag, clickToPlace: false, following: true });
        return;
      }
    }
    // Follow mode rides THROUGH pointer-ups: after a shift-chained
    // placing click, the release of that same click arrives here with the
    // fresh arrow already following — committing now would land it where
    // it spawned. The gesture ends at the NEXT placing click, not on up.
    if (drag?.kind === 'arrow-endpoint' && drag.following) return;
    // A freshly DRAWN arrow (never a reposition) gets the one-shot collision-avoiding bow
    // (docs/specs/008-canvas/arrow-collision-avoidance.md) as its gesture ends, folded into the
    // gesture's result so the two land as the one write. Written afterwards through `commit`, it
    // started from the project as last rendered, before the result had landed, and put the
    // arrow's end back where the drag began. A touch tap that never moved places its end below
    // instead, as it always has, with no bow.
    const tapStill =
      drag?.kind === 'arrow-endpoint' &&
      !!drag.tapPlace &&
      !drag.following &&
      Math.hypot(
        e.clientX - (drag.pressClientX ?? drag.startClientX),
        e.clientY - (drag.pressClientY ?? drag.startClientY),
      ) <= 6;
    if (drag?.kind === 'arrow-endpoint' && drag.end === 'to' && !drag.reposition && !tapStill) {
      const arrowId = drag.arrowId;
      previewTick((els) => applyCollisionAvoidance(els, arrowId, depsRef.current.activeTab.finish));
    }
    // An arrow a drag has joined to two entities, with no head of its own, becomes a relationship as it
    // is released: crow's-foot ends, the many end on a foreign key (docs/specs/009-elements/entity.md
    // "Cardinality ends"). Folded into the gesture's result like the bow above.
    if (drag?.kind === 'arrow-endpoint' && !tapStill) {
      const arrowId = drag.arrowId;
      previewTick((els) => withRelationshipHeads(els, arrowId));
    }
    // The gesture's result, as the release logic below reads it, then written in one change before
    // anything else writes (docs/specs/008-canvas/drag-preview.md).
    const released = virtualTab();
    // A Plan card released over a board's column files its item there (docs/specs/026-plan/plan-board.md
    // "Working on a board"). Asked before the preview lands: a refused drop cancels the gesture, so the card
    // goes back to where the drag started with no undo step left behind (docs/specs/026-plan/item-types.md).
    const onPlanDrop = depsRef.current.onPlanCardDroppedOnBoard;
    const planDrop =
      drag?.kind === 'boxed' && drag.mode === 'move' && onPlanDrop
        ? planCardCanvasDropAt(
            released.elements,
            drag.primaryId,
            { x: drag.startClientX, y: drag.startClientY },
            e.clientX,
            e.clientY,
          )
        : null;
    if (planDrop && onPlanDrop?.(planDrop.card, planDrop.status, planDrop.boardId) === 'refused') {
      cancelDrag();
      return;
    }
    commitPreview();
    const d = { ...depsRef.current, activeTab: released };
    // Touch quick-connect tap (docs/specs/008-canvas/canvas-and-palette.md): the gesture entered a real drag so
    // a finger CAN drag to a target, but this release never moved. Attach
    // the far end to whatever sits on that side, or fall back to the short
    // free stub when there's nothing there — either way the user gets a
    // usable arrow from one tap instead of a stub they must then place by
    // hand on the device least suited to it.
    if (drag?.kind === 'arrow-endpoint' && drag.tapPlace && !drag.following) {
      const px = drag.pressClientX ?? drag.startClientX;
      const py = drag.pressClientY ?? drag.startClientY;
      if (Math.hypot(e.clientX - px, e.clientY - py) <= 6) {
        const { anchor, sourceId, placeOutPx } = drag.tapPlace;
        const arrowId = drag.arrowId;
        const source = d.activeTab.elements.find((el) => el.id === sourceId);
        const target =
          source && isBoxed(source)
            ? nearestElementTowards(d.activeTab.elements, source, anchor)
            : null;
        // Out of the anchor, for placing a tapped quick-connect arrow's free end
        // when there's nothing on that side to attach to.
        const out = anchorOutward(anchor);
        d.commit((els) =>
          els.map((el) =>
            el.id !== arrowId || el.type !== 'arrow'
              ? el
              : {
                  ...el,
                  to:
                    target && (anchor === 'n' || anchor === 's' || anchor === 'e' || anchor === 'w')
                      ? { kind: 'pinned', elementId: target.id, anchor: opposingAnchor(anchor) }
                      : {
                          kind: 'free',
                          x: drag.startCanvasX + out.x * placeOutPx,
                          y: drag.startCanvasY + out.y * placeOutPx,
                        },
                },
          ),
        );
        setDrag(null);
        scheduleGuides([]);
        scheduleSnapTargets([]);
        return;
      }
    }
    // Shift-release of a press-drag chains the next arrow (same rule as
    // the placing click below). The landed endpoint is already committed
    // by the drag ticks; close this gesture's bookkeeping and follow on.
    if (drag?.kind === 'arrow-endpoint' && !drag.following && chainNextArrow(e)) {
      scheduleGuides([]);
      scheduleSnapTargets([]);
      checkpointPendingRef.current = false;
      return;
    }
    // Shift-duplicate finalisation (docs/specs/008-canvas/shift-drag-duplicate.md). The identity swap already
    // happened during the move (originals parked with their arrows, a
    // clone set on the cursor); this either keeps the clones at the drop
    // point (a real shift-drop — they stay selected) or dissolves them
    // and finishes as a plain move of the originals (no displacement, or
    // Shift released exactly at the up with no intervening move event).
    // All inside the gesture's single undo step.
    if (drag?.kind === 'boxed' && drag.mode === 'move' && dupSwapRef.current) {
      const swap = dupSwapRef.current;
      dupSwapRef.current = null;
      setShiftDupGhostIds(null);
      const start = drag.startBounds.get(drag.primaryId);
      const current = d.activeTab.elements.find((el) => el.id === drag.primaryId);
      const movedAway =
        !!start &&
        !!current &&
        isBoxed(current) &&
        (current.x !== start.x || current.y !== start.y);
      if (movedAway && e.shiftKey) {
        // Resolve the clones off the live tab so the per-element Added
        // events report what actually landed, not what was cloned at
        // press time (docs/specs/017-telemetry/telemetry.md).
        trackDuplicated(
          d.activeTab.elements.filter((el) => swap.cloneIds.has(el.id)),
          'ShiftDrag',
        );
      } else {
        // Dissolve: remove the clones and land the ORIGINALS at the
        // release point, so a shift-up at the last moment still reads
        // as the plain move the user sees.
        const dropDx = (e.clientX - drag.startClientX) / d.zoomRef.current;
        const dropDy = (e.clientY - drag.startClientY) / d.zoomRef.current;
        d.tick((els) => {
          const withoutClones = els.filter((el) => !swap.cloneIds.has(el.id));
          return translateBoxedSelection(
            withoutClones,
            swap.orig.startBounds,
            swap.orig.startArrowEnds,
            movedAway ? dropDx : 0,
            movedAway ? dropDy : 0,
          );
        });
        d.setSelectedId(swap.origSelectedId);
        d.setMultiSelectedIds(swap.origMultiIds);
      }
    }
    // Fold a dragged standalone icon shape into the shape it was
    // released over. Only on a real move (not a click), only when the
    // dragged element is a line-art 'icon' shape, and only when the
    // element directly beneath the cursor (skipping the dragged icon
    // itself) is a non-icon shape. Technology icons (docs/specs/010-palette/technology-icons.md) reuse the
    // 'icon' shape but are ALWAYS standalone — a coloured brand tile
    // folded beside a shape's text isn't meaningful and the inline-icon
    // renderer only knows line-art prims — so they're excluded here.
    if (drag?.kind === 'boxed' && drag.mode === 'move' && d.onIconElementDroppedOnShape) {
      const moved = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) > 4;
      const dragged = d.activeTab.elements.find((el) => el.id === drag.primaryId);
      if (moved && dragged && dragged.type === 'shape' && dragged.shape === 'icon') {
        for (const { id, host } of elementHostsAtPoint(e.clientX, e.clientY)) {
          if (id === drag.primaryId) continue;
          // First real element beneath the icon. Fold in only if it's a
          // shape that hosts inline icons (regular shapes — not an icon or
          // a frame); otherwise leave the icon as a plain move, so an icon
          // dropped on a frame lands inside it as a standalone element.
          const target = d.activeTab.elements.find((el) => el.id === id);
          // The fold writes through the gesture (tick). A drag that moved nothing (the snap put
          // the icon back where it started) committed no preview and so marked no checkpoint:
          // mark it as the fold lands, so the fold is its own undo step rather than joining the
          // last one.
          const fold = (position: 'left' | 'right' | 'above' | 'below') => {
            if (checkpointPendingRef.current) {
              d.markCheckpoint();
              checkpointPendingRef.current = false;
            }
            d.onIconElementDroppedOnShape?.(drag.primaryId, id, position);
          };
          // Onto another icon: the dragged icon replaces it, keeping its box, place and style
          // (docs/specs/008-canvas/canvas-and-palette.md "Swapping an icon"); any icon, a tech mark too.
          if (target?.type === 'shape' && target.shape === 'icon') {
            fold('left');
          } else if (target && acceptsInlineIcon(target) && !isTechIconId(dragged.iconId)) {
            const rect = host.getBoundingClientRect();
            const position = iconDropSide(e.clientX, e.clientY, rect);
            fold(position);
          }
          break;
        }
      }
    }
    // Annotations open their note on DOUBLE-click now (handled in
    // BoxedElementView), so a plain click just selects — no note-open here.
    setDrag(null);
    scheduleGuides([]);
    scheduleSnapTargets([]);
    // Disarm any checkpoint the gesture never used (a click that
    // selected without moving), so it can't attach to a later one.
    checkpointPendingRef.current = false;
  };
  // Quick-connect arrow follow mode: the placing click. Captured on the
  // way DOWN (capture phase) so it commits the endpoint and is swallowed
  // before the canvas can read it as a marquee / deselect.
  const onPlaceClick = (e: PointerEvent) => {
    if (!(drag?.kind === 'arrow-endpoint' && drag.following)) return;
    e.preventDefault();
    e.stopPropagation();
    // Land the last pointermove first, as onUp does: it can still be
    // waiting on the next frame, and the cleanup that ending the gesture
    // triggers would cancel it, leaving the endpoint a frame behind (and
    // unsnapped from the element under the cursor).
    flushMove();
    // The landed arrow gets the one-shot collision-avoiding bow
    // (docs/specs/008-canvas/arrow-collision-avoidance.md), folded into the result before it is
    // written, as the press-drag end in onUp above does.
    if (drag.end === 'to' && !drag.reposition) {
      const arrowId = drag.arrowId;
      previewTick((els) => applyCollisionAvoidance(els, arrowId, depsRef.current.activeTab.finish));
    }
    // Joined to two entities: a relationship, as in onUp above (docs/specs/009-elements/entity.md).
    {
      const arrowId = drag.arrowId;
      previewTick((els) => withRelationshipHeads(els, arrowId));
    }
    commitPreview();
    // The endpoint already tracks the cursor (last pointermove); this
    // click just lands it. Shift chains straight into the next arrow
    // from the same source (docs/specs/008-canvas/canvas-and-palette.md); otherwise clear and end.
    if (chainNextArrow(e)) {
      scheduleGuides([]);
      scheduleSnapTargets([]);
      return;
    }
    setDrag(null);
    scheduleGuides([]);
    scheduleSnapTargets([]);
  };
  return { onUp, onPlaceClick };
}
