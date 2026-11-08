import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Element, IconPosition, Tab } from '@livehuddle/document';
import type { DragMode, DragState } from '@/lib/canvas';
import type { SnapGuideStore } from './useSnapGuideState';

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
  // Read when a press or a drag frame acts (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  setSelectedId: (id: string | null) => void;
  // Written by the shift-duplicate identity swap (docs/specs/008-canvas/shift-drag-duplicate.md): the cursor-
  // following set becomes the fresh clones, so the selection must follow
  // them (and swing back if the duplicate is dissolved).
  setMultiSelectedIds: (ids: Set<string>) => void;
  editingId: string | null;
  isReadOnly: boolean;
  // A Participant moves what it may despite isReadOnly (docs/specs/013-workspace/share-roles.md).
  canMove?: (el: Element) => boolean;
  canResize?: (el: Element) => boolean;
  // Modal interaction state. When format-painter is active, a click
  // on an element applies the format instead of dragging. The drag
  // dispatcher checks this and routes appropriately.
  formatSourceId: string | null;
  applyFormatFromSource: (targetId: string) => void;
  // The persistent Format canvas tool is active. A click on an element
  // picks it as the paint source (first click) or paints the armed
  // source's style onto it and stays armed (subsequent clicks) — instead
  // of selecting / dragging. `setFormatSourceId` arms the source.
  formatToolActive: boolean;
  setFormatSourceId: (id: string | null) => void;
  // Element setters from the editor. `tick` writes elements without
  // taking a history checkpoint (used during the move-effect's
  // 60+/sec updates); `commit` writes elements AND snapshots history
  // (used by a release that writes outside the gesture). `markCheckpoint` is the snapshot-without-write entry
  // point, used at the start of a boxed move/resize so a single
  // Cmd-Z undoes the whole gesture.
  tick: (mapper: (els: Element[]) => Element[]) => void;
  commit: (mapper: (els: Element[]) => Element[]) => void;
  markCheckpoint: () => void;
  // Escape-cancel: restore the gesture's checkpoint and discard the
  // step (no redo entry, a cancelled drag never happened).
  cancelToCheckpoint: () => void;
  // A standalone icon shape was dragged + released over another (non-
  // icon) shape: fold it INTO that shape as an inline icon on the named
  // side, removing the standalone element (docs/specs/008-canvas/canvas-and-palette.md). Omitted when icon
  // edits are blocked (read-only / locked tab).
  onIconElementDroppedOnShape?: (
    sourceIconId: string,
    targetShapeId: string,
    position: IconPosition,
  ) => void;
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
};

export type EditorDragApi = {
  drag: DragState | null;
  // The dragged element ids to render translucent while a shift-duplicate
  // is in progress (docs/specs/008-canvas/shift-drag-duplicate.md): copies already sit at the drag's start
  // position, so the set following the cursor shows as a ghost. Null
  // outside a shift-held move drag.
  shiftDupGhostIds: ReadonlySet<string> | null;
  // The in-progress gesture's snap guides (alignment lines, equal-spacing gaps), empty when no snap is in effect and cleared on release. A store, not state, so a new set
  // renders only the chrome that draws it (useSnapGuideState).
  snapGuideStore: SnapGuideStore;
  beginDrag: (elementId: string, mode: DragMode, e: ReactPointerEvent) => void;
  // The armed action (the format painter) a press on an element takes instead of selecting it.
  pressArmedAction: (elementId: string) => boolean;
};
