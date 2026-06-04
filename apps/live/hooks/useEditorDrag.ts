// Drag state machine for the canvas, lifted out of editor-page.tsx so
// the editor route stays focused on top-level orchestration and the
// drag math can be reasoned about (and tested) on its own. Pure
// behavioural extraction: every dispatcher and the global pointer-
// move / pointer-up effect are unchanged from their previous inline
// shape; only the surrounding closure has changed.
//
// Why a hook (not a lib helper): the drag state IS React state
// (setDrag triggers re-render so the wrapper element renders with the
// right cursor + the resize handles see the live drag), and the
// pointer-move effect attaches global listeners that have to be torn
// down via the effect-cleanup convention. Both are React-shaped, so
// they belong in a hook rather than a pure module.
//
// Why a deps ref: the pointer-move effect's listeners need to read
// `activeTab.elements`, `tick`, `zoomRef`, etc. on every move event,
// but we don't want to re-attach those listeners every render. A ref
// gives the effect a stable hook (one attach per drag start) plus a
// fresh view of the parent state on every fire. The previous inline
// shape used an `// eslint-disable-next-line react-hooks/exhaustive-deps`
// comment for the same reason; the ref is the lint-clean version of
// that pattern.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  anchorPosition,
  angledElbow,
  arrowStyleOf,
  curveControlPoint,
  endpointPosition,
  isBoxed,
  rebindArrowAnchorsAfterMove,
  selectionMembers,
  snapResizeBounds,
  snapToAlignment,
  snapToAnchor,
  type Anchor,
  type ArrowElement,
  type Element,
  type Endpoint,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { getTheme } from '@/lib/themes';
import {
  ALIGN_SNAP_THRESHOLD,
  cornerOf,
  MIN_SIZE,
  nextBounds,
  SNAP_THRESHOLD,
  unionOfBounds,
  unionResizeMember,
  type ArrowEnd,
  type DragMode,
  type DragState,
  type ShapeBounds,
} from '@/lib/canvas';

// External state + callbacks the drag machine reads on every move.
// Bundled into one object so the hook signature doesn't sprout
// positional arguments as more inputs land; tracked via a ref so the
// move-effect doesn't re-attach listeners on every parent render.
type EditorDragDeps = {
  // The tab whose elements are being dragged. We read its elements
  // array on every move and write back through `tick` / `commit`.
  activeTab: Tab;
  // Current viewport zoom, kept in a ref so the move handler can
  // invert it without forcing the effect to re-attach when zoom
  // changes mid-drag.
  zoomRef: React.RefObject<number>;
  // Read-only selection state. Drag never sets selection directly
  // except through the supplied setter (so the parent owns the
  // truth).
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  multiSelectedIds: Set<string>;
  editingId: string | null;
  isReadOnly: boolean;
  // Modal interaction state. When format-painter is active, a click
  // on an element applies the format instead of dragging; when
  // group-source is active, the click completes a grouping. The drag
  // dispatcher checks these and routes appropriately.
  formatSourceId: string | null;
  applyFormatFromSource: (targetId: string) => void;
  groupSourceId: string | null;
  completeGrouping: (targetId: string) => void;
  // Element setters from the editor. `tick` writes elements without
  // taking a history checkpoint (used during the move-effect's
  // 60+/sec updates); `commit` writes elements AND snapshots history
  // (used at drag-begin to create the new arrow when an anchor is
  // pulled). `markCheckpoint` is the snapshot-without-write entry
  // point, used at the start of a boxed move/resize so a single
  // Cmd-Z undoes the whole gesture.
  tick: (mapper: (els: Element[]) => Element[]) => void;
  commit: (mapper: (els: Element[]) => Element[]) => void;
  markCheckpoint: () => void;
  // Per-user preference (spec/20) controlling whether connected
  // arrows re-pin to the most-natural face as a box is dragged.
  // Defaults to true; setting `false` keeps anchors frozen at
  // whatever the user originally chose. Tracked via ref so a
  // mid-drag toggle takes effect on the next pointermove without
  // re-attaching listeners.
  autoRebindArrowsRef: React.RefObject<boolean>;
  // Set to true while a 2-finger pinch is active. The move handler
  // checks this and cancels any in-flight drag so a pinch-to-zoom
  // gesture that starts on an element doesn't also move it.
  isPinchingRef?: React.RefObject<boolean>;
};

