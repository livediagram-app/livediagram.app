// Pure selection-display derivation for the canvas: given the element
// list, the current selection (single id + marquee multi-set), and the
// editing/mode flags, work out the primary selected element, the
// selection bounds, and every "should this chrome show?" predicate the
// Canvas render reads. Lifted out of Canvas.tsx so this decision logic
// is unit-testable in isolation (the component itself has no tests).
import { isFixedSizeElement } from '@livediagram/diagram';
import {
  elementBounds,
  isBoxed,
  unionBoxedBounds,
  unionElementBounds,
  type Element,
} from '@livediagram/diagram';

type Bounds = { x: number; y: number; width: number; height: number };

type CanvasSelection = {
  // First element (in z-order) of an active marquee multi-selection,
  // promoted so the selection chrome can read shared properties from it.
  multiPrimaryId: string | null;
  // The primary selected element: the single selection, else the multi
  // primary. Null when nothing is selected.
  selected: Element | null;
  selectionScope: 'single' | 'multi';
  selectedIsBoxed: boolean;
  selectionBounds: Bounds | null;
  selectedLocked: boolean;
  // Single-selection popover + plus-button visibility.
  showPopover: boolean;
  showPlus: boolean;
  // Per-element resize-handle / arrow-anchor visibility (same predicate
  // for both today). Call with an element id.
  showHandlesFor: (id: string) => boolean;
  showAnchorsFor: (id: string) => boolean;
  // Union (multi-selection) resize-handle state.
  unionResizeIds: Set<string> | null;
  unionResizeBounds: Bounds | null;
  unionResizePrimaryId: string | null;
  showUnionResize: boolean;
  // Floating multi-selection toolbar anchor + visibility. Spans arrows too,
  // so it shows for arrow-only / mixed marquees (the resize box above does not).
  multiToolbarBounds: Bounds | null;
  showMultiToolbar: boolean;
};

