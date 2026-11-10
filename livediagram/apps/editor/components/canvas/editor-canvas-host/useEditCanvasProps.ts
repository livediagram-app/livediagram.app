import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { usePointerNoteSetters } from '@/hooks/canvas/usePointerNoteSetters';
import { canEditSankey } from '@/lib/sankey-edit';
import { canEditSequence } from '@/lib/sequence-edit';

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
    onToggleAspectLock: toggleAspectLockSelected,
    onToggleLockSelected: toggleLockSelected,
    onDeleteSelected: deleteSelected,
    onDuplicateSelected: duplicateSelected,
    onBringSelectedToFront: stackSelectedFront,
    onSendSelectedToBack: stackSelectedBack,
    onCanvasDoubleClick: handleCanvasDoubleClick,
  } satisfies Partial<CanvasProps>;
}
