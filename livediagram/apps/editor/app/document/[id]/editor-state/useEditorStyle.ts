'use client';

import type { QuickStyleDeps } from '@/hooks/canvas/useQuickStyle';
import { usePortalSetters } from '@/hooks/canvas/usePortalSetters';
import { useElementStyle } from '@/hooks/canvas/useElementStyle';
import { useStylePreview } from '@/hooks/canvas/useStylePreview';
import { useCleanupPreview } from '@/hooks/canvas/useCleanupPreview';
import { useFlowchartSetters } from '@/hooks/canvas/useFlowchartSetters';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorModesSlice } from './useEditorModes';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorLayersSlice } from './useEditorLayers';
import type { EditorTabsSlice } from './useEditorTabs';
import type { EditorCreationSlice } from './useEditorCreation';

// Styling the selection: the style setters, flowchart setters, Quick Style, portal setters, and the hover
// previews. A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it and returns
// its own, with `view`, its part of the editor's view-model.
export function useEditorStyle({
  fromDocument,
  fromHistory,
  fromSelection,
  fromDialogs,
  fromCollaboration,
  fromPersistence,
  fromRoom,
  fromComments,
  fromModes,
  fromEditing,
  fromLayers,
  fromTabs,
  fromCreation,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromRoom: EditorRoomSlice;
  fromComments: EditorCommentsSlice;
  fromModes: EditorModesSlice;
  fromEditing: EditorEditingSlice;
  fromLayers: EditorLayersSlice;
  fromTabs: EditorTabsSlice;
  fromCreation: EditorCreationSlice;
}) {
  const { previewingRef, toast } = fromDocument;
  const { commitTabs, tabs, tickTabs } = fromHistory;
  const { activeId, readSelection, setSelectedId } = fromSelection;
  const { contextMenu } = fromDialogs;
  const { participant } = fromCollaboration;
  const { tabsRef } = fromPersistence;
  const { facilitator } = fromRoom;
  const { activeTab } = fromComments;
  const { drawMode } = fromModes;
  const {
    activeTheme,
    commit,
    commitActiveTab,
    editsBlocked,
    liveActiveElements,
    rememberingCommit,
    rememberingTickTabs,
    structureBlocked,
    styleMemory,
  } = fromEditing;
  const { currentSelectionIds, selectionPrimary } = fromLayers;
  const { checkpointBurst } = fromTabs;
  const { highlighter, pendingDraw, swatchOverrides, whiteboardDock } = fromCreation;
  // Element styling / layering actions (lock, layer order, text size /
  // align / style, fill / stroke / text colour, opacity, padding, the
  // arrow + border presets, shape-kind morph, reset-to-theme). All
  // mutate the current selection; see useElementStyle.
  const {
    toggleLockSelected,
    toggleAspectLockSelected,
    bringSelectedToFront,
    sendSelectedToBack,
    setTextSizeSelected,
    setTextAlignSelected,
    setLaneUprightTitleSelected,
    setFontSelected,
    toggleTextStyleSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setOpacitySelected,
    setShadowSelected,
    setPaddingSelected,
    setIconSizeSelected,
    setArrowEndsSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    setHeaderFillSelected,
    burstSelectedStyle,
    setArrowheadColorSelected,
    setLabelFillSelected,
    setTableHeaderTextColorSelected,
    setArrowStyleSelected,
    setArrowStrokeStyleSelected,
    setArrowRouteBehindSelected,
    setArrowExactStartSelected,
    setShapeKindSelected,
    resetAspectRatioSelected,
    setSizeSelected,
    setRotationSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setBorderRadiusSelected,
    setMarkerSelected,
    setMarkerSizeSelected,
    appendTableRowSelected,
    appendTableColumnSelected,
    setCodeSelected,
    setCodeWrapSelected,
    setLegendItemsSelected,
    setMindFlowSelected,
    setMindSpacingSelected,
    tidyMindMapSelected,
    tidyMindMap,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setWebRowsSelected,
    setHeroCaptionLine,
    setHeroCaptionSelected,
    setChecklistItemsSelected,
    setEntityFieldsSelected,
    setEstimateScaleSelected,
    setAgendaItemsSelected,
    setDecisionStatusSelected,
    setDecisionDateSelected,
    setDecisionDriversSelected,
    setButtonModeSelected,
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartValuesSelected,
    setChartAxisSelected,
    setChartRightAxisSelected,
    setChartLegendPositionSelected,
    setChartTypeSelected,
    setLineDataSelected,
    sankey,
    sequence,
    resetShapeStyleSelected,
    resetArrowStyleSelected,
    clearAnimationsSelected,
    setArrowFlowSelected,
    setIconAnimationSelected,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setSetAnimationSpeedSelected,
    setFlowSpeedSelected,
    setSetAnimationRepeatSelected,
    setIconAnimationRepeatSelected,
    setFlowRepeatSelected,
    resetColorsSelected,
  } = useElementStyle({
    currentSelectionIds,
    selectionPrimary,
    readSelection,
    activeTab,
    activeId,
    editsBlocked,
    // Every style setter the context menu reaches records into style memory.
    commit: rememberingCommit,
    commitActiveTab,
    tickTabs: rememberingTickTabs,
    checkpointBurst,
    notify: (tone, message) => toast[tone](message),
  });

  // The flowchart's step type, direction, lanes and Tidy (docs/specs/009-elements/flowchart.md): one
  // bundle the step toolbar and the Flowchart menu section read from the editor context.
  const flowchartActions = useFlowchartSetters({
    currentSelectionIds,
    commitActiveTab,
    elements: () => activeTab.elements,
    editsBlocked,
    notify: (tone, message) => toast[tone](message),
  });

  // The quick style panel (docs/specs/008-canvas/quick-style-panel.md): its view of the selection and one
  // action per choice. The panel itself decides where and whether it shows.
  // Every input of the Quick Style view but the selection, which QuickStyleHost reads from the store.
  const quickStyleDeps: QuickStyleDeps = {
    activeTab,
    drawMode,
    theme: activeTheme,
    editsBlocked: structureBlocked,
    canStyle: participant.participating ? participant.can.recolour : undefined,
    liveElements: liveActiveElements,
    commit,
    memory: styleMemory,
    swatchOverrides,
    pen: {
      held: whiteboardDock.tool === 'pen' ? whiteboardDock.activePen : null,
      update: whiteboardDock.updatePen,
    },
    highlighter,
    toolIntent: pendingDraw,
  };

  // Portal links (docs/specs/009-elements/portal-element.md) live off the style hook: a link can point at a
  // portal on ANOTHER tab, so these setters need the whole tab list and a
  // tabs-wide commit rather than the active tab's element mapper.
  const {
    setPortalTargetSelected,
    setPortalNameSelected,
    createLinkedPortal,
    setSessionConfigSelected,
    setRevealedSelected,
    setPickerSourceSelected,
    setReactionSelected,
    setPickerOptionsSelected,
  } = usePortalSetters({
    currentSelectionIds,
    contextTargetId: contextMenu?.mode === 'element' ? contextMenu.elementId : null,
    commitTabs,
    tabs,
    activeId,
    setSelectedId,
    sessionToolsBlocked: facilitator.sessionToolsBlocked,
  });

  // Hover-to-preview for the style-preset tiles (docs/specs/010-palette/style-presets.md): hovering a preset on
  // a desktop pointer shows it live; the change only sticks on click. See
  // useStylePreview — preview/revert go through tickTabs (no history), the
  // commit restores the original first so undo snapshots the true pre-hover
  // state.
  const {
    clearPreview: clearStylePreview,
    previewElementStyle,
    commitElementStyle,
    previewShapeColorPreset,
    commitShapeColorPreset,
    previewArrowPreset,
    commitArrowPreset,
    previewSetAnimation,
    commitSetAnimation,
    previewArrowFlow,
    commitArrowFlow,
    previewIconAnimation,
    commitIconAnimation,
    previewFillColor,
    previewCodeTheme,
    commitCodeTheme,
    previewTablePreset,
    commitTablePreset,
    previewChartPalette,
    commitChartPalette,
    previewLabelFill,
    commitLabelFill,
    previewHeaderFill,
    previewArrowheadColor,
    commitFillColor,
    commitHeaderFill,
    commitArrowheadColor,
    previewStrokeColor,
    commitStrokeColor,
    previewTextColor,
    commitTextColor,
    previewBorderStroke,
    commitBorderStroke,
    previewBorderStyle,
    commitBorderStyle,
    previewBorderRadius,
    commitBorderRadius,
    previewShadow,
    commitShadow,
    previewFinish,
    commitFinish,
    previewRotation,
    commitRotation,
    previewShapeKind,
    commitShapeKind,
    previewIconSize,
    commitIconSize,
    previewIconWeight,
    commitIconWeight,
    previewMarker,
    commitMarker,
    previewMarkerSize,
    commitMarkerSize,
    previewTextAlign,
    commitTextAlign,
    previewTextSize,
    commitTextSize,
    previewFont,
    commitFont,
    previewPadding,
    commitPadding,
    previewInlineIcon,
    commitInlineIcon,
  } = useStylePreview({
    editsBlocked,
    activeId,
    currentSelectionIds,
    tabsRef,
    tickTabs,
    commitTabs,
    previewingRef,
    onCommitted: styleMemory.recordEdit,
  });

  // The same idea one level up (docs/specs/008-canvas/layout-cleanup.md "Hover to see it first"):
  // hovering a Tidy Up tile lays the whole tab out behind the popover, and it only sticks on press.
  const { previewCleanup, endCleanupPreview, assessCleanupKind } = useCleanupPreview({
    editsBlocked: structureBlocked,
    activeId,
    tabsRef,
    tickTabs,
    previewingRef,
  });
  return {
    bringSelectedToFront,
    sendSelectedToBack,
    toggleLockSelected,
    view: {
      quickStyleDeps,
      previewCleanup,
      endCleanupPreview,
      assessCleanupKind,
      bringSelectedToFront,
      resetColorsSelected,
      // Style-preset hover preview + click commit (docs/specs/010-palette/style-presets.md).
      clearStylePreview,
      previewElementStyle,
      commitElementStyle,
      previewShapeColorPreset,
      commitShapeColorPreset,
      previewArrowPreset,
      commitArrowPreset,
      previewSetAnimation,
      commitSetAnimation,
      previewArrowFlow,
      commitArrowFlow,
      previewIconAnimation,
      commitIconAnimation,
      // Granular colour / border / rotation hover preview + click commit.
      previewFillColor,
      previewCodeTheme,
      commitCodeTheme,
      previewTablePreset,
      commitTablePreset,
      previewChartPalette,
      commitChartPalette,
      previewLabelFill,
      commitLabelFill,
      previewHeaderFill,
      previewArrowheadColor,
      commitFillColor,
      commitHeaderFill,
      commitArrowheadColor,
      previewStrokeColor,
      commitStrokeColor,
      previewTextColor,
      commitTextColor,
      previewBorderStroke,
      commitBorderStroke,
      previewBorderStyle,
      commitBorderStyle,
      previewBorderRadius,
      commitBorderRadius,
      previewShadow,
      commitShadow,
      previewFinish,
      commitFinish,
      previewRotation,
      commitRotation,
      previewShapeKind,
      commitShapeKind,
      previewIconSize,
      commitIconSize,
      previewIconWeight,
      commitIconWeight,
      previewMarker,
      commitMarker,
      previewMarkerSize,
      commitMarkerSize,
      previewTextAlign,
      commitTextAlign,
      previewTextSize,
      commitTextSize,
      previewFont,
      commitFont,
      previewPadding,
      commitPadding,
      previewInlineIcon,
      commitInlineIcon,
      sendSelectedToBack,
      setArrowEndsSelected,
      setArrowStrokeStyleSelected,
      setArrowRouteBehindSelected,
      setArrowExactStartSelected,
      setArrowStyleSelected,
      setArrowThicknessSelected,
      setArrowheadSizeSelected,
      setArrowheadShapeSelected,
      setTableHeaderRowSelected,
      setTableHeaderColumnSelected,
      setTableZebraSelected,
      setHeaderFillSelected,
      burstSelectedStyle,
      setArrowheadColorSelected,
      setLabelFillSelected,
      setTableHeaderTextColorSelected,
      setBorderRadiusSelected,
      setBorderStrokeSelected,
      setBorderStyleSelected,
      setMarkerSelected,
      setMarkerSizeSelected,
      appendTableRowSelected,
      appendTableColumnSelected,
      setCodeSelected,
      setCodeWrapSelected,
      setLegendItemsSelected,
      setMindFlowSelected,
      setMindSpacingSelected,
      tidyMindMapSelected,
      tidyMindMap,
      setPageHeading,
      setWebRows,
      appendWebRowTo,
      setWebRowsSelected,
      setHeroCaptionLine,
      setHeroCaptionSelected,
      flowchartActions,
      setChecklistItemsSelected,
      setEntityFieldsSelected,
      setEstimateScaleSelected,
      setAgendaItemsSelected,
      setDecisionStatusSelected,
      setDecisionDateSelected,
      setDecisionDriversSelected,
      setButtonModeSelected,
      setPortalTargetSelected,
      setPortalNameSelected,
      createLinkedPortal,
      setSessionConfigSelected,
      setRevealedSelected,
      setPickerSourceSelected,
      setReactionSelected,
      setPickerOptionsSelected,
      setRatingSelected,
      setRatingAnimSelected,
      setRatingAnimSpeedSelected,
      setRatingAnimRepeatSelected,
      setPieDataSelected,
      setPieAnimSelected,
      setPieAnimSpeedSelected,
      setPieAnimRepeatSelected,
      setChartLegendSelected,
      setChartValuesSelected,
      setChartAxisSelected,
      setChartRightAxisSelected,
      setChartLegendPositionSelected,
      setChartTypeSelected,
      setLineDataSelected,
      sankey,
      sequence,
      resetShapeStyleSelected,
      resetArrowStyleSelected,
      clearAnimationsSelected,
      setArrowFlowSelected,
      setIconAnimationSelected,
      setIconAnimationSpeedSelected,
      setProgressSelected,
      setProgressAnimSelected,
      setProgressAnimSpeedSelected,
      setProgressAnimRepeatSelected,
      setSetAnimationSpeedSelected,
      setFlowSpeedSelected,
      setSetAnimationRepeatSelected,
      setIconAnimationRepeatSelected,
      setFlowRepeatSelected,
      setFillColorSelected,
      setOpacitySelected,
      setShadowSelected,
      setPaddingSelected,
      setIconSizeSelected,
      setShapeKindSelected,
      resetAspectRatioSelected,
      setSizeSelected,
      setRotationSelected,
      setStrokeColorSelected,
      setFontSelected,
      setTextAlignSelected,
      setLaneUprightTitleSelected,
      setTextColorSelected,
      setTextSizeSelected,
      toggleAspectLockSelected,
      toggleLockSelected,
      toggleTextStyleSelected,
    },
  };
}

export type EditorStyleSlice = ReturnType<typeof useEditorStyle>;
