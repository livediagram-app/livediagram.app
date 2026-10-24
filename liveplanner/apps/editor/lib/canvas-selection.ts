// Pure selection-display derivation for the canvas: given the element
// list, the current selection (single id + marquee multi-set), and the
// editing/mode flags, work out the primary selected element, the
// selection bounds, and every "should this chrome show?" predicate the
// Canvas render reads. Lifted out of Canvas.tsx so this decision logic
// is unit-testable in isolation (the component itself has no tests).
import {
  isFixedSizeElement,
  sheetDrawnChartIds,
  isChipShape,
  type Rect,
} from '@liveplanner/project';
import {
  elementBounds,
  isBoxed,
  unionBoxedBounds,
  unionRects,
  type Element,
  type ElementId,
} from '@liveplanner/project';

type CanvasSelection = {
  // First element (in z-order) of an active marquee multi-selection,
  // promoted so the selection chrome can read shared properties from it.
  multiPrimaryId: string | null;
  // The primary selected element: the single selection, else the multi
  // primary. Null when nothing is selected.
  selected: Element | null;
  selectionScope: 'single' | 'multi';
  selectedIsBoxed: boolean;
  selectionBounds: Rect | null;
  selectedLocked: boolean;
  // Single-selection popover + plus-button visibility.
  showPopover: boolean;
  showPlus: boolean;
  // Per-element resize-handle / arrow-anchor visibility (same predicate
  // for both today). Call with an element id.
  showHandlesFor: (id: string) => boolean;
  showAnchorsFor: (id: string) => boolean;
  // Union (multi-selection) resize-handle state.
  unionResizeIds: ReadonlySet<string> | null;
  unionResizeBounds: Rect | null;
  unionResizePrimaryId: string | null;
  showUnionResize: boolean;
  // Floating multi-selection toolbar anchor + visibility. Spans arrows too,
  // so it shows for arrow-only / mixed marquees (the resize box above does not).
  multiToolbarBounds: Rect | null;
  showMultiToolbar: boolean;
};

// The modes that decide whether a selected element shows its grips.
type GripContext = {
  editingId: string | null;
  tabLocked: boolean;
  readOnly: boolean;
  // A read-only session that may still resize this element (a Participant): handles, never edge anchors, since a
  // connector is not its to draw.
  resizable?: boolean;
};

// One element's resize handles and edge anchors (docs/specs/008-canvas/blueprints/selection-store.md):
// shown on a lone boxed selection, not being edited, in no edit-blocking mode. Fixed-size elements
// (mode / session buttons by kind, any element by its creation stamp) advertise no resize,
// and a table no edge anchors. `single` is "this element is the one selected element".
export function elementGrips(
  el: Element,
  single: boolean,
  ctx: GripContext,
): { handles: boolean; anchors: boolean } {
  const handles =
    single &&
    isBoxed(el) &&
    el.locked !== true &&
    ctx.editingId !== el.id &&
    !ctx.tabLocked &&
    (!ctx.readOnly || ctx.resizable === true) &&
    !isFixedSizeElement(el);
  // A badge or step number takes no connectors (docs/specs/009-elements/badge.md "Connectors").
  const chip = el.type === 'shape' && isChipShape(el.shape);
  return { handles, anchors: handles && !ctx.readOnly && el.type !== 'table' && !chip };
}

