'use client';

import {
  usePublishTabName,
  usePublishTabRename,
} from '@liveworkspace/workbench/hooks/editor/active-tab-name-store';
import { useRef } from 'react';
import { type Tab } from '@livehuddle/document';
import { useDocumentActions } from '@/hooks/canvas/useDocumentActions';
import { useBurstCheckpoint } from '@liveworkspace/workbench/hooks/canvas/useBurstCheckpoint';
import { track } from '@/lib/telemetry';
import { useApplyStyleToAllTabs } from '@liveworkspace/workbench/hooks/editor/useApplyStyleToAllTabs';
import { withStyleOfTab } from '@/lib/tab-theme-apply';
import { useTabActions } from '@/hooks/persistence/useTabActions';
import { useTabFolders } from '@/hooks/persistence/useTabFolders';
import { useTabCanvas } from '@/hooks/canvas/useTabCanvas';
import { markNameConfirmed } from '@/lib/local-identity';
import { apiSaveTab } from '@/lib/api-client';
import { documentGrant } from '@/lib/api/document-grants';
import { getSessionSharePassword } from '@/lib/api/core';
import { useConnectedTabActions } from '@liveworkspace/workbench/components/connect/useConnectedTabActions';
import { createTab } from '../editor-page-helpers';
import { useTemplateFlow } from '../useTemplateFlow';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorModesSlice } from './useEditorModes';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorFollowingSlice } from './useEditorFollowing';
import type { EditorEditingSlice } from './useEditorEditing';

