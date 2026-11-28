'use client';

import { usePortalSetters } from '@/hooks/canvas/usePortalSetters';
import { useElementStyle } from '@/hooks/canvas/useElementStyle';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorActiveTabSlice } from './useEditorActiveTab';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorTabsSlice } from './useEditorTabs';

// Styling the selection: the style setters and the portal setters.
// A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own,
// with `view`, its part of the editor's view-model.
export function useEditorStyle({
  fromDocument,
  fromHistory,
  fromSelection,
  fromDialogs,
  fromActiveTab,
  fromEditing,
  fromTabs,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromActiveTab: EditorActiveTabSlice;
  fromEditing: EditorEditingSlice;
  fromTabs: EditorTabsSlice;
}) {
  const { toast } = fromDocument;
  const { commitTabs, tabs } = fromHistory;
  const { activeId, readSelection, setSelectedId } = fromSelection;
  const { contextMenu } = fromDialogs;
  const { activeTab } = fromActiveTab;
  const {
    currentSelectionIds,
    editsBlocked,
    rememberingCommit,
    rememberingTickTabs,
    selectionPrimary,
  } = fromEditing;
  const { checkpointBurst } = fromTabs;
  // The element setters the canvas, Search and the element menu still reach (aspect lock, size, text align,
  // markers, the Space pieces' settings, clearing animations). All mutate the current selection; see
  // useElementStyle. The looks, layer and opacity setters left with the menu's Appearance and Arrange
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Element looks, layers, opacity and rotation").
  const {
    toggleAspectLockSelected,
    setTextAlignSelected,
    resetAspectRatioSelected,
    setSizeSelected,
    setMarkerSelected,
    setChairFacingSelected,
    turnSelected,
    setRoomDoorSelected,
    setRoomWallsSelected,
    setRoomFloorSelected,
    setRoomFloorColourSelected,
    setPieceTypeSelected,
    setStageSelected,
    setScreenSourceSelected,
    setScreenSourceOf,
    setPadReceptionistSelected,
    setPadReceptionistOf,
    setJukeboxSourceSelected,
    clearAnimationsSelected,
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
    notify: toast.info,
  });

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

  return {
    view: {
      setMarkerSelected,
      setChairFacingSelected,
      turnSelected,
      setRoomDoorSelected,
      setRoomWallsSelected,
      setRoomFloorSelected,
      setRoomFloorColourSelected,
      setPieceTypeSelected,
      setStageSelected,
      setScreenSourceSelected,
      setScreenSourceOf,
      setPadReceptionistSelected,
      setPadReceptionistOf,
      setJukeboxSourceSelected,
      setPortalTargetSelected,
      setPortalNameSelected,
      createLinkedPortal,
      clearAnimationsSelected,
      resetAspectRatioSelected,
      setSizeSelected,
      setTextAlignSelected,
      toggleAspectLockSelected,
    },
  };
}

export type EditorStyleSlice = ReturnType<typeof useEditorStyle>;
