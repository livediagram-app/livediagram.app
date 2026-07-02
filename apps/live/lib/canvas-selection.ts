// Pure selection-display derivation for the canvas: given the element
// list, the current selection (single id + marquee multi-set), and the
// editing/mode flags, work out the primary selected element, the
// selection bounds, and every "should this chrome show?" predicate the
// Canvas render reads. Lifted out of Canvas.tsx so this decision logic
// is unit-testable in isolation (the component itself has no tests).
import {
  elementBounds,
  isBoxed,
  selectionMembers,
  unionBoxedBounds,
  unionElementBounds,
  type Element,
} from '@livediagram/diagram';

type Bounds = { x: number; y: number; width: number; height: number };

type CanvasSelection = {
  // Group-expanded membership of the single selection (the element +
  // every other element sharing its groupId). Empty when nothing is
  // singly selected.
  memberIds: Set<string>;
  // First element (in z-order) of an active marquee multi-selection,
  // promoted so the selection chrome can read shared properties from it.
  multiPrimaryId: string | null;
  // The primary selected element: the single selection, else the multi
  // primary. Null when nothing is selected.
  selected: Element | null;
  selectionScope: 'single' | 'multi' | 'group';
  selectedIsBoxed: boolean;
  selectedIsGrouped: boolean;
  selectionBounds: Bounds | null;
  selectedLocked: boolean;
  // Single-selection popover + plus-button visibility.
  showPopover: boolean;
  showPlus: boolean;
  // Per-element resize-handle / arrow-anchor visibility (same predicate
  // for both today). Call with an element id.
  showHandlesFor: (id: string) => boolean;
  showAnchorsFor: (id: string) => boolean;
  // Union (multi / group) resize-handle state.
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
  // Drill-in selection (spec/09 groups): when equal to selectedId, the
  // selection is just that member — the chrome shows single-element
  // handles / popover instead of the group's union box. Stale values
  // (≠ selectedId) mean "not solo".
  soloSelectedId?: string | null;
  multiSelectedIds: Set<string>;
  editingId: string | null;
  isPaintMode: boolean;
  isGroupMode: boolean;
  tabLocked: boolean;
  readOnly: boolean;
}): CanvasSelection {
  const {
    elements,
    selectedId,
    soloSelectedId,
    multiSelectedIds,
    editingId,
    isPaintMode,
    isGroupMode,
    tabLocked,
    readOnly,
  } = input;

  const memberIds = selectedId
    ? soloSelectedId === selectedId
      ? new Set([selectedId])
      : new Set(selectionMembers(elements, selectedId))
    : new Set<string>();
  const multiPrimaryId =
    multiSelectedIds.size > 0
      ? (elements.find((el) => multiSelectedIds.has(el.id))?.id ?? null)
      : null;
  const selected =
    (selectedId ? (elements.find((el) => el.id === selectedId) ?? null) : null) ??
    (multiPrimaryId ? (elements.find((el) => el.id === multiPrimaryId) ?? null) : null);
  const selectionScope: 'single' | 'multi' | 'group' =
    multiSelectedIds.size > 0 ? 'multi' : selectedId && memberIds.size > 1 ? 'group' : 'single';
  const selectedIsBoxed = selected ? isBoxed(selected) : false;
  const selectedIsGrouped = !!(selected && isBoxed(selected) && selected.groupId !== undefined);

  let selectionBounds: Bounds | null = null;
  if (selected) {
    if (selectedIsBoxed && memberIds.size > 0) {
      selectionBounds = unionBoxedBounds(elements, memberIds);
    } else {
      selectionBounds = elementBounds(selected, elements);
    }
  }

  const selectedLocked = selected ? selected.locked === true : false;
  const showPopover = !!(
    selected &&
    editingId !== selected.id &&
    !isPaintMode &&
    !isGroupMode &&
    multiSelectedIds.size === 0 &&
    !tabLocked
  );
  const showPlus = !!(
    selected &&
    selectedIsBoxed &&
    // Quick-connect works on a single element OR a multi-member group (the
    // pluses then ring the group's union bounds — spawn is already
    // group-aware and an arrow pins to the member nearest the picked side).
    // A marquee multi-select stays suppressed: it's a transient selection,
    // not a unit you chain from.
    multiSelectedIds.size === 0 &&
    // The per-type exclusions apply to a lone element only. Tables don't
    // expose the pluses (connecting a connector to a grid is an unlikely
    // flow, and they clash with the table's own in-cell controls); an
    // annotation marker is a note, not a node to chain from; and a frame is
    // a backdrop you draw around things (its pluses would float far out
    // around the whole section). See spec/38 + spec/09. On a group the
    // pluses belong to the union box, not any one member, so a grouped
    // table/frame doesn't suppress them.
    (memberIds.size > 1 ||
      (selected.type !== 'table' &&
        selected.type !== 'annotation' &&
        !(selected.type === 'shape' && selected.shape === 'frame'))) &&
    editingId !== selected.id &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly
  );
  // Resize handles and arrow anchors share one predicate: a single
  // boxed selection, not being edited, in no edit-blocking mode.
  const handleVisible = (id: string) =>
    selectedIsBoxed &&
    id === selectedId &&
    memberIds.size === 1 &&
    editingId !== id &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly;

  // Arrow-anchor dots are suppressed for tables: connecting a
  // connector to a grid is an unlikely flow and the external dots
  // clash with the table's own in-cell controls. Resize handles
  // (handleVisible) still show.
  const anchorVisible = (id: string) =>
    handleVisible(id) && elements.find((el) => el.id === id)?.type !== 'table';

  const unionResizeIds: Set<string> | null =
    multiSelectedIds.size > 1 ? multiSelectedIds : memberIds.size > 1 ? memberIds : null;
  const unionResizeBounds =
    unionResizeIds && selected ? unionBoxedBounds(elements, unionResizeIds) : null;
  const unionResizePrimaryId =
    multiSelectedIds.size > 1
      ? (multiPrimaryId ?? selectedId)
      : memberIds.size > 1
        ? selectedId
        : null;
  const showUnionResize =
    !!unionResizeBounds &&
    !!unionResizePrimaryId &&
    selectedIsBoxed &&
    editingId !== unionResizePrimaryId &&
    !isPaintMode &&
    !isGroupMode &&
    !selectedLocked &&
    !tabLocked &&
    !readOnly;

  // The floating multi-selection toolbar (Duplicate / Group / Lock / Export /
  // Delete + the "More" entry into the type-aware formatting menu) is anchored
  // separately from the resize box: it floats over the union of EVERY selected
  // element including arrows, so an arrow-only or mixed marquee still gets the
  // toolbar (and thus the Flow / animate controls). The resize handles above
  // stay boxed-only because there's no box to drag-resize an arrow by.
  const multiToolbarBounds =
    multiSelectedIds.size > 1 ? unionElementBounds(elements, multiSelectedIds) : null;
  const showMultiToolbar =
    !!multiToolbarBounds &&
    multiSelectedIds.size > 1 &&
    !isPaintMode &&
    !isGroupMode &&
    !tabLocked &&
    !readOnly;

  return {
    memberIds,
    multiPrimaryId,
    selected,
    selectionScope,
    selectedIsBoxed,
    selectedIsGrouped,
    selectionBounds,
    selectedLocked,
    showPopover,
    showPlus,
    showHandlesFor: handleVisible,
    showAnchorsFor: anchorVisible,
    unionResizeIds,
    unionResizeBounds,
    unionResizePrimaryId,
    showUnionResize,
    multiToolbarBounds,
    showMultiToolbar,
  };
}
