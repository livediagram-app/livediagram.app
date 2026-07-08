import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from 'react';
import {
  anchorPosition,
  isBoxed,
  selectionMembers,
  type Anchor,
  type ArrowElement,
} from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import { track } from '@/lib/telemetry';
import { withFrameContents, type DragMode, type DragState, type ShapeBounds } from '@/lib/canvas';
import type { EditorDragDeps } from './useEditorDrag.types';

type BoxedDragHandlerDeps = {
  depsRef: RefObject<EditorDragDeps>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  checkpointPendingRef: RefObject<boolean>;
};

// The drag gesture starters for boxed elements: beginDrag (move / resize a
// shape, sticky, table, image, or freehand) and beginAnchorDrag (drag a
// resize / rotate handle). Each snapshots the pressed element off depsRef,
// arms a history checkpoint, and sets the drag state the shared move effect in
// useEditorDrag then advances. Split out of useEditorDrag.
export function useBoxedDragHandlers({
  depsRef,
  setDrag,
  checkpointPendingRef,
}: BoxedDragHandlerDeps) {
  const beginDrag = (elementId: string, mode: DragMode, e: ReactPointerEvent) => {
    const d = depsRef.current;
    // Arrow click-to-connect (spec/09): same "armed source, next click
    // is the action" shape as format-paint / group below. Draws a
    // pinned connector to the clicked shape instead of selecting it.
    if (d.connectSourceId !== null && mode === 'move') {
      d.connectArrowTo(elementId);
      return;
    }
    // Persistent Format tool: first click arms the source, each later
    // click paints onto the target and KEEPS the source armed so the
    // user can format many elements in a row. Checked before the
    // single-shot painter branch below so it owns both phases.
    if (d.formatToolActive && mode === 'move') {
      if (d.formatSourceId === null) d.setFormatSourceId(elementId);
      else d.applyFormatFromSource(elementId, { keepSource: true });
      return;
    }
    if (d.formatSourceId !== null && mode === 'move') {
      d.applyFormatFromSource(elementId);
      return;
    }
    if (d.groupSourceId !== null && mode === 'move') {
      d.completeGrouping(elementId);
      return;
    }
    if (d.editingId === elementId) return;
    const element = d.activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element)) return;
    // A hidden / locked LAYER makes its elements fully inert (spec/74):
    // unlike per-element `locked` (selectable to inspect, below), a
    // press on one doesn't even land a selection.
    if (d.layerInertIds.has(elementId)) return;
    // Drill-in selection (spec/09 groups): if the click lands on a member
    // of the group that is ALREADY selected (via any of its members), the
    // selection narrows to just that member — so one element's settings /
    // position can change without ungrouping. The first click on a group
    // still selects the whole group; a click elsewhere resets the solo.
    const current = d.selectedId
      ? d.activeTab.elements.find((el) => el.id === d.selectedId)
      : undefined;
    const drillIn = !!(
      element.groupId &&
      current &&
      isBoxed(current) &&
      current.groupId === element.groupId
    );
    d.setSoloSelectedId(drillIn ? elementId : null);
    d.setSelectedId(elementId);
    // Selection above still lands so viewers can inspect; the drag
    // itself is blocked for a locked element or a read-only session.
    if (element.locked === true || d.isReadOnly) return;

    // Multi-selection AND group selection both drag in lockstep: for
    // 'move' the whole set translates together, for 'resize-*' the
    // whole set scales together (members reposition + resize
    // proportionally around the corner opposite the drag handle). A
    // bare single-element drag falls through to the singleton set. A
    // drilled-in member drags alone, like any single element.
    const baseIds = d.multiSelectedIds.has(elementId)
      ? d.multiSelectedIds
      : element.groupId && !drillIn
        ? new Set(selectionMembers(d.activeTab.elements, elementId))
        : new Set<string>([elementId]);

    // Frame sections (spec/09): MOVING a frame carries everything inside
    // it. Expand the move set with every boxed element whose centre lies
    // within a frame being moved (pinned arrows between them follow via
    // the rebind pass). Resizing is deliberately excluded — a frame
    // resize re-sizes the section outline and leaves its contents put.
    const ids = mode === 'move' ? withFrameContents(d.activeTab.elements, baseIds) : baseIds;

    const startBounds = new Map<string, ShapeBounds>();
    // Free endpoints of any arrows the frame-section expansion pulled in, so
    // their free ends translate with the section (only relevant for a move).
    const startArrowEnds = new Map<
      string,
      { from?: { x: number; y: number }; to?: { x: number; y: number } }
    >();
    for (const el of d.activeTab.elements) {
      if (!ids.has(el.id)) continue;
      if (isBoxed(el)) {
        startBounds.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
      } else if (el.type === 'arrow') {
        startArrowEnds.set(el.id, {
          from: el.from.kind === 'free' ? { x: el.from.x, y: el.from.y } : undefined,
          to: el.to.kind === 'free' ? { x: el.to.x, y: el.to.y } : undefined,
        });
      }
    }

    // Arm a checkpoint; it is taken on the first real mutation (tick).
    checkpointPendingRef.current = true;
    setDrag({
      kind: 'boxed',
      primaryId: elementId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBounds,
      startArrowEnds,
      aspectLocked: element.aspectLocked === true,
    });
  };

  const beginAnchorDrag = (
    elementId: string,
    anchor: Anchor,
    e: ReactPointerEvent,
    // `fromGroup` (spec/09 group quick-connect): start the arrow PINNED TO
    // THE GROUP's union box (a `pinned-group` endpoint at this side's
    // anchor) instead of an element anchor — the group plus buttons sit on
    // the union bounds, and the arrow must track the group as it moves.
    // `point` is where the endpoint currently resolves (the drag origin);
    // `elementId` still supplies the inherited stroke.
    opts?: {
      clickToPlace?: boolean;
      placeOutPx?: number;
      fromGroup?: { groupId: string; point: { x: number; y: number } };
    },
  ) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null || d.formatToolActive) return;
    const element = d.activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element) || element.locked === true || d.isReadOnly) return;
    if (d.layerInertIds.has(elementId)) return;
    const start = opts?.fromGroup?.point ?? anchorPosition(element, anchor);
    const fromEnd: ArrowElement['from'] = opts?.fromGroup
      ? { kind: 'pinned-group', groupId: opts.fromGroup.groupId, anchor }
      : { kind: 'pinned', elementId, anchor };
    // A connector drawn FROM a shape inherits that shape's stroke so it
    // visually belongs with it — and so it respects whatever theme the
    // shape already carries (the tab's `theme` field can lag a recolour,
    // which is why these arrows were coming out black). Falls back to
    // the tab theme's element stroke, then the built-in arrow default.
    const theme = getTheme(d.activeTab.theme);
    const inheritedStroke = element.strokeColor ?? theme.elementStroke ?? undefined;
    // placeOutPx (mobile Arrow option): don't enter a drag — drop a free
    // arrow that runs straight out from the anchor by that many px and
    // select it so the user can reposition it by hand.
    if (opts?.placeOutPx) {
      const out: Record<Anchor, { x: number; y: number }> = {
        n: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        e: { x: 1, y: 0 },
        w: { x: -1, y: 0 },
        ne: { x: 0.707, y: -0.707 },
        nw: { x: -0.707, y: -0.707 },
        se: { x: 0.707, y: 0.707 },
        sw: { x: -0.707, y: 0.707 },
      };
      const dir = out[anchor];
      const placed: ArrowElement = {
        id: crypto.randomUUID(),
        type: 'arrow',
        from: fromEnd,
        to: {
          kind: 'free',
          x: start.x + dir.x * opts.placeOutPx,
          y: start.y + dir.y * opts.placeOutPx,
        },
        ...(inheritedStroke ? { strokeColor: inheritedStroke } : {}),
      };
      d.commit((els) => [...els, placed]);
      d.setSelectedId(placed.id);
      track('Element', 'Added', 'Arrow');
      return;
    }
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: fromEnd,
      to: { kind: 'free', x: start.x, y: start.y },
      ...(inheritedStroke ? { strokeColor: inheritedStroke } : {}),
    };
    d.commit((els) => [...els, arrow]);
    d.setSelectedId(arrow.id);
    track('Element', 'Added', 'Arrow');
    // The move handler tracks (startCanvas + (client - startClient)). For a
    // press-drag from the anchor handle the pointer IS at the anchor, so
    // e.client is the right origin. A click-to-place from the ring starts
    // far out on the ring button, so anchor that origin to the anchor's
    // own screen position instead (derived from the element's DOM rect) —
    // otherwise the endpoint would trail the cursor by the button offset.
    let startClientX = e.clientX;
    let startClientY = e.clientY;
    if (opts?.clickToPlace && element.width > 0 && element.height > 0) {
      const node = document.querySelector(`[data-element-id="${elementId}"]`);
      if (node) {
        const r = node.getBoundingClientRect();
        startClientX = r.left + ((start.x - element.x) / element.width) * r.width;
        startClientY = r.top + ((start.y - element.y) / element.height) * r.height;
      }
    }
    setDrag({
      kind: 'arrow-endpoint',
      arrowId: arrow.id,
      end: 'to',
      startClientX,
      startClientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
      clickToPlace: opts?.clickToPlace ?? false,
      pressClientX: e.clientX,
      pressClientY: e.clientY,
    });
  };

  return { beginDrag, beginAnchorDrag };
}