type EditorDragApi = {
  drag: DragState | null;
  beginDrag: (elementId: string, mode: DragMode, e: ReactPointerEvent) => void;
  beginAnchorDrag: (elementId: string, anchor: Anchor, e: ReactPointerEvent) => void;
  beginArrowTranslate: (arrowId: string, e: ReactPointerEvent) => void;
  beginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  beginArrowCurveDrag: (arrowId: string, e: ReactPointerEvent) => void;
  beginArrowElbowDrag: (arrowId: string, e: ReactPointerEvent) => void;
};

export function useEditorDrag(deps: EditorDragDeps): EditorDragApi {
  const [drag, setDrag] = useState<DragState | null>(null);

  // Stash deps on every render so the move-effect always reads
  // fresh values without re-subscribing global pointer listeners.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const beginDrag = (elementId: string, mode: DragMode, e: ReactPointerEvent) => {
    const d = depsRef.current;
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
    d.setSelectedId(elementId);
    // Selection above still lands so viewers can inspect; the drag
    // itself is blocked for a locked element or a read-only session.
    if (element.locked === true || d.isReadOnly) return;

    // Multi-selection AND group selection both drag in lockstep: for
    // 'move' the whole set translates together, for 'resize-*' the
    // whole set scales together (members reposition + resize
    // proportionally around the corner opposite the drag handle). A
    // bare single-element drag falls through to the singleton set.
    const ids = d.multiSelectedIds.has(elementId)
      ? d.multiSelectedIds
      : element.groupId
        ? new Set(selectionMembers(d.activeTab.elements, elementId))
        : new Set<string>([elementId]);

    const startBounds = new Map<string, ShapeBounds>();
    for (const el of d.activeTab.elements) {
      if (ids.has(el.id) && isBoxed(el)) {
        startBounds.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
      }
    }

    d.markCheckpoint();
    setDrag({
      kind: 'boxed',
      primaryId: elementId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBounds,
      aspectLocked: element.aspectLocked === true,
    });
  };

  const beginAnchorDrag = (elementId: string, anchor: Anchor, e: ReactPointerEvent) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null) return;
    const element = d.activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element) || element.locked === true || d.isReadOnly) return;
    const start = anchorPosition(element, anchor);
    // New arrows inherit the tab's theme stroke colour so they
    // visually belong with the rest of the diagram. Falls back to
    // the built-in arrow default when the theme has no override
    // (Brand).
    const theme = getTheme(d.activeTab.theme);
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'pinned', elementId, anchor },
      to: { kind: 'free', x: start.x, y: start.y },
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
    };
    d.commit((els) => [...els, arrow]);
    d.setSelectedId(arrow.id);
    track('Element', 'Added', 'Arrow');
    setDrag({
      kind: 'arrow-endpoint',
      arrowId: arrow.id,
      end: 'to',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
    });
  };

  const beginArrowTranslate = (arrowId: string, e: ReactPointerEvent) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null) return;
    const arrow = d.activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return;
    if (arrow.locked === true || d.isReadOnly) return;
    if (arrow.from.kind !== 'free' || arrow.to.kind !== 'free') return;
    d.setSelectedId(arrowId);
    d.markCheckpoint();
    setDrag({
      kind: 'arrow-translate',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startFromX: arrow.from.x,
      startFromY: arrow.from.y,
      startToX: arrow.to.x,
      startToY: arrow.to.y,
    });
  };

  const beginEndpointDrag = (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null) return;
    const arrow = d.activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.isReadOnly) return;
    const start = endpointPosition(end === 'from' ? arrow.from : arrow.to, d.activeTab.elements);
    d.markCheckpoint();
    setDrag({
      kind: 'arrow-endpoint',
      arrowId,
      end,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
    });
  };

  const beginArrowCurveDrag = (arrowId: string, e: ReactPointerEvent) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null) return;
    const arrow = d.activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return;
    if (arrowStyleOf(arrow) !== 'curved') return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const control = curveControlPoint(from, to, arrow.curveOffset);
    d.markCheckpoint();
    setDrag({
      kind: 'arrow-curve',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMidX: (from.x + to.x) / 2,
      startMidY: (from.y + to.y) / 2,
      // The cursor isn't always exactly on the control point at
      // grab time (the SVG handle has a 10px hit area). Storing the
      // cursor-to-control delta lets the move handler keep the
      // handle anchored to where the user originally clicked,
      // matching native drag UX.
      grabDx: control.x - (from.x + to.x) / 2,
      grabDy: control.y - (from.y + to.y) / 2,
    });
  };

  // Elbow-handle drag for angled arrows. Same gesture shape as
  // beginArrowCurveDrag but stores the auto-elbow (the corner the
  // angled-arrow renderer would draw without offset) as the
  // baseline. On move we compute a fresh elbowOffset as
  // `(currentElbow - startBase)`, so the elbow lands wherever the
  // cursor goes and the value is preserved when endpoints later
  // move.
  const beginArrowElbowDrag = (arrowId: string, e: ReactPointerEvent) => {
    const d = depsRef.current;
    if (d.formatSourceId !== null || d.groupSourceId !== null) return;
    const arrow = d.activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return;
    if (arrowStyleOf(arrow) !== 'angled') return;
    d.setSelectedId(arrowId);
    if (arrow.locked === true || d.isReadOnly) return;
    const from = endpointPosition(arrow.from, d.activeTab.elements);
    const to = endpointPosition(arrow.to, d.activeTab.elements);
    const baseElbow = angledElbow(from, to, arrow.from, arrow.to);
    const currentElbow = angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset);
    d.markCheckpoint();
    setDrag({
      kind: 'arrow-elbow',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBaseX: baseElbow.x,
      startBaseY: baseElbow.y,
      // Pointer-to-elbow offset at grab time, same trick as
      // beginArrowCurveDrag so the handle tracks the cursor cleanly.
      grabDx: currentElbow.x - baseElbow.x,
      grabDy: currentElbow.y - baseElbow.y,
    });
  };

  // Global pointer-move / pointer-up listeners. Attached once per
  // drag-start, torn down when the drag ends. Every fire reads
  // through depsRef so an external state change (zoom, selection,
  // active-tab swap) is reflected without re-attaching.
  useEffect(() => {
    if (!drag) return;
    // Cancel the drag immediately when a second touch finger lands — that
    // signals a pinch gesture, not a solo drag.
    const onSecondTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !e.isPrimary) setDrag(null);
    };
    const onMove = (e: PointerEvent) => {
      if (depsRef.current.isPinchingRef?.current) {
        setDrag(null);
        return;
      }
      const { activeTab, zoomRef, tick } = depsRef.current;
      // Screen-pixel delta into canvas-coord delta (invert the
      // current zoom).
      const dx = (e.clientX - drag.startClientX) / zoomRef.current;
      const dy = (e.clientY - drag.startClientY) / zoomRef.current;

      if (drag.kind === 'boxed') {
        if (drag.mode === 'move') {
          // Snap the primary's candidate bounds to align with other
          // elements' edges / centres; apply the same nudge to every
          // group member so they translate together.
          const primaryStart = drag.startBounds.get(drag.primaryId);
          const memberIds = new Set(drag.startBounds.keys());
          let snapDx = 0;
          let snapDy = 0;
          if (primaryStart) {
            const candidate = {
              x: primaryStart.x + dx,
              y: primaryStart.y + dy,
              width: primaryStart.width,
              height: primaryStart.height,
            };
            const snap = snapToAlignment(
              candidate,
              activeTab.elements,
              memberIds,
              ALIGN_SNAP_THRESHOLD,
            );
            snapDx = snap.dx;
            snapDy = snap.dy;
          }
          tick((els) => {
            // First pass: translate every dragged boxed element.
            const moved = els.map((el) => {
              if (!isBoxed(el)) return el;
              const start = drag.startBounds.get(el.id);
              if (!start) return el;
              return { ...el, x: start.x + dx + snapDx, y: start.y + dy + snapDy };
            });
            // Second pass: re-pin connected arrow anchors against
            // the moved positions so an arrow stays visually
            // attached as the user drags. Skipped when the per-
            // user preference (spec/20) is off, in which case
            // anchors stay frozen at whatever the user originally
            // chose. Read through a ref so a mid-drag flip lands
            // on the next pointermove without re-attaching.
            const autoRebind = depsRef.current.autoRebindArrowsRef.current ?? true;
            return autoRebind ? rebindArrowAnchorsAfterMove(moved, drag.startBounds) : moved;
          });
        } else {
          // Resize branch handles BOTH single-element and group /
          // multi resizes uniformly:
          // - Single member: scale the lone member directly via
          //   nextBounds (the original behaviour, snapping included).
          // - Multiple members: compute a UNION start box, scale
          //   that as if it were one element, then map every member
          //   through the same proportional scale around the anchor
          //   (corner opposite the drag handle).
          const corner = cornerOf(drag.mode);
          const memberIds = new Set(drag.startBounds.keys());

          // Shift-held during resize is the standard "constrain
          // aspect" modifier (Figma, Photoshop, Illustrator). It
          // works on top of the per-element aspectLocked toggle: a
          // shape with the toggle off honours the shift; a shape
          // with the toggle on stays locked regardless.
          const constrain = drag.aspectLocked || e.shiftKey;
          if (drag.startBounds.size <= 1) {
            const start = drag.startBounds.get(drag.primaryId);
            if (!start) return;
            const raw = nextBounds(start, drag.mode, dx, dy, constrain);
            const next =
              !constrain && corner
                ? snapResizeBounds(
                    raw,
                    corner,
                    activeTab.elements,
                    memberIds,
                    ALIGN_SNAP_THRESHOLD,
                    MIN_SIZE,
                  )
                : raw;
            tick((els) =>
              els.map((el) => (el.id === drag.primaryId && isBoxed(el) ? { ...el, ...next } : el)),
            );
            return;
          }

          // Multi-member resize: derive union bounds, run them
          // through nextBounds, and scale every member around the
          // anchor (corner opposite the drag handle). Aspect-lock is
          // forced on if ANY member is aspect-locked so locked
          // figures (e.g. the actor) don't get warped by an
          // unevenly-dragged corner. Snap is skipped for multi-
          // resize because the primary's edges aren't load-bearing
          // here: snapping one member's edge would push the whole
          // group around in ways the user didn't ask for.
          const unionStart = unionOfBounds(drag.startBounds.values());
          if (!unionStart || !corner) return;
          const anyAspectLocked = activeTab.elements.some(
            (el) => isBoxed(el) && drag.startBounds.has(el.id) && el.aspectLocked === true,
          );
          // Shift-held forces constrain for multi-resize too, on
          // top of the per-element flags. Any aspect-locked member
          // already forces constrain to avoid warping (e.g. an
          // actor inside the selection) so this just adds the
          // user's modifier-key opt-in for unlocked selections.
          const unionNext = nextBounds(
            unionStart,
            drag.mode,
            dx,
            dy,
            drag.aspectLocked || anyAspectLocked || e.shiftKey,
          );
          tick((els) =>
            els.map((el) => {
              if (!isBoxed(el)) return el;
              const start = drag.startBounds.get(el.id);
              if (!start) return el;
              return { ...el, ...unionResizeMember(start, unionStart, unionNext, corner) };
            }),
          );
        }
        return;
      }

      if (drag.kind === 'arrow-curve') {
        // The control point should sit at `pointer + grab`, where
        // grab is the pointer-to-control delta we captured on
        // gesture start. Translating that into a curveOffset means
        // subtracting the chord midpoint (also captured at start so
        // a concurrent endpoint move doesn't yank the curve).
        const controlX = drag.startMidX + drag.grabDx + dx;
        const controlY = drag.startMidY + drag.grabDy + dy;
        const offsetDx = controlX - drag.startMidX;
        const offsetDy = controlY - drag.startMidY;
        tick((els) =>
          els.map((el) =>
            el.id === drag.arrowId && el.type === 'arrow'
              ? { ...el, curveOffset: { dx: offsetDx, dy: offsetDy } }
              : el,
          ),
        );
        return;
      }

      if (drag.kind === 'arrow-elbow') {
        // Same shape as arrow-curve, but for the angled-arrow elbow
        // handle. The new elbow sits at `pointer + grab` (where
        // grab is the cursor-to-elbow delta at gesture start), and
        // we store it as a delta from the auto-elbow position so
        // the bend survives concurrent endpoint moves the same way
        // the curveOffset does.
        const elbowX = drag.startBaseX + drag.grabDx + dx;
        const elbowY = drag.startBaseY + drag.grabDy + dy;
        const offsetDx = elbowX - drag.startBaseX;
        const offsetDy = elbowY - drag.startBaseY;
        tick((els) =>
          els.map((el) =>
            el.id === drag.arrowId && el.type === 'arrow'
              ? { ...el, elbowOffset: { dx: offsetDx, dy: offsetDy } }
              : el,
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

      // arrow-endpoint: pin to an anchor if the cursor is close,
      // otherwise free + optional 45-degree angle snap from the
      // other endpoint.
      const cursor = { x: drag.startCanvasX + dx, y: drag.startCanvasY + dy };
      tick((els) => {
        // Element anchor wins over angle snap: pinning to another
        // shape is the strongest constraint and the most desirable
        // outcome when both are plausible.
        const anchorSnap = snapToAnchor(cursor, els, SNAP_THRESHOLD);
        let endpoint: Endpoint;
        if (anchorSnap) {
          endpoint = {
            kind: 'pinned',
            elementId: anchorSnap.elementId,
            anchor: anchorSnap.anchor,
          };
        } else {
          // Angle snap: lock the arrow to 45-degree increments from
          // its other endpoint when the cursor is within ~5 degrees
          // of one. Keeps right-angle connectors easy to draw
          // without fighting the cursor at oblique angles.
          const arrow = els.find((e) => e.id === drag.arrowId && e.type === 'arrow') as
            | ArrowElement
            | undefined;
          let resolved = cursor;
          if (arrow) {
            const otherKey = drag.end === 'from' ? 'to' : 'from';
            const other = endpointPosition(arrow[otherKey], els);
            const ax = cursor.x - other.x;
            const ay = cursor.y - other.y;
            const len = Math.hypot(ax, ay);
            if (len > 0) {
              const angle = Math.atan2(ay, ax);
              const STEP = Math.PI / 4;
              const THRESH = (5 * Math.PI) / 180;
              const nearest = Math.round(angle / STEP) * STEP;
              if (Math.abs(angle - nearest) <= THRESH) {
                resolved = {
                  x: other.x + Math.cos(nearest) * len,
                  y: other.y + Math.sin(nearest) * len,
                };
              }
            }
          }
          endpoint = { kind: 'free', x: resolved.x, y: resolved.y };
        }
        return els.map((el) =>
          el.id === drag.arrowId && el.type === 'arrow' ? { ...el, [drag.end]: endpoint } : el,
        );
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerdown', onSecondTouch);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerdown', onSecondTouch);
    };
  }, [drag]);

  return {
    drag,
    beginDrag,
    beginAnchorDrag,
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowElbowDrag,
  };
}
