'use client';

import { onProfileSaved, participantWithProfile } from '@liveworkspace/settings-ui/profile-events';
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { writeUserPreferences } from '@/lib/user-preferences';
import { apiAnnounceRoomName, apiSaveSelf } from '@/lib/api-client';
import { getGuestSelfId } from '@/lib/local-identity';
import { announceRoomName } from '../room-name-sync';
import { useDocumentList } from '@/hooks/persistence/useDocumentList';
import { useDocumentShareState } from '@liveworkspace/workbench/hooks/persistence/useDocumentShareState';
import { autosaveReadOnly } from '../editor-page-helpers';
import { useSyncInPlace } from '../useSyncInPlace';
import { useTakeOfflineInPlace } from '../useTakeOfflineInPlace';
import { useAutosave } from '../useAutosave';
import { useDocumentTrashed } from '../useDocumentTrashed';
import { useIdentityBootstrap } from '../useIdentityBootstrap';
import { useEditorPersistence as usePersistenceState } from '../editor-persistence';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorCollaborationSlice } from './useEditorCollaboration';

// Saving and loading: preferences, the persistence slice, the document list, the Trash state, the autosave, Sync
// and Take Offline in place, and the one-shot identity and document hydration. A slice of useEditorState
// (../useEditorState.ts): it takes the slices composed before it and returns its own, with `view`, its part of
// the editor's view-model.
export function useEditorPersistence({
  fromDocument,
  fromHistory,
  fromSelection,
  fromDialogs,
  fromCollaboration,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromCollaboration: EditorCollaborationSlice;
}) {
  const {
    accountDisplayName,
    accountUserId,
    authLoaded,
    documentId,
    documentNotFound,
    embedMode,
    hydrated,
    lastPersistedSelfRef,
    lastSavedNameRef,
    lastSavedTabsRef,
    loadError,
    loadedTabIdsRef,
    opsApplied,
    ownWrites,
    previewingRef,
    remoteOpJournalRef,
    selfParticipant,
    setDocumentId,
    setDocumentNotFound,
    setHydrated,
    setLoadError,
    setLoadedExistingDocument,
    setLoadedTabIds,
    setLoadingDocument,
    setNameConfirmed,
    setSelfParticipant,
    toast,
  } = fromDocument;
  const { resetTabs, tabs } = fromHistory;
  const { activeId, setActiveId, setIdentityPromptOpen, setSessionTabScope } = fromSelection;
  const { dialogs } = fromDialogs;
  const {
    canEdit,
    participant,
    passwordRetry,
    realtime,
    roomRef,
    sessionShareCode,
    setDocumentOwnerColor,
    setDocumentOwnerId,
    setDocumentOwnerName,
    setDocumentShareCode,
    setDocumentShareable,
    setDocumentTeamId,
    setIsOwner,
    setSessionRole,
    setSessionShareCode,
    setSharePasswordGate,
    sharePasswordGate,
  } = fromCollaboration;
  // Per-user editor preferences (docs/specs/007-editor/user-preferences.md): the state, the ref mirrors
  // the drag hook reads, and the localStorage read + D1 sync effects.
  // See useEditorPreferences.
  const { userPreferences, setUserPreferences, prefsSettled, alignmentGuidesRef } =
    useEditorPreferences({
      ownerId: selfParticipant.id,
      passwordGated: sharePasswordGate !== null,
    });

  // Element link picker (open + anchor state) and the link read/write
  // handlers live in useElementLinks. Invoked further down, after
  // `openDocument` + the selection helpers exist.

  // Persistence-facing state: autosave status pill + savedAt, document
  // name (mirrored to the tab title), the Explorer's owned + shared
  // document lists, and the transient import-error toast — plus the two list-refresh helpers the hydration
  // + autosave paths call. See editor-persistence; the slice is spread
  // into the returned view-model below, so the explicit return doesn't
  // re-list these.
  const persistence = usePersistenceState({ toast });
  const { setSaveStatus, setSavedAt, documentName, setDocumentName, setImportError } = persistence;

  // The document's links are the index's: the badge and the presence stack read them from there.
  useDocumentShareState({
    documentId,
    serverStored: realtime.documentServerStored,
    sessionShareCode,
    shareDialogOpen: dialogs.shareDialogOpen,
    setShareable: setDocumentShareable,
  });

  // The person's documents, for the pickers that name another document: read from the index once the document is open and the
  // browser idle (useDocumentList), never inside an embed.
  const { documentList, refreshDocumentList } = useDocumentList(
    hydrated && !embedMode,
    selfParticipant.id,
  );
  // The deleted state (docs/specs/013-workspace/trash.md): the document is in
  // the Trash. Set by the load, the room and the autosave.
  const documentTrashed = useDocumentTrashed({
    documentId,
    viaShareLink: sessionShareCode !== null,
  });

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
  const { hasUnsavedChanges } = useAutosave({
    hydrated,
    documentId,
    // A Participant saves too, its own way (participant below).
    isReadOnly: autosaveReadOnly({
      canEdit: canEdit || participant.participating,
      loadError,
      documentNotFound,
    }),
    participant: participant.participating,
    tabs,
    documentName,
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
    onDocumentTrashed: () => documentTrashed.setDocumentTrashed(true),
    changesetSeen: realtime.changesetSeen.seen,
  });
  // Sync Space from the Share dialog, with no reload (docs/specs/006-document/offline-mode.md "Syncing
  // in place").
  const syncToCloud = useSyncInPlace({
    documentId,
    ownerId: selfParticipant.id,
    hasUnsavedChanges,
    resetTabs,
    lastSavedTabsRef,
    setDocumentServerStored: realtime.setDocumentServerStored,
    refreshDocumentList: () => refreshDocumentList(),
  });
  // Take Offline in place, for the start screen's switch (docs/specs/006-document/offline-mode.md "Taking offline in place").
  const takeOfflineInPlace = useTakeOfflineInPlace({
    documentId,
    ownerId: selfParticipant.id,
    hasUnsavedChanges,
    setDocumentServerStored: realtime.setDocumentServerStored,
    refreshDocumentList: () => refreshDocumentList(),
  });

  // One-shot identity + document hydration. See useIdentityBootstrap.
  // Placed after the last-saved/loaded refs so they're declared before
  // being passed in.
  useIdentityBootstrap({
    authLoaded,
    passwordRetry,
    hydrated,
    accountUserId,
    accountDisplayName,
    embed: embedMode,
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
      setDocumentId,
      setDocumentName,
      setDocumentNotFound,
      setLoadError,
      setDocumentTrashed: documentTrashed.setDocumentTrashed,
      setDocumentOwnerColor,
      setDocumentOwnerId,
      setDocumentOwnerName,
      setDocumentShareable,
      setDocumentShareCode,
      setDocumentTeamId,
      setDocumentServerStored: realtime.setDocumentServerStored,
      setHydrated,
      setIsOwner,
      setLoadedExistingDocument,
      setLoadedTabIds,
      setLoadingDocument,
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
  // Tell the room we chose `name` (docs/specs/014-identity/auth-and-guest-access.md "Presence names"): a person through
  // the api, which reads their profile fresh; a link visitor (no account, no guest token) over the socket.
  const tellRoomName = useEffectEvent((name: string, saved: boolean) =>
    announceRoomName({
      sync: realtime.roomNameSync,
      name,
      hasIdentity: !!accountUserId || getGuestSelfId() !== null,
      saved,
      room: documentId ? roomRef.current : null,
      announce: async () =>
        documentId ? apiAnnounceRoomName(selfParticipant.id, documentId, sessionShareCode) : null,
    }),
  );
  useEffect(() => {
    // The placeholder never writes the participant record: a document in This Browser opens before the reader
    // is known (docs/specs/006-document/offline-mode.md "Instant open"), and 'self' is nobody's row.
    if (!hydrated || selfParticipant.id === 'self') return;
    const prev = lastPersistedSelfRef.current;
    if (prev && prev.name === selfParticipant.name && prev.color === selfParticipant.color) {
      return;
    }
    lastPersistedSelfRef.current = { name: selfParticipant.name, color: selfParticipant.color };
    const saved = apiSaveSelf(selfParticipant).then(
      () => true,
      () => false,
    );
    // A new name reaches peers only by telling the room, which picks every name (room-name-sync.ts).
    if (prev && prev.name !== selfParticipant.name) {
      const name = selfParticipant.name;
      void saved.then((ok) => tellRoomName(name, ok));
    }
  }, [hydrated, selfParticipant, lastPersistedSelfRef]);

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
        // Already stored, so the room can read it at once.
        if (next.name !== current.name) void tellRoomName(next.name, true);
      }),
    [lastPersistedSelfRef, setSelfParticipant],
  );
  return {
    alignmentGuidesRef,
    documentList,
    documentName,
    documentTrashed,
    refreshDocumentList,
    selfParticipantRef,
    setDocumentName,
    setImportError,
    setUserPreferences,
    tabsRef,
    userPreferences,
    view: {
      // Whether anything edited is still unsaved: the new version prompt reloads only once it is not
      // (docs/specs/016-platform/new-version-prompt.md).
      hasUnsavedChanges,
      syncToCloud,
      takeOfflineInPlace,
      ...persistence,
      documentTrashed,
      setUserPreferences,
      documentList,
      userPreferences,
      // The server copy merged in (or failed to arrive): a once-ever offer (the tours) waits for it, so a
      // returning user on a new device is not offered what another device already answered.
      prefsSettled,
      writeUserPreferences,
    },
  };
}

export type EditorPersistenceSlice = ReturnType<typeof useEditorPersistence>;