// Tab and document lifecycle: tab actions, connected tabs, folders, document actions, the template flow, and the
// tab's canvas look. A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it
// and returns its own, with `view`, its part of the editor's view-model.
export function useEditorTabs({
  fromDocument,
  fromHistory,
  fromSelection,
  fromCollaboration,
  fromPersistence,
  fromRoom,
  fromComments,
  fromModes,
  fromViewport,
  fromFollowing,
  fromEditing,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromRoom: EditorRoomSlice;
  fromComments: EditorCommentsSlice;
  fromModes: EditorModesSlice;
  fromViewport: EditorViewportSlice;
  fromFollowing: EditorFollowingSlice;
  fromEditing: EditorEditingSlice;
}) {
  const {
    confirm,
    documentId,
    loadedTabIdsRef,
    markTabLoaded,
    nameConfirmed,
    selfParticipant,
    setNameConfirmed,
    setSelfParticipant,
    toast,
  } = fromDocument;
  const { commitTabs, markCheckpoint, tabs, tickTabs } = fromHistory;
  const {
    activeId,
    setActiveId,
    setEditingId,
    setFormatSourceId,
    setIdentityPromptOpen,
    setSelectedId,
  } = fromSelection;
  const { copying, isStructureReadOnly, sessionShareCode, setCopying } = fromCollaboration;
  const { documentList, documentName, refreshDocumentList, setDocumentName, setImportError } =
    fromPersistence;
  const { loadAllTabs } = fromRoom;
  const { activeTab } = fromComments;
  const { openWalking } = fromModes;
  const { getViewportCenter } = fromViewport;
  const { requestFit } = fromFollowing;
  const { commit, structureBlocked } = fromEditing;
  // --- Tab actions ---------------------------------------------------------

  // Tab-lifecycle actions (add / import / rename / duplicate / delete /
  // reorder, link-into-document, clear content). They
  // touch history, selection, telemetry, confirm / toast and the
  // document list; see
  // useTabActions. Document-level lifecycle + the template flow stay in
  // the page below.
  const {
    addTab,
    importIntoActiveTab,
    importTextIntoActiveTab,
    renameTab,
    linkActiveTabTo,
    duplicateTab,
    deleteTab,
    reorderTabs,
    clearTabContent,
  } = useTabActions({
    tabs,
    activeId,
    canEditStructure: !isStructureReadOnly,
    documentList,
    ownerId: selfParticipant.id,
    documentId,
    createTab,
    commit,
    commitTabs,
    markTabLoaded,
    isTabLoaded: (id: string) => loadedTabIdsRef.current.has(id),
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setImportError,
    requestFit,
    refreshDocumentList: () => refreshDocumentList(),
    confirm,
    toast,
  });
  // Connected tabs (liveworkspace/docs/specs/004-index/connected-tabs.md): the Connect list's add and the move to the new
  // tab, the host's grant for opening one, and Connect Again.
  const connectedTabs = useConnectedTabActions({
    tabs,
    hostKind: 'space',
    hostId: documentId,
    // The share code and its password, as the room asks with: a renewal without the password is refused.
    grantFor: async (id) =>
      (
        await documentGrant(
          id,
          sessionShareCode ? { code: sessionShareCode, password: getSessionSharePassword() } : null,
        )
      )?.grant ?? null,
    createTab,
    saveTab: (tab) => apiSaveTab(selfParticipant.id, documentId ?? '', tab, sessionShareCode),
    commitTabs,
    markTabLoaded,
    openTab: (id) => {
      setActiveId(id);
      setSelectedId(null);
      setEditingId(null);
    },
    toast,
  });
  // The menu box shows the open tab's name, and renames it on a click (active-tab-name-store).
  usePublishTabName(activeTab.name);
  usePublishTabRename(activeId, renameTab, !isStructureReadOnly);

  // Tab-folder membership (docs/specs/006-document/tab-folders.md), kept separate from the busy
  // useTabActions. Menu-only: drag-reorder lives above.
  const {
    moveTabToFolder,
    removeTabFromFolder,
    renameFolder: renameTabFolder,
  } = useTabFolders({
    tabs,
    commitTabs,
  });

  // Document-level lifecycle + navigation (delete / duplicate /
  // move-to-folder / delete-folder, and the new / open / make-a-copy
  // full-page-load helpers). Operates on whole documents + the Explorer
  // list, distinct from per-tab lifecycle in useTabActions. See
  // useDocumentActions.
  const { deleteDocument, newDocument, openDocument, makeCopy } = useDocumentActions({
    documentId,
    documentName,
    confirm,
    copying,
    setCopying,
    sessionShareCode,
  });

  // Mark the participant's name as "confirmed" — they explicitly
  // dismissed at least one modal that prompted for it. Persisted in
  // localStorage so a returning visitor isn't re-prompted, and clears
  // the in-memory flag so the modal closes immediately.
  const confirmName = () => {
    // Welcome / identity-only modal is dismissed by confirming the
    // user's name. The closure check on the previous state means we
    // only emit on the transition, not every render that re-runs
    // this callback after the welcome flow.
    const wasOpen = !nameConfirmed;
    markNameConfirmed();
    setNameConfirmed(true);
    if (wasOpen) track('UI', 'Closed', 'Welcome');
  };

  // Name the open document: its own name, and its row in the Explorer panel's in-memory list, which would otherwise
  // show the old name until a reload (autosave persists the name). Shared by the header's rename and a template naming
  // a still-untitled document after itself.
  const nameDocument = (name: string) => {
    setDocumentName(name);
  };

  // Template and identity actions. See useTemplateFlow. confirmName
  // stays in the page (also wired into useShareLinks) and is passed in.
  // The draw slice comes later in this hook, so the template flow reaches its cancel through a ref.
  const putToolDownRef = useRef<() => void>(() => {});
  const { chooseTemplate, confirmIdentity, cancelIdentity } = useTemplateFlow({
    activeId,
    tabs,
    selfParticipant,
    documentName,
    nameDocument,
    getViewportCenter,
    commitTabs,
    confirmName,
    setSelectedId,
    setEditingId,
    setSelfParticipant,
    setIdentityPromptOpen,
    requestFit,
    putToolDown: () => putToolDownRef.current(),
    onLanded: openWalking.rejudge,
    markTabLoaded,
  });

  // One undo step per burst of a continuous control: the background
  // sliders (useTabCanvas) and the element colour / opacity pickers
  // (useElementStyle). See useBurstCheckpoint.
  const checkpointBurst = useBurstCheckpoint(markCheckpoint);

  // Tab-level appearance + layout actions (theme switch, background
  // pattern / colour / opacity / pattern-colour, reset-to-theme,
  // auto-align). All mutate the active tab; see useTabCanvas.
  const {
    autoAlignTab,
    setTabFinish,
    applyTabLook,
    setTabFont,
    setTabDefaultTextSize,
    setBackgroundPattern,
    setTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
    setBackgroundPatternScale,
  } = useTabCanvas({
    notify: (message) => toast.info(message),
    editsBlocked: structureBlocked,
    activeId,
    activeTab,
    commit,
    commitTabs,
    tickTabs,
    checkpointBurst,
  });

  // Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md): the open tab's style on every tab, as one
  // undo step, an Editor's of the whole document only.
  const { applyToAllTabs: applyStyleToAllTabs, applying: applyingStyleToAllTabs } =
    useApplyStyleToAllTabs<Tab>({
      canApply: !structureBlocked && !isStructureReadOnly,
      activeId,
      loadAllTabs,
      isTabLoaded: (id) => loadedTabIdsRef.current.has(id),
      commitTabs,
      restyle: withStyleOfTab,
      notify: (message) => toast.info(message),
      onApplied: () => track('Tab', 'Changed', 'AllTabs'),
    });
  return {
    checkpointBurst,
    openDocument,
    putToolDownRef,
    view: {
      connectedTabs,
      addTab,
      autoAlignTab,
      setTabFinish,
      applyTabLook,
      applyStyleToAllTabs,
      applyingStyleToAllTabs,
      chooseTemplate,
      clearTabContent,
      deleteDocument,
      deleteTab,
      duplicateTab,
      importIntoActiveTab,
      importTextIntoActiveTab,
      linkActiveTabTo,
      makeCopy,
      newDocument,
      openDocument,
      renameTab,
      renameTabFolder,
      moveTabToFolder,
      removeTabFromFolder,
      reorderTabs,
      setBackgroundColor,
      setBackgroundOpacity,
      setBackgroundPatternScale,
      setBackgroundPattern,
      setTabFont,
      setTabDefaultTextSize,
      setPatternColor,
      setTheme,
      confirmIdentity,
      cancelIdentity,
      nameDocument,
    },
  };
}

export type EditorTabsSlice = ReturnType<typeof useEditorTabs>;
