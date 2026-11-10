import { useEditorContext } from '@/app/design/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { usePointerNoteSetters } from '@/hooks/canvas/usePointerNoteSetters';
import { NO_DOUBLE_CLICK, NO_EDIT } from './inspect-gestures';
import { canEditSankey } from '@/lib/sankey-edit';
import { pagePaintPress } from '@liveworkspace/workbench/lib/format-page-brush';

// The Canvas props for changing what is on the canvas (EditorCanvasHost): the selection's actions, the
// page brush, undo and redo, dragging, label and table edits, the element faces' own setters, and the
// arrow handles.
export function useEditCanvasProps({
  setPointerTip,
  inspecting,
}: {
  setPointerTip: ReturnType<typeof usePointerNoteSetters>['setPointerTip'];
  inspecting: boolean;
}) {
  const {
    activeTab,
    activeTabLocked,
    formatConfig,
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
    canvasTool,
    commitLabel,
    commitTable,
    deleteCurvePoint,
    deleteMultiSelected,
    deleteSelected,
    duplicateMultiSelected,
    canCombine,
    combineSelected,
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
    setFormatSourceId,
    setLinkPickerOpenForId,
    toggleChecklistItem,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setHeroCaptionLine,
    setTextAlignSelected,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    undo,
    drag,
    pagesMode,
    componentActions,
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
    // An instance opens its edit session (docs/specs/009-elements/components.md "Editing the main").
    if (el.shape === 'instance') componentActions.startEdit(id);
    else if (el.shape === 'code-block') setCodeEditOpenForId(id);
    else if (el.shape === 'sankey' && canEditSankey(can, el)) setSankeyFlowsOpenForId(id);
  };
  return {
    onDuplicateMultiSelected: duplicateMultiSelected,
    canCombine: canCombine,
    onCombine: (op) => void combineSelected(op),
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
    onFormatPagePress:
      canvasTool === 'format' && pagesMode?.edit
        ? (pageId) => {
            // A page's background as the brush, painted page to page (docs/specs/007-editor/
            // pages-mode.md "Copying a background").
            // A brush whose page has gone is emptied as the page goes (useDeadPageBrush), so this
            // press arms the pressed page at once.
            const press = pagePaintPress(formatSourceId, pageId, formatConfig.mode === 'keep');
            // A refused paint (a locked page, a picture onto a logo page) keeps the brush:
            // only a paint empties a Paint once brush.
            if (press.paint && !pagesMode.edit?.copyBackground(press.paint.from, press.paint.to))
              return;
            if (press.next !== formatSourceId) setFormatSourceId(press.next);
          }
        : undefined,
    canUndo: canUndo && !activeTabLocked,
    canRedo: canRedo && !activeTabLocked,
    onUndo: undo,
    onRedo: redo,
    reshapingArrowId: reshapingArrowId,
    onBeginDrag: beginDrag,
    onPressArmedAction: pressArmedAction,
    onBeginEdit: inspecting ? NO_EDIT : beginEdit,
    onCommitLabel: commitLabel,
    onCommitTable: commitTable,
    onAddTableRow: appendTableRowSelected,
    onAddTableColumn: appendTableColumnSelected,
    onToggleChecklistItem: isReadOnly ? undefined : toggleChecklistItem,
    onSetPageHeading: setPageHeading,
    onSetWebRows: isReadOnly ? undefined : setWebRows,
    onSetPointerTip: isReadOnly ? undefined : setPointerTip,
    onAppendWebRow: isReadOnly ? undefined : appendWebRowTo,
    onSetHeroCaptionLine: isReadOnly ? undefined : setHeroCaptionLine,
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
    onCanvasDoubleClick: inspecting ? NO_DOUBLE_CLICK : handleCanvasDoubleClick,
  } satisfies Partial<CanvasProps>;
}
