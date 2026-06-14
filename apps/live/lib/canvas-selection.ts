// Pure selection-display derivation for the canvas: given the element
// list, the current selection (single id + marquee multi-set), and the
// editing/mode flags, work out the primary selected element, the
// selection bounds, and every "should this chrome show?" predicate the
// Canvas render reads. Lifted out of Canvas.tsx so this decision logic
// is unit-testable in isolation (the component itself has no tests).
import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  elementBounds,
  isBoxed,
  selectionMembers,
  supportsBorderControls,
  supportsBorderRadius,
  unionBoxedBounds,
  type ArrowEnds,
  type ArrowheadShape,
  type ArrowheadSize,
  type ArrowStyle,
  type ArrowThickness,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type Element,
  type Padding,
  type ShapeKind,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { isTechIconId } from '@/lib/tech-icons';

type Bounds = { x: number; y: number; width: number; height: number };

export type CanvasSelection = {
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
};

export function deriveCanvasSelection(input: {
  elements: Element[];
  selectedId: string | null;
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
    multiSelectedIds,
    editingId,
    isPaintMode,
    isGroupMode,
    tabLocked,
    readOnly,
  } = input;

  const memberIds = selectedId
    ? new Set(selectionMembers(elements, selectedId))
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
    // Quick-connect only makes sense for a single element: with a
    // multi-select or a multi-member group there's no one shape to
    // duplicate-and-connect from, so the plus buttons are suppressed.
    multiSelectedIds.size === 0 &&
    memberIds.size === 1 &&
    // Tables don't expose the quick-connect plus buttons (connecting a
    // connector to a grid is an unlikely flow, and they clash with the
    // table's own in-cell controls).
    selected.type !== 'table' &&
    // Annotation markers + frame sections don't get the quick-connect
    // pluses either: a marker is a note, not a node to chain from, and a
    // frame is a backdrop you draw around things (its pluses would float
    // far out around the whole section). See spec/38 + spec/09.
    selected.type !== 'annotation' &&
    !(selected.type === 'shape' && selected.shape === 'frame') &&
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
  };
}

// The per-element control VALUES (no on* handlers) that
// deriveSelectedElementFields below projects, gated by element type. The
// editor reads these to render the selected element's context menu /
// popover; nullable fields are null when they don't apply to the
// selection's type.
export type SelectedElementFields = {
  textSize: TextSize | null;
  textAlignX: TextAlignX | null;
  textAlignY: TextAlignY | null;
  textColor: string | null;
  fillColor: string | null;
  strokeColor: string | null;
  opacity: number;
  padding: Padding | null;
  textBold: boolean | null;
  textItalic: boolean | null;
  textUnderline: boolean | null;
  textStrikethrough: boolean | null;
  font: string | null;
  hasText: boolean;
  arrowEnds: ArrowEnds | null;
  arrowThickness: ArrowThickness | null;
  arrowheadSize: ArrowheadSize | null;
  arrowheadShape: ArrowheadShape | null;
  arrowStyle: ArrowStyle | null;
  arrowStrokeStyle: BorderStyle | null;
  shapeKind: ShapeKind | null;
  aspectLocked: boolean | null;
  borderStroke: BorderStroke | null;
  borderStyle: BorderStyle | null;
  borderRadius: BorderRadius | null;
  tableHeaderRow: boolean | null;
  tableHeaderColumn: boolean | null;
  tableZebra: boolean | null;
  tableHeaderFill: string | null;
  tableHeaderTextColor: string | null;
};

