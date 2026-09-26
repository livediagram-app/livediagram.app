import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  AlignmentGuide,
  DistributionGuide,
  Anchor,
  Element,
  IconPosition,
  Tab,
} from '@livediagram/diagram';
import type { ArrowEnd, DragMode, DragState } from '@/lib/canvas';
import type { InsertionGate } from '@/lib/insert-between';
import type { SnapTarget } from '@/components/canvas/Canvas.types';

// External state + callbacks the drag machine reads on every move.
// Bundled into one object so the hook signature doesn't sprout
// positional arguments as more inputs land; tracked via a ref so the
// move-effect doesn't re-attach listeners on every parent render.
export type EditorDragDeps = {
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
  // Written by the shift-duplicate identity swap (docs/specs/008-canvas/shift-drag-duplicate.md): the cursor-
  // following set becomes the fresh clones, so the selection must follow
  // them (and swing back if the duplicate is dissolved).
  setMultiSelectedIds: (ids: Set<string>) => void;
  editingId: string | null;
  isReadOnly: boolean;
  // Elements on a hidden or locked layer (docs/specs/006-diagram/layers.md): every gesture
  // starter treats them as inert — no select, no drag, no new arrow.
  layerInertIds: Set<string>;
  // Modal interaction state. When format-painter is active, a click
  // on an element applies the format instead of dragging. The drag
  // dispatcher checks this and routes appropriately.
  formatSourceId: string | null;
  applyFormatFromSource: (targetId: string, opts?: { keepSource?: boolean }) => void;
  // The persistent Format canvas tool is active. A click on an element
  // picks it as the paint source (first click) or paints the armed
  // source's style onto it and stays armed (subsequent clicks) — instead
  // of selecting / dragging. `setFormatSourceId` arms the source.
  formatToolActive: boolean;
  setFormatSourceId: (id: string | null) => void;
  // Arrow click-to-connect (docs/specs/008-canvas/canvas-and-palette.md): armed source + the action.
  connectSourceId: string | null;
  connectArrowTo: (targetId: string) => void;
  // Element setters from the editor. `tick` writes elements without
  // taking a history checkpoint (used during the move-effect's
  // 60+/sec updates); `commit` writes elements AND snapshots history
  // (used at drag-begin to create the new arrow when an anchor is
  // pulled). `markCheckpoint` is the snapshot-without-write entry
  // point, used at the start of a boxed move/resize so a single
  // Cmd-Z undoes the whole gesture.
  tick: (mapper: (els: Element[]) => Element[]) => void;
  commit: (mapper: (els: Element[]) => Element[]) => void;
  // Returns the undo-marker token of the pushed step (lib/entry-history)
  // so the gesture's debounced log entry can fill exactly that step.
  markCheckpoint: () => number;
  // Escape-cancel: restore the gesture's checkpoint and discard the
  // step + its marker (no redo entry — a cancelled drag never happened).
  cancelToCheckpoint: () => void;
  // Debounced activity-log emitter (see useActivityLogDebounce). Called
  // on every mutating tick of an edit gesture; the per-key 500ms window
  // collapses the whole drag into ONE entry that diffs pre-gesture vs
  // final state. A continuous move/resize never flushes mid-drag (each
  // tick resets the timer), so the panel gets one "Moved a Square", not
  // one row per frame. `fillToken` names the gesture's checkpoint step.
  scheduleElementChangeLog: (
    key: string,
    opts?: { fillToken?: number; onWindowStart?: () => number },
  ) => void;
  // A standalone icon shape was dragged + released over another (non-
  // icon) shape: fold it INTO that shape as an inline icon on the named
  // side, removing the standalone element (docs/specs/008-canvas/canvas-and-palette.md). Omitted when icon
  // edits are blocked (read-only / locked tab).
  onIconElementDroppedOnShape?: (
    sourceIconId: string,
    targetShapeId: string,
    position: IconPosition,
  ) => void;
  // An annotation marker was pressed + released without moving (a click,
  // not a drag): open its note editor (docs/specs/009-elements/annotations.md). Distinguished from a drag
  // by the same DRAG_ENGAGE_PX travel test the icon-fold uses. Omitted when
  // note edits are blocked (read-only / locked tab).
  onAnnotationClicked?: (id: string) => void;
  // Per-user preference (docs/specs/007-editor/user-preferences.md) controlling whether connected
  // arrows re-pin to the most-natural face as a box is dragged.
  // Defaults to true; setting `false` keeps anchors frozen at
  // whatever the user originally chose. Tracked via ref so a
  // mid-drag toggle takes effect on the next pointermove without
  // re-attaching listeners.
  autoRebindArrowsRef: React.RefObject<boolean>;
  // Per-user preference (docs/specs/008-canvas/canvas-and-palette.md) controlling whether the faint
  // alignment guides are drawn during a move / resize. Defaults to
  // true; `false` suppresses the guide lines (the snap itself is
  // unaffected). Tracked via ref so a mid-drag toggle takes effect on
  // the next pointermove without re-attaching listeners.
  alignmentGuidesRef: React.RefObject<boolean>;
  // Set to true while a 2-finger pinch is active. The move handler
  // checks this and cancels any in-flight drag so a pinch-to-zoom
  // gesture that starts on an element doesn't also move it.
  isPinchingRef?: React.RefObject<boolean>;
  // Insert between (docs/specs/021-event-storming/event-storming.md): what the board and session allow. The
  // other half of the gate — a held Alt — is read off each pointer
  // event, so an ordinary move never offers a slot.
  insertGate: InsertionGate;
};

