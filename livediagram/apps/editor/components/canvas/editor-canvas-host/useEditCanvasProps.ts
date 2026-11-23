import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { usePointerNoteSetters } from '@/hooks/canvas/usePointerNoteSetters';
import { canEditSankey } from '@/lib/sankey-edit';
import { canEditSequence } from '@/lib/sequence-edit';
import {
  isChartShape,
  isChecklistShape,
  isLegendShape,
  isLineShape,
  type Element,
} from '@livediagram/document';
import type { RowsEditorKind } from '@liveworkspace/workbench/components/dialogs/ElementRowsDialog';
import type { KindEditor } from '@/components/canvas/element-kind-tools';
import { webRowsTitle } from '@/components/palette/context-menu-web-editors';

// The Canvas props for changing what is on the canvas (EditorCanvasHost): the selection's actions, undo
// and redo, dragging, label and table edits, the element faces' own setters, and the arrow handles.
export function useEditCanvasProps({
  setPointerTip,
}: {
  setPointerTip: ReturnType<typeof usePointerNoteSetters>['setPointerTip'];
}) {
  const {
    activeTab,
    activeTabLocked,
    beginArrowBend,
    beginArrowScale,
    appendTableColumnSelected,
    appendTableRowSelected,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
    beginArrowTranslate,
    beginDrag,
    pressArmedAction,
    beginEdit,
    beginEndpointDrag,
    cancelEdit,
    canRedo,
    canUndo,
    commitLabel,
    commitTable,
    commitHeaderSize,
    deleteCurvePoint,
    deleteMultiSelected,
    deleteSelected,
    duplicateMultiSelected,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    editCursorAtEnd,
    editingId,
    exitFormatTool,
    followLink,
    formatSourceId,
    handleCanvasDoubleClick,
    isReadOnly,
    can,
    narrowMultiSelection,
    openActionPopover,
    openComments,
    openNote,
    redo,
    setExportOpen,
    setExportScope,
    setCodeEditOpenForId,
    setEntityFieldsOpenForId,
    setLineDataOpenForId,
    setRowsEditorOpenFor,
    setSankeyFlowsOpenForId,
    setSequenceOpenForId,
    setLinkPickerOpenForId,
    toggleChecklistItem,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setHeroCaptionLine,
    growMindNode,
    flowchartActions,
    entityActions,
    mindOutline,
    tidyMindMap,
    abandonMindNode,
    setTextAlignSelected,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    undo,
    drag,
  } = useEditorContext();
  // A free arrow's frame stands down while a handle reshapes it (arrow-bending.md).
  const reshapingArrowId =
    drag &&
    (drag.kind === 'arrow-bend' ||
      drag.kind === 'arrow-curve' ||
      drag.kind === 'arrow-elbow' ||
      drag.kind === 'arrow-endpoint')
      ? drag.arrowId
      : null;
  // Double-click on an element with its own edit dialog (docs/specs/009-elements/code-block.md,
  // docs/specs/009-elements/sankey.md): which dialog depends on the kind.
  const openEditDialog = (id: string) => {
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || el.type !== 'shape') return;
    if (el.shape === 'code-block') setCodeEditOpenForId(id);
    else if (el.shape === 'sankey' && canEditSankey(can, el)) setSankeyFlowsOpenForId(id);
    else if (el.shape === 'sequence' && canEditSequence(can, el)) setSequenceOpenForId(id);
  };
  // The element's own edit dialog, for its kind tool in the element menu's bar and the Quick Style panel
  // (docs/specs/008-canvas/element-menu-quick-bar.md "Kind tools"). A chart a sheet fills has no data to edit here.
  const kindEditor = (el: Element): KindEditor | null => {
    if (el.locked) return null;
    if (el.type === 'table')
      return { kind: 'table', open: () => setRowsEditorOpenFor({ id: el.id, kind: 'table' }) };
    if (el.type !== 'shape') return null;
    if (el.shape === 'entity')
      return { kind: 'fields', open: () => setEntityFieldsOpenForId(el.id) };
    if (el.shape === 'code-block') return { kind: 'code', open: () => setCodeEditOpenForId(el.id) };
    if (isLineShape(el.shape) && !el.chartSheetSource)
      return { kind: 'data', open: () => setLineDataOpenForId(el.id) };
    const rows = (kind: RowsEditorKind) => () => setRowsEditorOpenFor({ id: el.id, kind });
    if (isChartShape(el.shape) && !el.chartSheetSource)
      return { kind: 'data', open: rows('slices') };
    if (isChecklistShape(el.shape)) return { kind: 'checklist', open: rows('checklist') };
    if (isLegendShape(el.shape)) return { kind: 'legend', open: rows('legend') };
    if (el.shape === 'agenda') return { kind: 'segments', open: rows('segments') };
    // A stat row, a process, a header, a card's tags, a concept graphic: the dialog named for what it holds.
    const title = webRowsTitle(el);
    if (title) return { kind: 'rows', open: rows('web-rows'), label: `Edit ${title}` };
    if (el.shape === 'sankey' && canEditSankey(can, el))
      return { kind: 'flows', open: () => setSankeyFlowsOpenForId(el.id) };
    if (el.shape === 'sequence' && canEditSequence(can, el))
      return { kind: 'sequence', open: () => setSequenceOpenForId(el.id) };
    return null;
  };
  return {
    onDuplicateMultiSelected: duplicateMultiSelected,
    onDeleteMultiSelected: deleteMultiSelected,
    onToggleLockMultiSelected: toggleLockMultiSelected,
    onFilterMultiSelected: narrowMultiSelection,
    onExportMultiSelected: () => {
      setExportScope('selection');
      setExportOpen(true);
    },
    editingId: editingId,
    editCursorAtEnd: editCursorAtEnd,
    formatSourceId: formatSourceId,
    canUndo: canUndo && !activeTabLocked,
    canRedo: canRedo && !activeTabLocked,
    onUndo: undo,
    onRedo: redo,
    reshapingArrowId: reshapingArrowId,
    onBeginDrag: beginDrag,
    onPressArmedAction: pressArmedAction,
    onBeginEdit: beginEdit,
    onCommitLabel: commitLabel,
    onCommitTable: commitTable,
    onCommitHeaderSize: commitHeaderSize,
    onAddTableRow: appendTableRowSelected,
    onAddTableColumn: appendTableColumnSelected,
    onToggleChecklistItem: isReadOnly ? undefined : toggleChecklistItem,
    onSetPageHeading: setPageHeading,
    onSetWebRows: isReadOnly ? undefined : setWebRows,
    onSetPointerTip: isReadOnly ? undefined : setPointerTip,
    onAppendWebRow: isReadOnly ? undefined : appendWebRowTo,
    onSetHeroCaptionLine: isReadOnly ? undefined : setHeroCaptionLine,
    onGrowMindNode: growMindNode,
    flowchartActions: isReadOnly ? undefined : flowchartActions,
    entityActions: isReadOnly ? undefined : entityActions,
    canEditMindOutline: mindOutline.canEdit,
    onEditMindOutline: mindOutline.open,
    onTidyMindMap: tidyMindMap,
    onAbandonMindNode: abandonMindNode,
    onCancelEdit: cancelEdit,
    onBeginEndpointDrag: beginEndpointDrag,
    onBeginArrowTranslate: beginArrowTranslate,
    onBeginArrowCurveDrag: beginArrowCurveDrag,
    onBeginArrowCurvePointDrag: beginArrowCurvePointDrag,
    onBeginArrowBend: beginArrowBend,
    onBeginArrowScale: beginArrowScale,
    onDeleteCurvePoint: deleteCurvePoint,
    onBeginArrowLabelDrag: beginArrowLabelDrag,
    onBeginArrowElbowDrag: beginArrowElbowDrag,
    onShiftSelect: toggleInMultiSelect,
    onExitFormatTool: exitFormatTool,
    onSetTextAlign: setTextAlignSelected,
    onFollowLink: followLink,
    onOpenComments: openComments,
    onOpenAction: openActionPopover,
    onOpenNote: openNote,
    onEditLink: isReadOnly ? undefined : setLinkPickerOpenForId,
    onOpenEditDialog: isReadOnly ? undefined : openEditDialog,
    kindEditor: isReadOnly ? undefined : kindEditor,
    onToggleAspectLock: toggleAspectLockSelected,
    onToggleLockSelected: toggleLockSelected,
    onDeleteSelected: deleteSelected,
    onDuplicateSelected: duplicateSelected,
    onBringSelectedToFront: stackSelectedFront,
    onSendSelectedToBack: stackSelectedBack,
    onCanvasDoubleClick: handleCanvasDoubleClick,
  } satisfies Partial<CanvasProps>;
}