// Which per-element control values to surface for the selected element,
// gated by element type: images (boxed but text/colour-less) null out the
// text + colour fields, arrows expose the arrow fields, shapes expose
// shapeKind + borderRadius. Pure. `selectionSupportsColours` and
// `selectedDefaultAlign` are precomputed by the caller (supportsColours /
// defaultTextAlign of the selection).
export function deriveSelectedElementFields(
  selected: Element,
  selectionSupportsColours: boolean,
  selectedDefaultAlign: ReturnType<typeof defaultTextAlign> | null,
): SelectedElementFields {
  // Icons are a curated line-art glyph, not a box: they hide the Shape
  // controls (no morph grid / aspect / padding — you pick a glyph from
  // the Icons picker, not by morphing) and the Border controls
  // (strength / pattern / radius don't apply to a single-stroke mark).
  // They keep Colours (the stroke colour tints the glyph) + Text.
  const isIcon = selected.type === 'shape' && selected.shape === 'icon';
  // Technology / architecture icons (a catalogue glyph, not tinted line art):
  // they render as their own multi-colour art, so only the Text colour
  // applies — no fill (background) or stroke (border) colour.
  const isTechIcon = isIcon && isTechIconId((selected as { iconId?: string }).iconId);
  return {
    textSize:
      isBoxed(selected) && selected.type !== 'image'
        ? (selected.textSize ?? 'md')
        : selected.type === 'arrow'
          ? (selected.textSize ?? 'sm')
          : null,
    textAlignX:
      isBoxed(selected) && selected.type !== 'image' && selectedDefaultAlign
        ? (selected.textAlignX ?? selectedDefaultAlign.x)
        : null,
    textAlignY:
      isBoxed(selected) && selected.type !== 'image' && selectedDefaultAlign
        ? (selected.textAlignY ?? selectedDefaultAlign.y)
        : null,
    textColor:
      isBoxed(selected) && selected.type !== 'image'
        ? (selected.textColor ?? defaultTextColor(selected))
        : selected.type === 'arrow'
          ? (selected.textColor ?? selected.strokeColor ?? 'rgb(51 65 85)')
          : null,
    fillColor:
      selectionSupportsColours && isBoxed(selected) && !isIcon
        ? (selected.fillColor ?? defaultFillColor(selected))
        : null,
    strokeColor:
      selectionSupportsColours && !isTechIcon
        ? isBoxed(selected)
          ? (selected.strokeColor ?? defaultStrokeColor(selected))
          : selected.type === 'arrow'
            ? (selected.strokeColor ?? 'rgb(51 65 85)') /* slate-700 = default arrow */
            : null
        : null,
    opacity: selected.opacity ?? 1,
    padding: isBoxed(selected) ? (selected.padding ?? defaultPadding(selected)) : null,
    textBold:
      isBoxed(selected) && selected.type !== 'image'
        ? (selected.textBold ?? false)
        : selected.type === 'arrow'
          ? (selected.textBold ?? false)
          : null,
    textItalic:
      isBoxed(selected) && selected.type !== 'image'
        ? (selected.textItalic ?? false)
        : selected.type === 'arrow'
          ? (selected.textItalic ?? false)
          : null,
    textUnderline:
      isBoxed(selected) && selected.type !== 'image'
        ? (selected.textUnderline ?? false)
        : selected.type === 'arrow'
          ? (selected.textUnderline ?? false)
          : null,
    textStrikethrough:
      isBoxed(selected) && selected.type !== 'image'
        ? (selected.textStrikethrough ?? false)
        : selected.type === 'arrow'
          ? (selected.textStrikethrough ?? false)
          : null,
    font:
      isBoxed(selected) && selected.type !== 'image'
        ? (selected.font ?? null)
        : selected.type === 'arrow'
          ? (selected.font ?? null)
          : null,
    hasText:
      // Tables + frames always expose Text controls: a table's cells and a
      // frame's title are integral, so you can set size / alignment / font
      // before there's any text (other shapes only reveal Text once they
      // carry a label — see spec/09 + spec/38).
      selected.type === 'table' || (selected.type === 'shape' && selected.shape === 'frame')
        ? true
        : isBoxed(selected) && selected.type !== 'image'
          ? (selected.label?.trim().length ?? 0) > 0
          : selected.type === 'arrow'
            ? (selected.label?.trim().length ?? 0) > 0
            : false,
    arrowEnds: selected.type === 'arrow' ? (selected.arrowEnds ?? 'to') : null,
    arrowThickness: selected.type === 'arrow' ? arrowThicknessOf(selected) : null,
    arrowheadSize: selected.type === 'arrow' ? arrowheadSizeOf(selected) : null,
    arrowheadShape: selected.type === 'arrow' ? arrowheadShapeOf(selected) : null,
    arrowStyle: selected.type === 'arrow' ? arrowStyleOf(selected) : null,
    arrowStrokeStyle: selected.type === 'arrow' ? (selected.strokeStyle ?? 'solid') : null,
    shapeKind: selected.type === 'shape' && !isIcon ? selected.shape : null,
    aspectLocked: isBoxed(selected) ? (selected.aspectLocked ?? false) : null,
    borderStroke:
      supportsBorderControls(selected) && !isIcon
        ? ((selected as { strokeWidth?: BorderStroke }).strokeWidth ??
          (selected.type === 'table' ? 'thin' : 'medium'))
        : null,
    borderStyle:
      supportsBorderControls(selected) && !isIcon
        ? ((selected as { strokeStyle?: BorderStyle }).strokeStyle ?? 'solid')
        : null,
    borderRadius: supportsBorderRadius(selected) ? (selected.borderRadius ?? 'sm') : null,
    tableHeaderRow: selected.type === 'table' ? (selected.headerRow ?? false) : null,
    tableHeaderColumn: selected.type === 'table' ? (selected.headerColumn ?? false) : null,
    tableZebra: selected.type === 'table' ? (selected.zebra ?? false) : null,
    tableHeaderFill:
      selected.type === 'table'
        ? (selected.headerFill ?? selected.strokeColor ?? defaultStrokeColor(selected))
        : null,
    tableHeaderTextColor:
      selected.type === 'table'
        ? (selected.headerTextColor ?? selected.textColor ?? defaultTextColor(selected))
        : null,
  };
}