export function deriveCanvasSelection(input: {
  elements: Element[];
  selectedId: string | null;
  multiSelectedIds: ReadonlySet<string>;
  editingId: string | null;
  tabLocked: boolean;
  readOnly: boolean;
  // An element context menu is open. One question, one answer: a left click
  // asks "what is this" (popover), a right click "what can I do with it"
  // (menu). Both at once rings the element with two toolbars repeating each
  // other's verbs, so the menu — the deliberate, more specific gesture —
  // owns the moment and the popover (with its pluses) stands down.
  elementMenuOpen?: boolean;
  // Where an arrow's label is drawn, if it has one. The label belongs to its
  // line (docs/specs/008-canvas/arrow-labels.md), so the floating toolbars
  // clear it as they clear the line.
  labelRectOf?: (id: ElementId) => Rect | null;
  // A Plan board or view is drawn over the canvas (maximised, or filling its tab: docs/specs/026-plan/plan-board.md
  // "Maximised board", "Fill Tab"). The canvas under it cannot be worked on, so no selection toolbar, popover or
  // plus floats over it, whatever is selected and however it came to be (a press before, select-all, undo, a
  // collaborator, the tab opening with the board selected). The selection itself is kept.
  canvasCovered?: boolean;
}): CanvasSelection {
  const {
    elements,
    selectedId,
    multiSelectedIds,
    editingId,
    tabLocked,
    readOnly,
    elementMenuOpen,
    labelRectOf,
    canvasCovered: covered = false,
  } = input;

  // An element's selection extent (docs/specs/008-canvas/arrow-labels.md): an arrow spans
  // its label too.
  const selectionExtent = (el: Element): Rect => {
    const own = elementBounds(el, elements);
    const label = el.type === 'arrow' ? labelRectOf?.(el.id) : null;
    return label ? unionRects([own, label])! : own;
  };

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
  const selectionBounds: Rect | null = selected ? selectionExtent(selected) : null;

  // A chart that sits in a Sheet is drawn and worked in its Sheet (docs/specs/029-sheets/sheet.md "Charts"): selected
  // there to open its element menu, it has no box on the canvas to float chrome over.
  const canvasCovered = covered || (!!selected && sheetDrawnChartIds(elements).has(selected.id));
  const selectedLocked = selected ? selected.locked === true : false;
  const showPopover = !!(
    selected &&
    !canvasCovered &&
    !elementMenuOpen &&
    editingId !== selected.id &&
    multiSelectedIds.size === 0 &&
    !tabLocked
  );
  const showPlus = !!(
    selected &&
    !canvasCovered &&
    !elementMenuOpen &&
    selectedIsBoxed &&
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
    // Nor is a badge or step number: it is a mark on a node (docs/specs/009-elements/badge.md).
    !(selected.type === 'shape' && isChipShape(selected.shape)) &&
    // A Plan board or Plan card is not a node to chain from: its cards are its content
    // (docs/specs/026-plan/plan-board.md).
    !(
      selected.type === 'shape' &&
      (selected.shape === 'plan-board' ||
        selected.shape === 'plan-card' ||
        selected.shape === 'plan-view' ||
        selected.shape === 'plan-sheet')
    ) &&
    editingId !== selected.id &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly
  );
  // Resize handles and edge anchors: the per-element rule each element view also applies.
  const gripsOf = (id: string) => {
    const el = elements.find((e) => e.id === id);
    const single = id === selectedId && multiSelectedIds.size === 0;
    return el && single
      ? elementGrips(el, true, { editingId, tabLocked, readOnly })
      : { handles: false, anchors: false };
  };
  const resizeVisible = (id: string) => gripsOf(id).handles;
  const anchorVisible = (id: string) => gripsOf(id).anchors;

  const unionResizeIds: ReadonlySet<string> | null =
    multiSelectedIds.size > 1 ? multiSelectedIds : null;
  const unionResizeBounds =
    unionResizeIds && selected ? unionBoxedBounds(elements, unionResizeIds) : null;
  const unionResizePrimaryId = multiSelectedIds.size > 1 ? (multiPrimaryId ?? selectedId) : null;
  const showUnionResize =
    !!unionResizeBounds &&
    !!unionResizePrimaryId &&
    selectedIsBoxed &&
    editingId !== unionResizePrimaryId &&
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
    multiSelectedIds.size > 1
      ? unionRects(elements.filter((el) => multiSelectedIds.has(el.id)).map(selectionExtent))
      : null;
  const showMultiToolbar =
    !!multiToolbarBounds && multiSelectedIds.size > 1 && !canvasCovered && !tabLocked && !readOnly;

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
