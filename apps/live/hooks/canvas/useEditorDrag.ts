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
// fresh view of the parent state on every fire.

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  acceptsInlineIcon,
  anchorOutward,
  ES_LANES,
  isEventStormingNote,
  isBoxed,
  nearestElementTowards,
  opposingAnchor,
  rebindArrowAnchorsAfterMove,
  type ArrowElement,
  type Element,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { trackDuplicated } from '@/lib/element-telemetry';
import { isTechIconId } from '@/lib/tech-icons';
import { iconDropSide, type DragState } from '@/lib/canvas';
import { elementHostsAtPoint } from '@/lib/dom-hit-test';
import { applyInsertionShift, type InsertionSlot } from '@/lib/insert-between';
import { setInsertionDragInHand, setInsertionSlot } from '@/lib/insertion-preview';
import { setLanePreview } from '@/lib/lane-preview';
import { isSingleNoteDrag, landNoteInSlot, resolveNoteInsertion } from './note-insertion-drag';
import type { EditorDragDeps, EditorDragApi } from './useEditorDrag.types';
import { applyCollisionAvoidance } from './arrow-avoidance-apply';
import { applyArrowDragMove } from './arrow-drag-apply';
import { applyShiftDuplicateSwap, type ShiftDupSwap } from './shift-duplicate-swap';
import {
  resizedElement,
  resolveBoxedMove,
  resolveBoxedResize,
  translateBoxedSelection,
} from './boxed-drag-resolve';
import { measureDrawnText } from '@/components/canvas/text-hug-measure';
import { useSnapGuideState } from './useSnapGuideState';
import { useArrowDragHandlers } from './useArrowDragHandlers';
import { useBoxedDragHandlers } from './useBoxedDragHandlers';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { beginCanvasGesture } from '@/lib/canvas-gesture';
import { applyOverlay, clearLocalPreview, localPreview, setLocalPreview } from '@/lib/drag-preview';
import { dragWaitsToEngage, gestureOfDrag } from './drag-gesture';

// Screen-pixel distance the pointer must travel before a body drag
// actually starts moving the element. Below this a press (even one that
// wobbles a few pixels) just selects / opens the element for editing —
// it never nudges it. Distance-based, not time-based: a fast flick still
// covers far more than this, so real drags engage immediately. Resize /
// rotate / arrow-endpoint grabs are deliberate handle pulls and aren't
// gated.
const DRAG_ENGAGE_PX = 4;

