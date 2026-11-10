import {
  usePublishTabName,
  usePublishTabRename,
} from '@liveworkspace/workbench/hooks/editor/active-tab-name-store';
import { useRef } from 'react';
import type { Tab } from '@livedesign/design';
import { useDesignActions } from '@/hooks/canvas/useDesignActions';
import { useBurstCheckpoint } from '@liveworkspace/workbench/hooks/canvas/useBurstCheckpoint';
import { track } from '@/lib/telemetry';
import { useApplyStyleToAllTabs } from '@liveworkspace/workbench/hooks/editor/useApplyStyleToAllTabs';
import { withStyleOfTab } from '@/lib/tab-theme-apply';
import { useTabActions } from '@/hooks/persistence/useTabActions';
import { useTabFolders } from '@/hooks/persistence/useTabFolders';
import { useTabCanvas } from '@/hooks/canvas/useTabCanvas';
import { markNameConfirmed } from '@/lib/local-identity';
import { apiSaveTab } from '@/lib/api-client';
import { designGrant } from '@/lib/api/design-grants';
import { getSessionSharePassword } from '@/lib/api/core';
import { useConnectedTabActions } from '@liveworkspace/workbench/components/connect/useConnectedTabActions';
import { createTab } from '../editor-page-helpers';
import { useTemplateFlow } from '../useTemplateFlow';
import type { EditorDesignSlice } from './useEditorDesign';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorViewport } from './useEditorViewport';
import type { EditorPages } from './useEditorPages';

// Tabs and the document around them: the tab actions, connected tabs, the active tab's name in the menu box, tab
// folders, document actions, naming and the template / identity flow, and the tab canvas actions.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorTabs({
  designSlice,
  selectionSlice,
  sessionSlice,
  collaborationSlice,
  viewportSlice,
  pagesSlice,
}: {
  designSlice: EditorDesignSlice;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  collaborationSlice: EditorCollaboration;
  viewportSlice: EditorViewport;
  pagesSlice: EditorPages;
}) {
  const { tabs, tickTabs, commitTabs, markCheckpoint, nameConfirmed, setNameConfirmed } =
    designSlice;
  const {
    activeId,
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setIdentityPromptOpen,
  } = selectionSlice;
  const {
    selfParticipant,
    setSelfParticipant,
    copying,
    setCopying,
    sessionShareCode,
    confirm,
    toast,
    designName,
    setDesignName,
    setImportError,
    loadedTabIdsRef,
    markTabLoaded,
    designId,
    designList,
    refreshDesignList,
    isStructureReadOnly,
  } = sessionSlice;
  const { loadAllTabs, activeTab } = collaborationSlice;
  const { getViewportCenter, requestFit } = viewportSlice;
  const { structureBlocked, commit } = pagesSlice;
  // --- Tab actions ---------------------------------------------------------

  // Tab-lifecycle actions (add / import / rename / duplicate / delete /
  // reorder, active-tab lock, link-into-design, clear content). They
  // touch history, selection, telemetry, confirm / toast and the
  // design list; see
  // useTabActions. Design-level lifecycle + the template flow stay in
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
    designList,
    ownerId: selfParticipant.id,
    designId,
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
    refreshDesignList: () => refreshDesignList(),
    confirm,
    toast,
  });
  // Connected tabs (liveworkspace/docs/specs/004-index/connected-tabs.md): the Connect list's add and the move to the new
  // tab, the host's grant for opening one, and Connect Again.
  const connectedTabs = useConnectedTabActions({
    tabs,
    hostKind: 'design',
    hostId: designId,
    // The share code and its password, as the room asks with: a renewal without the password is refused.
    grantFor: async (id) =>
      (
        await designGrant(
          id,
          sessionShareCode ? { code: sessionShareCode, password: getSessionSharePassword() } : null,
        )
      )?.grant ?? null,
    createTab,
    saveTab: (tab) => apiSaveTab(selfParticipant.id, designId ?? '', tab, sessionShareCode),
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

  // Tab-folder membership (docs/specs/006-design/tab-folders.md), kept separate from the busy
  // useTabActions. Menu-only: drag-reorder lives above.
  const {
    moveTabToFolder,
    removeTabFromFolder,
    renameFolder: renameTabFolder,
  } = useTabFolders({
    tabs,
    commitTabs,
  });

  // Design-level lifecycle + navigation (delete / duplicate /
  // move-to-folder / delete-folder, and the new / open / make-a-copy
  // full-page-load helpers). Operates on whole designs + the Explorer
  // list, distinct from per-tab lifecycle in useTabActions. See
  // useDesignActions.
  const { deleteDesign, newDesign, openDesign, makeCopy } = useDesignActions({
    designId,
    designName,
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

  // Name the open design: its own name, and its row in the Explorer panel's in-memory list, which would otherwise
  // show the old name until a reload (autosave persists the name). Shared by the header's rename and a template naming
  // a still-untitled design after itself.
  const nameDesign = (name: string) => {
    setDesignName(name);
  };

  // Template and identity actions. See useTemplateFlow. confirmName
  // stays in the page (also wired into useShareLinks) and is passed in.
  // The draw slice comes later in this hook, so the template flow reaches its cancel through a ref.
  const putToolDownRef = useRef<() => void>(() => {});
  const { chooseTemplate, confirmIdentity, cancelIdentity } = useTemplateFlow({
    activeId,
    tabs,
    selfParticipant,
    designName,
    nameDesign,
    getViewportCenter,
    commitTabs,
    confirmName,
    setSelectedId,
    setEditingId,
    setSelfParticipant,
    setIdentityPromptOpen,
    requestFit,
    putToolDown: () => putToolDownRef.current(),
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
    autoLayoutTab,
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
    setBackgroundAnimationSpeed,
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
  // undo step, an Editor's of the whole design only.
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
    connectedTabs,
    moveTabToFolder,
    removeTabFromFolder,
    renameTabFolder,
    deleteDesign,
    newDesign,
    openDesign,
    makeCopy,
    nameDesign,
    putToolDownRef,
    chooseTemplate,
    confirmIdentity,
    cancelIdentity,
    checkpointBurst,
    autoAlignTab,
    autoLayoutTab,
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
    setBackgroundAnimationSpeed,
    applyStyleToAllTabs,
    applyingStyleToAllTabs,
  };
}

export type EditorTabs = ReturnType<typeof useEditorTabs>;
