'use client';

import type { QuickStyleDeps } from '@/hooks/canvas/useQuickStyle';
import { usePortalSetters } from '@/hooks/canvas/usePortalSetters';
import { useElementStyle } from '@/hooks/canvas/useElementStyle';
import { useStylePreview } from '@/hooks/canvas/useStylePreview';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorTabsSlice } from './useEditorTabs';
import type { EditorCreationSlice } from './useEditorCreation';

// Styling the selection: the style setters, Quick Style's Clear Styles, portal setters, and the hover previews.
// A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own,
// with `view`, its part of the editor's view-model.
export function useEditorStyle({
  fromDocument,
  fromHistory,
  fromSelection,
  fromDialogs,
  fromCollaboration,
  fromPersistence,
  fromComments,
  fromEditing,
  fromTabs,
  fromCreation,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromComments: EditorCommentsSlice;
  fromEditing: EditorEditingSlice;
  fromTabs: EditorTabsSlice;
  fromCreation: EditorCreationSlice;
}) {
  const { previewingRef } = fromDocument;
  const { commitTabs, tabs, tickTabs } = fromHistory;
  const { activeId, readSelection, setSelectedId } = fromSelection;
  const { contextMenu } = fromDialogs;
  const { participant } = fromCollaboration;
  const { tabsRef } = fromPersistence;
  const { activeTab } = fromComments;
  const {
    activeTheme,
    commit,
    currentSelectionIds,
    editsBlocked,
    liveActiveElements,
    rememberingCommit,
    rememberingTickTabs,
    selectionPrimary,
    structureBlocked,
    styleMemory,
  } = fromEditing;
  const { checkpointBurst } = fromTabs;
  const { swatchOverrides } = fromCreation;
  // Element styling / layering actions (layer order, text size /
  // align / style, fill / stroke / text colour, opacity, padding, the
  // arrow + border presets, shape-kind morph, reset-to-theme). All
  // mutate the current selection; see useElementStyle.
  const {
    toggleAspectLockSelected,
    bringSelectedToFront,
    sendSelectedToBack,
    setTextSizeSelected,
    setTextAlignSelected,
    setFontSelected,
    toggleTextStyleSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setOpacitySelected,
    setShadowSelected,
    setPaddingSelected,
    setIconSizeSelected,
    burstSelectedStyle,
    setShapeKindSelected,
    resetAspectRatioSelected,
    setSizeSelected,
    setRotationSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setBorderRadiusSelected,
    setMarkerSelected,
    setMarkerSizeSelected,
    setChairFacingSelected,
    turnSelected,
    setRoomDoorSelected,
    setRoomWallsSelected,
    setStageSelected,
    setScreenUrlSelected,
    setScreenUrlOf,
    setPadReceptionistSelected,
    setPadReceptionistOf,
    setClockZonesSelected,
    setJukeboxSourceSelected,
    resetShapeStyleSelected,
    clearAnimationsSelected,
    setIconAnimationSelected,
    setIconAnimationSpeedSelected,
    setSetAnimationSpeedSelected,
    setSetAnimationRepeatSelected,
    setIconAnimationRepeatSelected,
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
    tickTabs: rememberingTickTabs,
    checkpointBurst,
  });

  // The Quick Style view (docs/specs/008-canvas/element-menu-quick-bar.md): what the quick bar's Clear Styles resets.
  // livehuddle has no Quick Style panel (docs/specs/002-project-scope/not-in-livehuddle.md#quick-style).
  // Every input of the Quick Style view but the selection, which ClearStylesHost reads from the store.
  const quickStyleDeps: QuickStyleDeps = {
    activeTab,
    theme: activeTheme,
    editsBlocked: structureBlocked,
    canStyle: participant.participating ? participant.can.recolour : undefined,
    liveElements: liveActiveElements,
    commit,
    memory: styleMemory,
    swatchOverrides,
  };

  // Portal links (docs/specs/009-elements/portal-element.md) live off the style hook: a link can point at a
  // portal on ANOTHER tab, so these setters need the whole tab list and a
  // tabs-wide commit rather than the active tab's element mapper.
  const { setPortalTargetSelected, setPortalNameSelected, createLinkedPortal } = usePortalSetters({
    currentSelectionIds,
    contextTargetId: contextMenu?.mode === 'element' ? contextMenu.elementId : null,
    commitTabs,
    tabs,
    activeId,
    setSelectedId,
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
    previewSetAnimation,
    commitSetAnimation,
    previewIconAnimation,
    commitIconAnimation,
    previewFillColor,
    commitFillColor,
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
  return {
    bringSelectedToFront,
    sendSelectedToBack,
    view: {
      quickStyleDeps,
      bringSelectedToFront,
      resetColorsSelected,
      // Style-preset hover preview + click commit (docs/specs/010-palette/style-presets.md).
      clearStylePreview,
      previewElementStyle,
      commitElementStyle,
      previewShapeColorPreset,
      commitShapeColorPreset,
      previewSetAnimation,
      commitSetAnimation,
      previewIconAnimation,
      commitIconAnimation,
      // Granular colour / border / rotation hover preview + click commit.
      previewFillColor,
      commitFillColor,
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
      burstSelectedStyle,
      setBorderRadiusSelected,
      setBorderStrokeSelected,
      setBorderStyleSelected,
      setMarkerSelected,
      setMarkerSizeSelected,
      setChairFacingSelected,
      turnSelected,
      setRoomDoorSelected,
      setRoomWallsSelected,
      setStageSelected,
      setScreenUrlSelected,
      setScreenUrlOf,
      setPadReceptionistSelected,
      setPadReceptionistOf,
      setClockZonesSelected,
      setJukeboxSourceSelected,
      setPortalTargetSelected,
      setPortalNameSelected,
      createLinkedPortal,
      resetShapeStyleSelected,
      clearAnimationsSelected,
      setIconAnimationSelected,
      setIconAnimationSpeedSelected,
      setSetAnimationSpeedSelected,
      setSetAnimationRepeatSelected,
      setIconAnimationRepeatSelected,
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
      setTextColorSelected,
      setTextSizeSelected,
      toggleAspectLockSelected,
      toggleTextStyleSelected,
    },
  };
}

export type EditorStyleSlice = ReturnType<typeof useEditorStyle>;
