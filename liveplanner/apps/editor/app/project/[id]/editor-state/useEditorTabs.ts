import { contentAddBlocked } from '@/lib/editor-capabilities';
import { usePlanTabImport } from '@/hooks/plan/usePlanTabImport';
import { useTrackerImport } from '@/hooks/plan/useTrackerImport';
import { usePublishTabRename } from '@liveworkspace/workbench/hooks/editor/active-tab-name-store';
import { useRef } from 'react';
import { useProjectActions } from '@/hooks/canvas/useProjectActions';
import { track } from '@/lib/telemetry';
import { useTabActions } from '@/hooks/persistence/useTabActions';
import { useTabFolders } from '@/hooks/persistence/useTabFolders';
import { markNameConfirmed } from '@/lib/local-identity';
import { apiSaveTab } from '@/lib/api-client';
import { planGrant } from '@/lib/api/plan-grants';
import { getSessionSharePassword } from '@/lib/api/core';
import { useConnectedTabActions } from '@liveworkspace/workbench/components/connect/useConnectedTabActions';
import { createTab } from '../editor-page-helpers';
import { useEditorHistory } from '../useEditorHistory';
import { useTemplateFlow } from '../useTemplateFlow';
import { usePlanStartProjectName } from '../usePlanStartProjectName';
import { useElementHelpers } from '../useElementHelpers';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPlanDataSlice } from './useEditorPlanData';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorPlanSlice } from './useEditorPlan';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// Undo and redo (useEditorHistory), placement helpers, tab and connected-tab actions, folders, project actions,
// tracker import, naming the project and starting from a template.
export function useEditorTabs(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  documentSlice: EditorDocumentSlice,
  collaborationSlice: EditorCollaborationSlice,
  planDataSlice: EditorPlanDataSlice,
  viewportSlice: EditorViewportSlice,
  editingSlice: EditorEditingSlice,
  planSlice: EditorPlanSlice,
) {
  const { accountUserId } = env;
  const {
    activeId,
    readSelection,
    setActiveId,
    setEditingId,
    setIdentityPromptOpen,
    setSelectedId,
  } = selectionSlice;
  const {
    canHistoryRedo,
    canHistoryUndo,
    commitTabs,
    loadedTabIds,
    loadedTabIdsRef,
    markTabLoaded,
    nameConfirmed,
    projectId,
    redoHistory,
    selfParticipant,
    setNameConfirmed,
    setSelfParticipant,
    tabs,
    tickTabs,
    undoHistory,
  } = documentSlice;
  const {
    canEdit,
    confirm,
    copying,
    isStructureReadOnly,
    participant,
    projectList,
    projectName,
    projectTeamId,
    refreshProjectList,
    sessionShareCode,
    setCopying,
    setImportError,
    setProjectName,
    toast,
  } = collaborationSlice;
  const { activeTab, itemTypes, planItems, sheets, teams } = planDataSlice;
  const { getViewportCenter, requestFit } = viewportSlice;
  const { activeTabLocked, commit, createBlocked, editsBlocked, structureCreateBlocked } =
    editingSlice;
  const { forms, plan, presetCardTypes, teamPeople } = planSlice;
  // Undo / redo handlers. See useEditorHistory.
  const editorHistory = useEditorHistory({
    activeId,
    editsBlocked,
    canUndo: canHistoryUndo,
    canRedo: canHistoryRedo,
    tabLocked: activeTabLocked,
    tickTabs,
    undoHistory,
    redoHistory,
    set: { setSelectedId, setEditingId },
  });
  const { tick, undo, redo, canUndo, canRedo } = editorHistory;
  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  // Selection + placement helpers. See useElementHelpers.
  const { addBoxedAt, currentSelectionIds, selectionPrimary } = useElementHelpers({
    readSelection,
    activeId,
    activeTab,
    // Creation-only helpers: additionally blocked while the active layer
    // is hidden / locked (docs/specs/006-project/layers.md). Open to a Participant that may add content
    // (docs/specs/013-workspace/share-roles.md): a sticky, text or image dragged from its palette lands through
    // addBoxedAt, and every commit it makes still passes participant.guardCommit.
    editsBlocked: contentAddBlocked({
      participating: participant.participating,
      canAddContent: participant.can.addContent,
      blocked: createBlocked,
      structureBlocked: structureCreateBlocked,
    }),
    getViewportCenter,
    commitTabs,
    setSelectedId,
    setEditingId,
  });

  // --- Tab actions ---------------------------------------------------------

  // A JSON tab export's Plan items join the project after its tab (docs/specs/026-plan/items.md).
  const importPlanItems = usePlanTabImport({
    status: planItems.status,
    items: planItems.items,
    types: itemTypes.types,
    addTypes: itemTypes.addTypes,
    write: planItems.write,
  });

  // Tab-lifecycle actions (add / import / rename / duplicate / delete /
  // reorder, active-tab lock, link-into-project, clear content). They
  // touch history, selection, telemetry, confirm / toast and the
  // project list; see
  // useTabActions. Project-level lifecycle + the template flow stay in
  // the page below.
  const {
    addTab,
    importIntoActiveTab,
    importTextIntoActiveTab,
    toggleActiveTabLock,
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
    projectList,
    ownerId: selfParticipant.id,
    projectId,
    createTab,
    commit,
    commitTabs,
    markTabLoaded,
    isTabLoaded: (id: string) => loadedTabIdsRef.current.has(id),
    setActiveId,
    setSelectedId,
    setEditingId,
    setImportError,
    requestFit,
    refreshProjectList: () => refreshProjectList(),
    confirm,
    toast,
    importPlanItems,
    retitleSheets: sheets.retitleSheets,
    sheetTitle: sheets.sheetTitle,
  });
  // Connected tabs (liveworkspace/docs/specs/004-index/connected-tabs.md): the Connect list's add and the move to the new
  // tab, the host's grant for opening one, and Connect Again.
  const connectedTabs = useConnectedTabActions({
    tabs,
    hostKind: 'plan',
    hostId: projectId,
    // The share code and its password, as the room asks with: a renewal without the password is refused.
    grantFor: async (id) =>
      (
        await planGrant(
          id,
          sessionShareCode ? { code: sessionShareCode, password: getSessionSharePassword() } : null,
        )
      )?.grant ?? null,
    createTab,
    saveTab: (tab) => apiSaveTab(selfParticipant.id, projectId ?? '', tab, sessionShareCode),
    commitTabs,
    markTabLoaded,
    openTab: (id) => {
      setActiveId(id);
      setSelectedId(null);
      setEditingId(null);
    },
    toast,
  });
  // The menu box renames the open tab on a click on its name (active-tab-name-store).
  usePublishTabRename(activeId, renameTab, !isStructureReadOnly);

  // Tab-folder membership (docs/specs/006-project/tab-folders.md), kept separate from the busy
  // useTabActions. Menu-only: drag-reorder lives above.
  const {
    moveTabToFolder,
    removeTabFromFolder,
    renameFolder: renameTabFolder,
  } = useTabFolders({
    tabs,
    commitTabs,
  });

  // Project-level lifecycle + navigation (delete / duplicate /
  // move-to-folder / delete-folder, and the new / open / make-a-copy
  // full-page-load helpers). Operates on whole projects + the Explorer
  // list, distinct from per-tab lifecycle in useTabActions. See
  // useProjectActions.
  const { deleteProject, newProject, openProject, makeCopy } = useProjectActions({
    projectId,
    projectName,
    confirm,
    copying,
    setCopying,
    sessionShareCode,
  });

  // A board from another tool (docs/specs/026-plan/tracker-import.md): an Editor's, into a new Board tab or plan.
  const trackerImport = useTrackerImport({
    canImport: !isStructureReadOnly,
    projectId,
    ownerId: selfParticipant.id,
    signedIn: !!accountUserId,
    teamId: projectTeamId && teams.some((t) => t.id === projectTeamId) ? projectTeamId : null,
    self: planItems.self,
    selfParticipant,
    teamPeople,
    status: planItems.status,
    items: planItems.items,
    tabs,
    activeId,
    catalogue: itemTypes.catalogue,
    types: itemTypes.types,
    saveType: itemTypes.saveType,
    write: planItems.write,
    commitTabs,
    createTab,
    markTabLoaded,
    openTab: setActiveId,
    openProject,
    notify: (message) => toast.success(message),
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

  // Name the open project: its own name, and its row in the Explorer panel's in-memory list, which would otherwise
  // show the old name until a reload (autosave persists the name). Shared by the header's rename and a template naming
  // a still-untitled project after itself.
  const nameProject = (name: string) => {
    setProjectName(name);
  };

  // A Plan start on the first tab names a still-untitled project after what it made (usePlanStartProjectName).
  usePlanStartProjectName({
    firstTab: tabs[0],
    firstTabLoaded: tabs[0] ? loadedTabIds.has(tabs[0].id) : false,
    projectName,
    nameProject,
    canEdit,
  });

  // Template and identity actions. See useTemplateFlow. confirmName
  // stays in the page (also wired into useShareLinks) and is passed in.
  // The draw slice comes later in this hook, so the template flow reaches its cancel through a ref.
  const returnToHandRef = useRef<() => void>(() => {});
  const { chooseTemplate, confirmIdentity, cancelIdentity } = useTemplateFlow({
    activeId,
    tabs,
    selfParticipant,
    projectName,
    nameProject,
    getViewportCenter,
    commitTabs,
    confirmName,
    setSelectedId,
    setEditingId,
    setSelfParticipant,
    setIdentityPromptOpen,
    requestFit,
    returnToHand: () => returnToHandRef.current(),
    markTabLoaded,
    bringCardTypes: presetCardTypes.bring,
    seedCards: (creates) => void plan.context.addItems?.(creates),
    startForm: forms.startForm,
  });
  return {
    addBoxedAt,
    addTab,
    canRedo,
    canUndo,
    cancelIdentity,
    chooseTemplate,
    clearTabContent,
    confirmIdentity,
    connectedTabs,
    currentSelectionIds,
    deleteProject,
    deleteTab,
    duplicateTab,
    importIntoActiveTab,
    importTextIntoActiveTab,
    linkActiveTabTo,
    makeCopy,
    moveTabToFolder,
    nameProject,
    newProject,
    openProject,
    redo,
    removeTabFromFolder,
    renameTab,
    renameTabFolder,
    reorderTabs,
    returnToHandRef,
    selectionPrimary,
    tick,
    toggleActiveTabLock,
    trackerImport,
    undo,
  };
}

export type EditorTabsSlice = ReturnType<typeof useEditorTabs>;