export function deriveCanvasSelection(input: {
  elements: Element[];
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  editingId: string | null;
  isPaintMode: boolean;
  tabLocked: boolean;
  readOnly: boolean;
  // Event-storming board (docs/specs/021-event-storming/event-storming.md): a low-threshold capture surface where
  // every control that doesn't serve "add a note, type, drag" is a
  // distraction — the quick-connect pluses stand down.
  esBoard?: boolean;
  // An element context menu is open. One question, one answer: a left click
  // asks "what is this" (popover), a right click "what can I do with it"
  // (menu). Both at once rings the element with two toolbars repeating each
  // other's verbs, so the menu — the deliberate, more specific gesture —
  // owns the moment and the popover (with its pluses) stands down.
  elementMenuOpen?: boolean;
}): CanvasSelection {
  const {
    elements,
    selectedId,
    multiSelectedIds,
    editingId,
    isPaintMode,
    tabLocked,
    readOnly,
    esBoard,
    elementMenuOpen,
  } = input;

  const multiPrimaryId =
    multiSelectedIds.size > 0
      ? (elements.find((el) => multiSelectedIds.has(el.id))?.id ?? null)
      : null;
  const selected =
    (selectedId ? elements.find((el) => el.id === selectedId) : undefined) ??
    (multiPrimaryId ? elements.find((el) => el.id === multiPrimaryId) : undefined) ??
    null;
  const selectionScope: 'single' | 'multi' = multiSelectedIds.size > 0 ? 'multi' : 'single';
  const selectedIsBoxed = selected ? isBoxed(selected) : false;
  const selectionBounds: Bounds | null = selected ? elementBounds(selected, elements) : null;

  const selectedLocked = selected ? selected.locked === true : false;
  const showPopover = !!(
    selected &&
    !elementMenuOpen &&
    editingId !== selected.id &&
    !isPaintMode &&
    multiSelectedIds.size === 0 &&
    !tabLocked
  );
  const showPlus = !!(
    selected &&
    !elementMenuOpen &&
    selectedIsBoxed &&
    // Never on an event-storming board (docs/specs/021-event-storming/event-storming.md).
    !esBoard &&
    // Quick-connect works on a single element. A marquee multi-select stays
    // suppressed: it's a transient selection, not a unit you chain from.
    multiSelectedIds.size === 0 &&
    // An annotation marker is a note, not a node to chain from. See docs/specs/009-elements/annotations.md
    // + docs/specs/008-canvas/canvas-and-palette.md. Tables DO show the pluses, with a slimmed table ring (Arrow
    // + Add Row / Add Column, docs/specs/008-canvas/canvas-and-palette.md).
    //
    // Frames used to be excluded too, on the grounds that a backdrop's
    // pluses would float far out around the whole section. Lanes are the
    // same shape of thing and always showed theirs, which made the rule look
    // arbitrary rather than considered: both are containers you chain from
    // exactly as often as you chain from a box.
    selected.type !== 'annotation' &&
    editingId !== selected.id &&
    !isPaintMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly
  );
  // Resize handles and arrow anchors share one predicate: a single
  // boxed selection, not being edited, in no edit-blocking mode.
  const handleVisible = (id: string) =>
    selectedIsBoxed &&
    id === selectedId &&
    multiSelectedIds.size === 0 &&
    editingId !== id &&
    !isPaintMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly;

  // Arrow-anchor dots are suppressed for tables: connecting a
  // connector to a grid is an unlikely flow and the external dots
  // clash with the table's own in-cell controls. Resize handles
  // (resizeVisible) still show.
  // Resize handles skip the FIXED-SIZE kinds (docs/specs/009-elements/mode-button.md buttons) and any
  // element stamped fixed at creation (docs/specs/021-event-storming/event-storming.md event-storming notes): both
  // are one size for life, so offering a handle would advertise a resize the
  // drag paths deliberately ignore.
  const resizeVisible = (id: string) => {
    if (!handleVisible(id)) return false;
    const el = elements.find((e) => e.id === id);
    // Fixed-size elements (mode / session buttons by kind, event-storming
    // notes by their creation stamp — docs/specs/021-event-storming/event-storming.md) advertise no resize.
    return !(el && isFixedSizeElement(el));
  };

  // The edge "anchors" are RESIZE grips today (arrows are drawn from the
  // quick-connect menu now, see SelectionChromeLayer), so they follow the
  // same fixed-size rule as the corner handles. They used to be exempt on
  // the reasoning that "an arrow can still point at a button" — true of a
  // connector anchor, untrue of the widget that actually renders, which is
  // why a fixed-size sticky could still be dragged wider by its edges.
  const anchorVisible = (id: string) =>
    resizeVisible(id) && elements.find((el) => el.id === id)?.type !== 'table';

  const unionResizeIds: Set<string> | null = multiSelectedIds.size > 1 ? multiSelectedIds : null;
  const unionResizeBounds =
    unionResizeIds && selected ? unionBoxedBounds(elements, unionResizeIds) : null;
  const unionResizePrimaryId = multiSelectedIds.size > 1 ? (multiPrimaryId ?? selectedId) : null;
  const showUnionResize =
    !!unionResizeBounds &&
    !!unionResizePrimaryId &&
    selectedIsBoxed &&
    editingId !== unionResizePrimaryId &&
    !isPaintMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly;

  // The floating multi-selection toolbar (Duplicate / Lock / Export /
  // Delete + the "More" entry into the type-aware formatting menu) is anchored
  // separately from the resize box: it floats over the union of EVERY selected
  // element including arrows, so an arrow-only or mixed marquee still gets the
  // toolbar (and thus the Flow / animate controls). The resize handles above
  // stay boxed-only because there's no box to drag-resize an arrow by.
  const multiToolbarBounds =
    multiSelectedIds.size > 1 ? unionElementBounds(elements, multiSelectedIds) : null;
  const showMultiToolbar =
    !!multiToolbarBounds && multiSelectedIds.size > 1 && !isPaintMode && !tabLocked && !readOnly;

  return {
    multiPrimaryId,
    selected,
    selectionScope,
    selectedIsBoxed,
    selectionBounds,
    selectedLocked,
    showPopover,
    showPlus,
    showHandlesFor: resizeVisible,
    showAnchorsFor: anchorVisible,
    unionResizeIds,
    unionResizeBounds,
    unionResizePrimaryId,
    showUnionResize,
    multiToolbarBounds,
    showMultiToolbar,
  };
}
