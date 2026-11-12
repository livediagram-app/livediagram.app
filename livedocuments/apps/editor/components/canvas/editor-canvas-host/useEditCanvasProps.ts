import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { usePointerNoteSetters } from '@/hooks/canvas/usePointerNoteSetters';

// The Canvas props for working on what is there (EditorCanvasHost): dragging and editing elements,
// their labels and tables, the arrows' handles, and the per-kind setters a face calls.
export function useEditCanvasProps({
  setPointerTip,
}: {
  // A pointer note's tip handle (docs/specs/009-elements/pointer-note.md).
  setPointerTip: ReturnType<typeof usePointerNoteSetters>['setPointerTip'];
}) {
  const {
    appendTableColumnSelected,
    appendTableRowSelected,
    beginArrowBend,
    beginArrowScale,
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
    commitLabel,
    commitTable,
    deleteCurvePoint,
    isReadOnly,
    toggleChecklistItem,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setHeroCaptionLine,
  } = useEditorContext();
  return {
    onBeginDrag: beginDrag,
    onPressArmedAction: pressArmedAction,
    onBeginEdit: beginEdit,
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
  };
}