// Everything the move handler reads off a pointer event. Structural rather
// than `PointerEvent` so the handler can be replayed from a stored position
// when only a MODIFIER changes (see onAltChange) — a real PointerEvent keeps
// its fields on the prototype and so can't be copied with a spread.
type MovePointer = {
  clientX: number;
  clientY: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export function useEditorDrag(deps: EditorDragDeps): EditorDragApi {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Alignment guides for the active gesture. Set from the move-effect on
  // every boxed move / single-element resize, cleared on pointer-up. The
  // render layer (CanvasChrome) draws them as faint lines.
  // Cosmetic snap-guide overlay state (alignment + distribution guides,
  // arrow snap markers), coalesced through rAF. See useSnapGuideState.
  const { snapGuides, distGuides, snapTargets, scheduleGuides, scheduleSnapTargets } =
    useSnapGuideState();
  // Whether the current body drag has crossed DRAG_ENGAGE_PX. Reset at the
  // start of each gesture (in the move effect below); flipped true once the
  // pointer travels far enough that the press is unambiguously a drag.
  const dragEngagedRef = useRef(false);
  // A begin* handler ARMS a checkpoint here instead of taking it at
  // pointer-down. It's flushed lazily on the first real `tick` (the first
  // actual mutation) in the move effect below, so a plain click that
  // selects an element — or a press on a locked element / tab that never
  // mutates — leaves the undo history untouched. Taking the checkpoint at
  // pointer-down pushed a no-op snapshot (and cleared the redo stack) on
  // every click, evicting real states from the bounded HISTORY_LIMIT.
  const checkpointPendingRef = useRef(false);
  // One-shot guard so an arrow-to-arrow connection (docs/specs/008-canvas/arrow-to-arrow.md) is tracked once
  // per endpoint drag, not on every pointer-move tick. Reset on drag start.
  const arrowConnectTrackedRef = useRef(false);
  // Shift-duplicate ghosting (docs/specs/008-canvas/shift-drag-duplicate.md). Holding Shift during a boxed move
  // swaps identities: the ORIGINAL elements park back at their start
  // position (keeping their ids, so every arrow pinned to them stays put),
  // and a fresh CLONE set takes over the cursor, rendered as a translucent
  // ghost. Boundary arrows (pinned to a dragged element from outside the
  // set) are duplicated onto the clones so a copied box keeps its
  // connections. `dupSwapRef` holds what's needed to swing back if Shift
  // is released (a ref, so mid-drag toggles don't churn the
  // pointer-listener effect); `shiftDupGhostIds` is the render-facing set
  // of CLONE ids to draw translucent.
  const dupSwapRef = useRef<ShiftDupSwap | null>(null);
  const [shiftDupGhostIds, setShiftDupGhostIds] = useState<ReadonlySet<string> | null>(null);
  // Insert between (docs/specs/021-event-storming/event-storming.md), second entry point: the slot this drag is
  // offering while Alt is held. A ref, not state, for the same reason the
  // duplicate swap is one — it changes at pointer rate and only the module
  // store (which the canvas renders from) needs to wake anything up. The
  // OTHER notes' ripple stays a render-time preview until the drop; only the
  // dragged note itself moves for real, as it does on any move.
  const insertSlotRef = useRef<InsertionSlot | null>(null);
  // Stash deps on every render so the move-effect always reads
  // fresh values without re-subscribing global pointer listeners.
  const depsRef = useLatest(deps);
  // The gesture's preview (docs/specs/008-canvas/drag-preview.md): every write a drag makes lands
  // here, not in the document, and the document changes once, on release. `base` is the board as
  // the gesture found it (the overlay is what the gesture changed relative to it, so a
  // collaborator's change to another element is never undone), `virtual` the gesture's own result,
  // which the drag logic reads in place of the written document. Kept across the effect's re-runs
  // within one gesture (a quick-connect arrow turning to follow the pointer).
  const previewRef = useRef<{ tabId: string; base: Element[]; virtual: Element[] } | null>(null);
  const virtualTab = useEffectEvent(() => {
    const tab = depsRef.current.activeTab;
    const p = previewRef.current;
    return p && p.tabId === tab.id ? { ...tab, elements: p.virtual } : tab;
  });
  const previewTick = useEffectEvent((mapper: (els: Element[]) => Element[]) => {
    const tab = depsRef.current.activeTab;
    let p = previewRef.current;
    if (!p) {
      p = { tabId: tab.id, base: tab.elements, virtual: tab.elements };
      previewRef.current = p;
      debugLog('[drag-preview] begin', { tab: tab.id });
    }
    const next = { ...p, virtual: mapper(p.virtual) };
    previewRef.current = next;
    setLocalPreview(next.tabId, next.virtual, next.base);
  });
  // The preview becomes the document in one change: one checkpoint (for an edit of existing
  // elements; a creation drag never arms one), one write.
  const commitPreview = useEffectEvent(() => {
    const p = previewRef.current;
    previewRef.current = null;
    const overlay = localPreview();
    const count = overlay ? overlay.changed.size + overlay.removed.size + overlay.added.length : 0;
    clearLocalPreview(count > 0 ? 'landed' : 'cancelled');
    if (!p || !overlay || count === 0) return;
    if (checkpointPendingRef.current) {
      depsRef.current.markCheckpoint();
      checkpointPendingRef.current = false;
    }
    depsRef.current.tick((els) => applyOverlay(els, overlay));
    debugLog('[drag-preview] commit', { count });
  });
  const cancelPreview = useEffectEvent(() => {
    if (!previewRef.current) return;
    previewRef.current = null;
    clearLocalPreview('cancelled');
    debugLog('[drag-preview] cancel');
  });
  // The canvas going away mid-gesture writes nothing.
  useEffect(() => () => cancelPreview(), []);

  const { beginDrag, beginAnchorDrag } = useBoxedDragHandlers({
    depsRef,
    setDrag,
    checkpointPendingRef,
  });

  // Shared opening for every arrow-handle drag: refuse to start while a
  // format-painter gesture is live, then resolve the
  // target as a typed arrow. Returns the deps snapshot + arrow, or null
  // when the drag shouldn't begin. The setSelectedId / locked / style
  // guards stay per-handler because their order differs between gestures.
  const {
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowBend,
    beginArrowScale,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  } = useArrowDragHandlers({ depsRef, setDrag, checkpointPendingRef, arrowConnectTrackedRef });

  // Global pointer-move / pointer-up listeners. Attached once per
  // drag-start, torn down when the drag ends. Every fire reads
  // through depsRef so an external state change (zoom, selection,
  // active-tab swap) is reflected without re-attaching.
  useEffect(() => {
    // A gesture that ended by a route that neither committed nor cancelled keeps its result, as when
    // every tick was a write.
    if (!drag) {
      commitPreview();
      return;
    }
    // Each new gesture starts un-engaged: a body move must cross
    // DRAG_ENGAGE_PX before it nudges anything (see the move branch).
    dragEngagedRef.current = false;
    // The canvas gesture this drag is (docs/specs/008-canvas/canvas-performance.md): opened once it
    // engages, closed with the drag.
    let endGesture: (() => void) | null = null;
    const engageGesture = () => {
      endGesture ??= beginCanvasGesture(gestureOfDrag(drag));
    };
    if (!dragWaitsToEngage(drag)) engageGesture();
    // Tell the canvas a drag that could open a slot is in hand — for the whole
    // gesture rather than just while Alt is down, because the board's easing
    // must still be mounted when the slot CLOSES (or it snaps shut) and
    // because this is what offers the gesture to someone who has never heard
    // of it. Deliberately independent of the modifier: only the board, the
    // kind of thing being dragged, and how many of them.
    const movingOneNote =
      drag.kind === 'boxed' &&
      drag.mode === 'move' &&
      isSingleNoteDrag(virtualTab().elements, drag.primaryId, drag.startBounds);
    setInsertionDragInHand(movingOneNote && depsRef.current.insertGate.esBoard);
    // Timeline lanes (docs/specs/021-event-storming/event-storming.md Phase 6) apply to ANY notes being moved on one
    // of these boards, one or many: a selection snaps by the note in hand and
    // still meets the board's places. The insertion gesture still wants
    // exactly one note, so it keeps its own flag.
    const notesEligible =
      drag.kind === 'boxed' &&
      drag.mode === 'move' &&
      depsRef.current.insertGate.esBoard &&
      [...drag.startBounds.keys()].every(
        (id) => virtualTab().elements.find((el) => el.id === id)?.type === 'sticky',
      );
    // Always on a lane (docs/specs/021-event-storming/event-storming.md): a WORKSHOP note has no y tolerance.
    // A selection is snapped by the note in hand; when that is a plain
    // sticky, by the first workshop note in the selection, so every workshop
    // note in it stays on a lane.
    const laneAnchorId = (() => {
      if (drag.kind !== 'boxed') return null;
      // The previewed board: after a Shift-duplicate the note in hand is a clone only the preview has.
      const els = virtualTab().elements;
      const isWorkshop = (id: string) => {
        const el = els.find((e) => e.id === id);
        return !!el && isEventStormingNote(el);
      };
      if (isWorkshop(drag.primaryId)) return drag.primaryId;
      return [...drag.startBounds.keys()].find(isWorkshop) ?? null;
    })();
    // The last pointer position of this drag, so pressing or releasing Alt
    // without moving the mouse still opens / unwinds the slot (see onAltChange).
    let lastMove: MovePointer | null = null;
    // Cancel the drag (mirroring onUp's full cleanup: snap dots gone,
    // armed checkpoint + log flag disarmed so they can't leak into the
    // next gesture — once drag is null this effect tears down and onUp
    // never runs for this gesture).
    const cancelDrag = () => {
      cancelPreview();
      setDrag(null);
      scheduleGuides([]);
      scheduleSnapTargets([]);
      checkpointPendingRef.current = false;
      // An open insertion offer dies with the gesture. Only the preview is
      // being discarded here — the dragged note's live position is restored
      // by the checkpoint, and the other notes never moved for real.
      insertSlotRef.current = null;
      setInsertionSlot(null);
      setLanePreview(null);
      // A live shift-duplicate is torn down with the gesture: the clone set
      // goes (a no-op after the Escape path's cancelToCheckpoint already
      // restored, but pinch / second-touch cancels never restore) and the
      // selection swings back to the originals.
      const swap = dupSwapRef.current;
      if (swap) {
        dupSwapRef.current = null;
        setShiftDupGhostIds(null);
        depsRef.current.setSelectedId(swap.origSelectedId);
        depsRef.current.setMultiSelectedIds(swap.origMultiIds);
      }
    };
    // Cancel the drag immediately when a second touch finger lands — that
    // signals a pinch gesture, not a solo drag.
    const onSecondTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !e.isPrimary) {
        cancelDrag();
      }
    };
    const onMove = (e: MovePointer) => {
      if (depsRef.current.isPinchingRef?.current) {
        cancelDrag();
        return;
      }
      // A SNAPSHOT, not the event: a DOM event keeps its fields on the
      // prototype, so spreading one to replay it with a different modifier
      // yields an empty object and a NaN delta.
      lastMove = {
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      const activeTab = virtualTab();
      const { zoomRef } = depsRef.current;
      // Every branch below writes through this: into the gesture's preview, never the document.
      const tick = previewTick;
      // Screen-pixel delta into canvas-coord delta (invert the
      // current zoom).
      const dx = (e.clientX - drag.startClientX) / zoomRef.current;
      const dy = (e.clientY - drag.startClientY) / zoomRef.current;
      // Hold Cmd / Ctrl while dragging to place freely: skip alignment +
      // distribution snapping and its guide lines for this gesture (docs/specs/008-canvas/snap-override.md).
      const noSnap = e.metaKey || e.ctrlKey;

      if (drag.kind === 'boxed') {
        if (drag.mode === 'move') {
          // Drag-engage threshold: until the pointer has travelled past
          // DRAG_ENGAGE_PX (screen space), treat the press as a click —
          // select / open-to-edit without moving anything. Once engaged it
          // tracks the full delta from the start, so there's no jump.
          if (!dragEngagedRef.current) {
            const travelled = Math.hypot(
              e.clientX - drag.startClientX,
              e.clientY - drag.startClientY,
            );
            if (travelled < DRAG_ENGAGE_PX) return;
            dragEngagedRef.current = true;
            engageGesture();
          }
          // Insert between (docs/specs/021-event-storming/event-storming.md): while Alt is held on an event-storming
          // board, a single sticky offers to take its place BETWEEN two notes
          // rather than just land near them. The slot is the placement while
          // it is open, so it wins over the alignment snap and over free
          // placement (Cmd/Ctrl) alike — two placement rules at once would
          // put the note, the marker and the drop in three different places.
          const slot = resolveNoteInsertion({
            gate: depsRef.current.insertGate,
            altHeld: e.altKey,
            shiftHeld: e.shiftKey,
            elements: activeTab.elements,
            primaryId: drag.primaryId,
            startBounds: drag.startBounds,
            dx,
            dy,
            inertIds: depsRef.current.layerInertIds,
            active: insertSlotRef.current,
          });
          insertSlotRef.current = slot;
          setInsertionSlot(slot);
          if (slot) {
            // An open slot IS the placement, so the lane rung stands down
            // with everything else below it.
            setLanePreview(null);
            // One vertical line where the board splits, in the guide overlay's
            // own visual language — the same marker the palette drag draws.
            scheduleGuides(
              [{ axis: 'x', position: slot.atX, start: slot.spanTop, end: slot.spanBottom }],
              [],
            );
            // The note moves live, as any dragged note does; the ripple it is
            // opening stays a preview until the drop.
            tick((els) => landNoteInSlot(els, drag.primaryId, slot));
            return;
          }
          // Alignment / distribution snapping + the guide lines live in
          // resolveBoxedMove; this handler applies the resolved
          // translation and the rebind pass.
          const move = resolveBoxedMove({
            elements: activeTab.elements,
            startBounds: drag.startBounds,
            primaryId: notesEligible && laneAnchorId ? laneAnchorId : drag.primaryId,
            dx,
            dy,
            noSnap,
            guidesOn: depsRef.current.alignmentGuidesRef.current ?? true,
            pageSnapBoxes: depsRef.current.pageSnapBoxes ?? undefined,
            // Free placement (Cmd/Ctrl) skips the lanes with everything else:
            // the modifier means "I know where I want this".
            timeline: notesEligible && !noSnap ? ES_LANES : null,
            laneHeld: laneAnchorId !== null,
          });
          setLanePreview(move.lane);
          scheduleGuides(move.guides, move.distGuides);
          tick((els) => {
            // First pass: translate every dragged boxed element (and the
            // free ends of arrows pulled into a frame-section move).
            const moved = translateBoxedSelection(
              els,
              drag.startBounds,
              drag.startArrowEnds,
              move.tx,
              move.ty,
            );
            // Second pass, live on every frame: the auto-rebind
            // (docs/specs/008-canvas/arrow-anchors.md) moves an end whose
            // arrow now runs through a shape. Skipped when the
            // preference (docs/specs/007-editor/user-preferences.md) is
            // off. Read through a ref so a mid-drag flip lands on the
            // next pointermove; ?? true mirrors its default.
            const autoRebind = depsRef.current.autoRebindArrowsRef.current ?? true;
            return autoRebind ? rebindArrowAnchorsAfterMove(moved, drag.startBounds) : moved;
          });
          // Shift-duplicate identity swap (docs/specs/008-canvas/shift-drag-duplicate.md): holding Shift turns
          // this move into a copy by parking the originals and handing the
          // cursor to a fresh clone set, and releasing it swings back. All
          // of that lives in shift-duplicate-swap.ts; a true return means
          // it took the tick over and the plain translate above no longer
          // applies.
          const d = depsRef.current;
          if (
            applyShiftDuplicateSwap({
              drag,
              shiftKey: e.shiftKey,
              isReadOnly: d.isReadOnly,
              dx,
              dy,
              elements: activeTab.elements,
              swap: dupSwapRef.current,
              setSwap: (next) => {
                dupSwapRef.current = next;
              },
              setGhostIds: setShiftDupGhostIds,
              setDrag,
              ...d.readSelection(),
              setSelectedId: d.setSelectedId,
              setMultiSelectedIds: d.setMultiSelectedIds,
              tick,
            })
          ) {
            return;
          }
        } else {
          // Single + multi resize (union scaling, rotated projection,
          // resize snapping) all live in resolveBoxedResize; this handler
          // writes the resolved per-element bounds. `guides: null` means
          // the frame doesn't own the guide state (multi-resize never
          // scheduled it).
          const resize = resolveBoxedResize({
            elements: activeTab.elements,
            startBounds: drag.startBounds,
            primaryId: drag.primaryId,
            mode: drag.mode,
            dx,
            dy,
            shiftHeld: e.shiftKey,
            dragAspectLocked: drag.aspectLocked,
            guidesOn: depsRef.current.alignmentGuidesRef.current ?? true,
            pageSnapBoxes: depsRef.current.pageSnapBoxes ?? undefined,
          });
          if (!resize) return;
          if (resize.guides !== null) scheduleGuides(resize.guides);
          // A lone text box that fits or wraps hugs its text through the resize, in either
          // editor mode (docs/specs/007-editor/editor-modes.md "A text box's sizing").
          const textHug =
            drag.startBounds.size === 1
              ? {
                  mode: drag.mode,
                  constrain: drag.aspectLocked || e.shiftKey,
                  measure: measureDrawnText(activeTab.font),
                }
              : null;
          tick((els) =>
            els.map((el) => {
              if (!isBoxed(el)) return el;
              const next = resize.boundsById.get(el.id);
              return next ? resizedElement(el, next, textHug) : el;
            }),
          );
        }
        return;
      }

      // Arrow drags engage like a body move: until the pointer travels past
      // DRAG_ENGAGE_PX a press is a click, so a quick double-click never nudges
      // a handle, pins a label or bends a line (docs/specs/008-canvas/arrow-bending.md). Drawing a
      // new arrow's endpoint is the exception: it follows the pointer at once.
      const engages = drag.kind !== 'arrow-endpoint' || drag.reposition === true;
      if (engages && !dragEngagedRef.current) {
        const travelled = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
        if (travelled < DRAG_ENGAGE_PX) return;
        dragEngagedRef.current = true;
        engageGesture();
        if (drag.kind === 'arrow-bend') {
          debugLog('[arrow-bend]', drag.arrowId, drag.plan.kind);
          track('Element', 'Changed', 'ArrowBend');
        }
      }
      // Every remaining kind is an arrow-handle drag (curve / elbow /
      // label / bend / translate, and arrow-endpoint as the fall-through), all
      // of which apply the same way: delta in, resolved geometry out
      // through `tick`. See arrow-drag-apply.ts.
      applyArrowDragMove({
        drag,
        dx,
        dy,
        noSnap,
        shiftHeld: e.shiftKey,
        elements: activeTab.elements,
        guidesOn: depsRef.current.alignmentGuidesRef.current ?? true,
        tick,
        scheduleGuides,
        scheduleSnapTargets,
        onArrowConnected: () => {
          // Once per endpoint drag, not once per move tick.
          if (arrowConnectTrackedRef.current) return;
          arrowConnectTrackedRef.current = true;
          track('Element', 'Linked', 'ArrowPoint');
        },
      });
    };
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
      // started from the document as last rendered, before the result had landed, and put the
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
        previewTick((els) => applyCollisionAvoidance(els, arrowId));
      }
      // The gesture's result, as the release logic below reads it, then written in one change before
      // anything else writes (docs/specs/008-canvas/drag-preview.md).
      const released = virtualTab();
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
                      target &&
                      (anchor === 'n' || anchor === 's' || anchor === 'e' || anchor === 'w')
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
      // A Plan card released over a board's column files its item there (docs/specs/025-plan/
      // plan-board.md): the column is read from the board's own DOM under the pointer.
      if (drag?.kind === 'boxed' && drag.mode === 'move' && d.onPlanCardDroppedOnBoard) {
        const moved = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) > 4;
        const dragged = d.activeTab.elements.find((el) => el.id === drag.primaryId);
        if (moved && dragged?.type === 'shape' && dragged.shape === 'plan-card') {
          const cell = document
            .elementsFromPoint(e.clientX, e.clientY)
            .find(
              (el): el is HTMLElement =>
                el instanceof HTMLElement && el.dataset.planStatus !== undefined,
            );
          if (cell?.dataset.planStatus)
            d.onPlanCardDroppedOnBoard(dragged, cell.dataset.planStatus);
        }
      }
      // Insert between (docs/specs/021-event-storming/event-storming.md): the drop. The dragged note is already in
      // the slot (the move ticks put it there); this adds the ripple that
      // makes room for it. Both land inside the gesture's single checkpoint,
      // so ONE undo puts the whole board back — including the note's original
      // position. The notes left of the insertion point don't move, and
      // neither does anything behind the note's OLD position: a moved note
      // leaves its hole behind, for the author to tidy.
      const insertion = insertSlotRef.current;
      insertSlotRef.current = null;
      setInsertionSlot(null);
      // The lane has done its job the moment the note lands on it: the drop
      // commits the position the overlay was promising, and the overlay goes.
      setLanePreview(null);
      if (insertion && drag?.kind === 'boxed' && drag.mode === 'move') {
        d.tick((els) => applyInsertionShift(els, insertion));
        track('Canvas', 'Used', 'InsertBetween');
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
        previewTick((els) => applyCollisionAvoidance(els, arrowId));
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
    // Escape aborts the gesture (docs/specs/008-canvas/canvas-and-palette.md). Capture phase + swallow so
    // the editor-wide Escape handlers (deselect / zen exit) don't ALSO
    // fire on the same press — one Escape does exactly one thing.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !drag) return;
      e.preventDefault();
      e.stopPropagation();
      // Follow mode: the half-drawn arrow is removed outright.
      if (drag.kind === 'arrow-endpoint' && drag.following) {
        const arrowId = drag.arrowId;
        depsRef.current.commit((els) => els.filter((el) => el.id !== arrowId));
        depsRef.current.setSelectedId(null);
        cancelDrag();
        return;
      }
      // Nothing was written while the gesture lasted, so cancelling drops its preview and the
      // elements are where the grab started, with no undo step left behind.
      cancelDrag();
    };
    // Alt pressed or released with the hand held still (docs/specs/021-event-storming/event-storming.md): the slot
    // opens and unwinds at the instant the key moves, not at the next twitch.
    // Replaying the last pointer position with the new modifier state keeps
    // one code path deciding where the note goes. (A native HTML5 drag gets
    // no key events at all, which is why the palette path relies on
    // `dragover.altKey` instead — a pointer drag does get them.)
    const onAltChange = (e: KeyboardEvent) => {
      if (e.key !== 'Alt' || e.repeat || !lastMove) return;
      if (!(drag.kind === 'boxed' && drag.mode === 'move')) return;
      onMove({ ...lastMove, altKey: e.type === 'keydown' });
    };
    // Coalesce element-drag commits to one per animation frame, the same way
    // the pan gesture already does (useCanvasPanAndMarquee).
    //
    // pointermove fires faster than React can paint: a trackpad or a 120Hz
    // pointer delivers well above 60 events a second, and every one of them
    // was paying a commit. Over a realistic drag (180 events across ~90
    // frames) this cuts DOM writes by ~18%.
    //
    // Deliberately NOT claimed: that this fixes any particular reported
    // slowness. It was written while chasing one and the measurements that
    // seemed to show a 20ms-per-move cost turned out to be measuring the test
    // harness, not the app. What it does do is stop committing work that the
    // next event in the same frame immediately throws away, which is the same
    // reasoning the pan path already applied.
    //
    // Dropping the intermediate events is lossless. Every branch of `onMove`
    // computes from the gesture's ANCHOR (`drag.startClientX` and friends)
    // and the event's absolute position, never by accumulating deltas, so the
    // frame that lands is identical whether or not the ones before it ran.
    // `onUp` flushes anything still pending first, so a gesture always ends
    // on the true final position rather than the last painted frame.
    // `moveScheduled` rather than a null check on the handle: it is set
    // BEFORE requestAnimationFrame is called and cleared inside the flush, so
    // it is correct even when the callback runs synchronously (which is how
    // the tests drive a frame). Guarding on the handle alone left it assigned
    // AFTER a synchronous flush had already cleared it, so it never returned
    // to null and every later move was dropped.
    let moveScheduled = false;
    let moveRaf: number | null = null;
    let pendingMove: MovePointer | null = null;
    const flushMove = () => {
      moveScheduled = false;
      moveRaf = null;
      const move = pendingMove;
      pendingMove = null;
      if (move) onMove(move);
    };
    const onPointerMove = (e: PointerEvent) => {
      // A SNAPSHOT for the same reason `onMove` takes one: a DOM event's
      // fields live on the prototype, and this one has to outlive the
      // handler by up to a frame.
      pendingMove = {
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      if (moveScheduled) return;
      moveScheduled = true;
      moveRaf = requestAnimationFrame(flushMove);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointerdown', onSecondTouch);
    window.addEventListener('pointerdown', onPlaceClick, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keydown', onAltChange);
    window.addEventListener('keyup', onAltChange);
    return () => {
      endGesture?.();
      if (moveRaf !== null) cancelAnimationFrame(moveRaf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointerdown', onSecondTouch);
      window.removeEventListener('pointerdown', onPlaceClick, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keydown', onAltChange);
      window.removeEventListener('keyup', onAltChange);
      // No gesture in flight: nothing may be left standing aside.
      insertSlotRef.current = null;
      setInsertionSlot(null);
      setLanePreview(null);
      setInsertionDragInHand(false);
    };
  }, [depsRef, drag, scheduleGuides, scheduleSnapTargets]);

  return {
    drag,
    shiftDupGhostIds,
    snapGuides,
    distGuides,
    snapTargets,
    beginDrag,
    beginAnchorDrag,
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowBend,
    beginArrowScale,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  };
}