export type EditorDragApi = {
  drag: DragState | null;
  // The dragged element ids to render translucent while a shift-duplicate
  // is in progress (docs/specs/008-canvas/shift-drag-duplicate.md): copies already sit at the drag's start
  // position, so the set following the cursor shows as a ghost. Null
  // outside a shift-held move drag.
  shiftDupGhostIds: ReadonlySet<string> | null;
  // Faint alignment guides for the in-progress move / resize: the edge
  // and centre lines the dragged element currently shares with its
  // neighbours, drawn so the user can see why it snapped. Empty when no
  // snap is in effect, and cleared on release. See `alignmentGuides`.
  snapGuides: AlignmentGuide[];
  // Equal-spacing guides for the in-progress move: the gap segments shown
  // when the element snaps to even spacing with its neighbours.
  distGuides: DistributionGuide[];
  // Connection-point markers for the in-progress arrow-endpoint drag: the
  // anchors of nearby shapes, with the snapped one flagged `active`. Empty
  // outside an endpoint drag.
  snapTargets: SnapTarget[];
  beginDrag: (elementId: string, mode: DragMode, e: ReactPointerEvent) => void;
  beginAnchorDrag: (
    elementId: string,
    anchor: Anchor,
    e: ReactPointerEvent,
    opts?: {
      clickToPlace?: boolean;
      placeOutPx?: number;
      // Enter a real drag, but remember what a no-movement TAP should do
      // (touch quick-connect, docs/specs/008-canvas/canvas-and-palette.md).
      tapPlaceOutPx?: number;
    },
  ) => void;
  beginArrowTranslate: (arrowId: string, e: ReactPointerEvent) => void;
  beginEndpointDrag: (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => void;
  beginArrowCurveDrag: (arrowId: string, e: ReactPointerEvent) => void;
  beginArrowCurvePointDrag: (arrowId: string, index: number, e: ReactPointerEvent) => void;
  addCurvePoint: (arrowId: string, canvasX: number, canvasY: number) => void;
  deleteCurvePoint: (arrowId: string, index: number) => void;
  beginArrowElbowDrag: (arrowId: string, e: ReactPointerEvent) => void;
  beginArrowLabelDrag: (arrowId: string, e: ReactPointerEvent) => void;
};
