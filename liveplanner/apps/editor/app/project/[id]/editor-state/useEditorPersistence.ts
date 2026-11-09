import { onProfileSaved, participantWithProfile } from '@liveworkspace/settings-ui/profile-events';
import { useTabRevisions } from '@liveworkspace/workbench/hooks/editor/useTabRevisions';
import { useRef, useLayoutEffect, useEffect } from 'react';
import { apiSaveSelf } from '@/lib/api-client';
import { autosaveReadOnly } from '../editor-page-helpers';
import { useSyncInPlace } from '../useSyncInPlace';
import { useTakeOfflineInPlace } from '../useTakeOfflineInPlace';
import { useAutosave } from '../useAutosave';
import { useRoomResync } from '../useRoomResync';
import { useIdentityBootstrap } from '../useIdentityBootstrap';
import { useChangesetFeed } from '../useChangesetFeed';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorLate } from './editor-late';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// Saving and loading: the per-tab autosave, Sync and Take Offline in place, the identity and project load, the
// participant record, a profile saved in Settings, the room's resync and agent changesets.
export function useEditorPersistence(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  documentSlice: EditorDocumentSlice,
  collaborationSlice: EditorCollaborationSlice,
  late: Pick<EditorLate, 'revealChangesetRef'>,
) {
  const { accountDisplayName, accountUserId, authLoaded, embedMode, workbench, workbenchMode } =
    env;
  const { activeId, setActiveId, setIdentityPromptOpen, setSessionTabScope } = selectionSlice;
  const {
    applyRemoteOp,
    applyRemoteTabs,
    countAppliedOp,
    hydrated,
    lastSavedNameRef,
    lastSavedTabsRef,
    loadError,
    loadedTabIdsRef,
    markTabLoaded,
    opsApplied,
    ownWrites,
    previewingRef,
    projectId,
    projectNotFound,
    remoteOpJournalRef,
    resetTabs,
    selfParticipant,
    setHydrated,
    setLoadError,
    setLoadedExistingProject,
    setLoadedTabIds,
    setLoadingProject,
    setNameConfirmed,
    setProjectId,
    setProjectNotFound,
    setSelfParticipant,
    setTabLoadErrors,
    tabs,
  } = documentSlice;
  const {
    canEdit,
    participant,
    passwordRetry,
    projectName,
    projectTrashed,
    realtime,
    refreshProjectList,
    roomRef,
    sessionShareCode,
    sessionShareCodeRef,
    setIsOwner,
    setProjectItemTypes,
    setProjectName,
    setProjectOwnerColor,
    setProjectOwnerId,
    setProjectOwnerName,
    setProjectShareCode,
    setProjectShareable,
    setProjectTeamId,
    setSaveStatus,
    setSavedAt,
    setSessionRole,
    setSessionShareCode,
    setSharePasswordGate,
    toast,
  } = collaborationSlice;
  // Latest tabs mirrored to a ref so timer-driven callbacks (e.g.
  // the opacity debounce below) can read the post-debounce state
  // rather than whatever was in scope when the timer was scheduled.
  // Declared before the realtime + autosave hooks so the Yjs seed
  // (useRoomConnection) and loadAllTabs prefetch can read current tabs.
  // A layout effect, so it is current before any passive effect: a child's effects run before this hook's, and a tab
  // window asking for its tab on the commit the tabs arrive found none of them, settled at once and never asked again.
  const tabsRef = useRef(tabs);
  useLayoutEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  // Per-tab autosave (debounced + beforeunload flush). See useAutosave;
  // the last-saved mirror refs above are seeded by the hydration effect.
  // The last revision known per tab, for the workbench's selection reference.
  const tabRevisions = useTabRevisions(realtime.changesetSeen.seen);
  const { hasUnsavedChanges } = useAutosave({
    hydrated,
    projectId,
    // A Participant saves too, its own way (participant below).
    isReadOnly: autosaveReadOnly({
      canEdit: canEdit || participant.participating,
      loadError,
      projectNotFound,
    }),
    participant: participant.participating,
    tabs,
    projectName,
    selfId: selfParticipant.id,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    remoteOpJournalRef,
    ownWrites,
    opsApplied,
    previewingRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    onProjectTrashed: () => projectTrashed.setProjectTrashed(true),
    changesetSeen: realtime.changesetSeen.seen,
    noteTabRevision: tabRevisions.noteSaved,
  });
  // Sync Project from the Share dialog, with no reload (docs/specs/006-project/offline-mode.md "Syncing
  // in place").
  const syncToCloud = useSyncInPlace({
    projectId,
    ownerId: selfParticipant.id,
    hasUnsavedChanges,
    setProjectServerStored: realtime.setProjectServerStored,
    refreshProjectList: () => refreshProjectList(),
  });
  // Take Offline in place, for the start screen's switch (docs/specs/006-project/offline-mode.md "Taking offline in place").
  const takeOfflineInPlace = useTakeOfflineInPlace({
    projectId,
    ownerId: selfParticipant.id,
    hasUnsavedChanges,
    setProjectServerStored: realtime.setProjectServerStored,
    refreshProjectList: () => refreshProjectList(),
  });

  // Persist self only when name or color actually changed. Without
  // this guard the hydration GET → state set → effect fire chain
  // produced a useless PUT echoing the same values back to the
  // server. Status is in-memory only (the API doesn't store it) so
  // it doesn't count as a change.
  const lastPersistedSelfRef = useRef<{ name: string; color: string } | null>(null);

  // One-shot identity + project hydration. See useIdentityBootstrap.
  // Placed after the last-saved/loaded refs so they're declared before
  // being passed in.
  useIdentityBootstrap({
    authLoaded,
    passwordRetry,
    hydrated,
    accountUserId,
    accountDisplayName,
    embed: embedMode,
    workbench,
    activeId,
    selfParticipant,
    resetTabs,
    refs: {
      lastPersistedSelfRef,
      lastSavedTabsRef,
      lastSavedNameRef,
      loadedTabIdsRef,
      noteChangesetSeen: realtime.changesetSeen.noteSeen,
    },
    set: {
      setActiveId,
      setProjectId,
      setProjectName,
      setProjectItemTypes,
      setProjectNotFound,
      setLoadError,
      setProjectTrashed: projectTrashed.setProjectTrashed,
      setProjectOwnerColor,
      setProjectOwnerId,
      setProjectOwnerName,
      setProjectShareable,
      setProjectShareCode,
      setProjectTeamId,
      setProjectServerStored: realtime.setProjectServerStored,
      setHydrated,
      setIsOwner,
      setLoadedExistingProject,
      setLoadedTabIds,
      setLoadingProject,
      setNameConfirmed,
      setSelfParticipant,
      setSessionRole,
      setSessionShareCode,
      setSessionCommunity: realtime.setSessionCommunity,
      setSessionTabScope,
      setSharePasswordGate,
      setIdentityPromptOpen,
    },
  });
  useEffect(() => {
    // The editor in a workbench never writes the participant record (I9). Nor does the placeholder:
    // a project in This Browser opens before the reader is known (docs/specs/006-project/offline-mode.md
    // "Instant open"), and 'self' is nobody's row.
    if (!hydrated || workbenchMode || selfParticipant.id === 'self') return;
    const prev = lastPersistedSelfRef.current;
    if (prev && prev.name === selfParticipant.name && prev.color === selfParticipant.color) {
      return;
    }
    lastPersistedSelfRef.current = { name: selfParticipant.name, color: selfParticipant.color };
    apiSaveSelf(selfParticipant).catch(() => {});
  }, [hydrated, selfParticipant, workbenchMode]);

  const selfParticipantRef = useRef(selfParticipant);
  useEffect(() => {
    selfParticipantRef.current = selfParticipant;
  }, [selfParticipant]);
  // A name or colour saved in Settings › Profile (docs/specs/007-editor/user-preferences.md, "This app or All") is
  // this editor's own at once: its cursor, name tag and presence avatar in the room follow it, with no reload. It is
  // already stored, so the participant write above is not sent again for it.
  useEffect(
    () =>
      onProfileSaved((saved) => {
        const current = selfParticipantRef.current;
        if (current.id === 'self') return;
        const next = participantWithProfile(current, saved);
        if (!next) return;
        lastPersistedSelfRef.current = { name: next.name, color: next.color };
        setSelfParticipant(next);
      }),
    [setSelfParticipant],
  );
  // In-place recovery when the room can't replay our reconnect gap
  // (docs/specs/012-collaboration/resync-without-reload.md), in place of the page reload this used to do.
  const resyncFromServer = useRoomResync({
    projectId,
    selfId: selfParticipant.id,
    sessionShareCode,
    tabsRef,
    loadedTabIdsRef,
    applyRemoteTabs,
    lastSavedTabsRef,
    setTabLoadErrors,
    noteChangesetSeen: realtime.changesetSeen.noteSeen,
  });
  // Agent changesets relayed through the room (docs/specs/024-agents/agent-changesets.md "In the
  // editor"): applied, outlined, toasted. See useChangesetFeed.
  const changesetFeed = useChangesetFeed({
    projectId,
    selfId: selfParticipant.id,
    sessionShareCodeRef,
    seenRef: realtime.changesetSeen.seenRef,
    noteSeen: realtime.changesetSeen.noteSeen,
    loadedTabIdsRef,
    markTabLoaded,
    applyRemoteOp,
    saveBaseline: { tabs: lastSavedTabsRef, name: lastSavedNameRef, journal: remoteOpJournalRef },
    countAppliedOp,
    refetchTabs: resyncFromServer,
    // Declared with the viewport, further down.
    revealInView: (tabId, ids) => late.revealChangesetRef().current?.(tabId, ids),
    toast,
    canUndo: canEdit,
  });
  return {
    changesetFeed,
    hasUnsavedChanges,
    resyncFromServer,
    selfParticipantRef,
    syncToCloud,
    tabRevisions,
    tabsRef,
    takeOfflineInPlace,
  };
}

export type EditorPersistenceSlice = ReturnType<typeof useEditorPersistence>;
