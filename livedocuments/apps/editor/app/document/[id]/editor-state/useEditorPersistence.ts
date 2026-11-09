import { onProfileSaved, participantWithProfile } from '@liveworkspace/settings-ui/profile-events';
import { setOwnPictureShown } from '@/lib/own-picture';
import { useTabRevisions } from '../useTabRevisions';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Tab } from '@livedocuments/document';
import { apiSaveSelf } from '@/lib/api-client';
import { autosaveReadOnly } from '../editor-page-helpers';
import { useSyncInPlace } from '../useSyncInPlace';
import { useTakeOfflineInPlace } from '../useTakeOfflineInPlace';
import { useAutosave } from '../useAutosave';
import { createRemoteOpJournal, type RemoteOpJournal } from '../save-baseline';
import { useIdentityBootstrap } from '../useIdentityBootstrap';
import { createOwnElementWrites, type OwnElementWrites } from '../own-element-writes';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';

// Saving and loading: the last-saved baselines and the peer-op journal, the live tabs ref, the per-tab autosave,
// Sync in place and Take Offline in place, the one-shot identity and document hydration, and keeping the
// participant record (and Settings › Profile changes) in step.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorPersistence({
  documentSlice,
  selectionSlice,
  sessionSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const {
    embedMode,
    workbenchMode,
    workbench,
    authLoaded,
    accountUserId,
    accountDisplayName,
    tabs,
    resetTabs,
    setNameConfirmed,
    setLoadedExistingDocument,
    documentNotFound,
    setDocumentNotFound,
    loadError,
    setLoadError,
    setLoadingDocument,
  } = documentSlice;
  const { setSessionTabScope, activeId, setActiveId, setIdentityPromptOpen } = selectionSlice;
  const {
    selfParticipant,
    setSelfParticipant,
    realtime,
    roomRef,
    setDocumentShareable,
    setDocumentTeamId,
    setDocumentShareCode,
    setIsOwner,
    setDocumentOwnerId,
    setDocumentOwnerName,
    setDocumentOwnerColor,
    passwordRetry,
    setSharePasswordGate,
    setSessionRole,
    sessionShareCode,
    setSessionShareCode,
    setSaveStatus,
    setSavedAt,
    documentName,
    setDocumentName,
    setDocumentPresentation,
    loadedTabIdsRef,
    setLoadedTabIds,
    documentId,
    setDocumentId,
    hydrated,
    setHydrated,
    refreshDocumentList,
    documentTrashed,
    canEdit,
    participant,
  } = sessionSlice;
  // Per-tab autosave. The previous snapshot lives in a ref so we can
  // diff: any tab whose object reference changed since last save is
  // ours to PUT; tab order / document rename hit the metadata PUT.
  // Debounced 600ms — feels responsive without hammering the API.
  // docs/specs/006-document/per-tab-storage.md has the design.
  const lastSavedTabsRef = useRef<Tab[]>([]);
  const lastSavedNameRef = useRef<string>('');
  // Peer ops that land while a save is in flight (docs/specs/012-collaboration/collab-race-hardening.md); see save-baseline.
  const remoteOpJournalRef = useRef<RemoteOpJournal>(createRemoteOpJournal());
  // This editor's element writes the room has not sequenced yet (own-element-writes.ts): one stable object.
  const [ownWrites] = useState<OwnElementWrites>(createOwnElementWrites);
  // Peer ops applied to `tabs`, as state: the journal's count as of this render, for the autosave.
  const [opsApplied, setOpsApplied] = useState(0);
  const countAppliedOp = useCallback(() => setOpsApplied((n) => n + 1), []);

  // True while a hover-preview is on screen (set by useStylePreview). Style
  // previews mutate `tabs` via tickTabs so they render live, but they must
  // never be persisted — only the click-commit should. Autosave reads this
  // ref to skip the debounced save while a preview is showing.
  const previewingRef = useRef(false);

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
    noteTabRevision: tabRevisions.noteSaved,
  });
  // Sync Document from the Share dialog, with no reload (docs/specs/006-document/offline-mode.md "Syncing
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

  // Persist self only when name or color actually changed. Without
  // this guard the hydration GET → state set → effect fire chain
  // produced a useless PUT echoing the same values back to the
  // server. Status is in-memory only (the API doesn't store it) so
  // it doesn't count as a change.
  const lastPersistedSelfRef = useRef<{ name: string; color: string } | null>(null);

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
      setDocumentId,
      setDocumentName,
      setDocumentPresentation,
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
  useEffect(() => {
    // The editor in a workbench never writes the participant record (I9). Nor does the placeholder:
    // a document in This Browser opens before the reader is known (docs/specs/006-document/offline-mode.md
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
        // Show My Google Picture moved: the room hears it over the open socket (useRoomConnection).
        if (saved.patch.showPicture !== undefined && saved.showPicture !== undefined)
          setOwnPictureShown(saved.showPicture);
        const current = selfParticipantRef.current;
        if (current.id === 'self') return;
        const next = participantWithProfile(current, saved);
        if (!next) return;
        lastPersistedSelfRef.current = { name: next.name, color: next.color };
        setSelfParticipant(next);
      }),
    // A state setter (useEditorSession): stable, so this still subscribes once.
    [setSelfParticipant],
  );

  return {
    lastSavedTabsRef,
    lastSavedNameRef,
    remoteOpJournalRef,
    ownWrites,
    countAppliedOp,
    previewingRef,
    tabsRef,
    tabRevisions,
    hasUnsavedChanges,
    syncToCloud,
    takeOfflineInPlace,
    selfParticipantRef,
  };
}

export type EditorPersistence = ReturnType<typeof useEditorPersistence>;
