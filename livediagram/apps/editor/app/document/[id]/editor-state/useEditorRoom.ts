'use client';

import { ROOM_FULL_NOTICE } from '@/lib/api/room';
import { useCallback, useRef } from 'react';
import { peerModeSwitchMessage } from '@/lib/peer-mode-switch';
import { useQaBoard } from '@/hooks/canvas/useQaBoard';
import { useFacilitator } from '@/hooks/collab/useFacilitator';
import type { PollCandidate } from '@/lib/poll-collaborators';
import { useLivePoll } from '@/hooks/collab/useLivePoll';
import { usePerTabLoad } from '../usePerTabLoad';
import { useReactionBursts } from '@/hooks/canvas/useReactionBursts';
import { useRoomConnection } from '../useRoomConnection';
import { useRoomResync } from '../useRoomResync';
import { usePresenceBroadcast } from '../usePresenceBroadcast';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useChangesetFeed } from '../useChangesetFeed';
import { useTabDrafts } from '../useTabDrafts';
import { apiAdoptPeerSave } from '@/lib/api-client';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';

// The realtime room's connection and everything it feeds: the live poll, resync, relayed changesets, reaction
// bursts, the facilitator, the Q&A board, the presence broadcast and the per-tab lazy load. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorRoom({
  fromDocument,
  fromHistory,
  fromSelection,
  fromCollaboration,
  fromPersistence,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
}) {
  const {
    countAppliedOp,
    documentId,
    hydrated,
    lastSavedNameRef,
    lastSavedTabsRef,
    loadedTabIds,
    loadedTabIdsRef,
    markTabLoaded,
    ownWrites,
    remoteOpJournalRef,
    selfParticipant,
    setLoadedTabIds,
    setSelfParticipant,
    setTabLoadErrors,
    setTabLoadRetryNonce,
    tabLoadRetryNonce,
    toast,
    voteSelfId,
    workbench,
  } = fromDocument;
  const { applyRemoteOp, applyRemoteTabs, commitTabs } = fromHistory;
  const {
    activeId,
    selectionStore,
    sessionTabScope,
    setEditingId,
    setMultiSelectedIds,
    setSelectedId,
  } = fromSelection;
  const {
    canEdit,
    documentTeamId,
    followingRef,
    ideaPosts,
    lastSeenRef,
    livePresence,
    markSeen,
    participant,
    realtime,
    roomRef,
    sessionShareCode,
    sessionShareCodeRef,
    setFollowerIds,
    setLiveAgents,
    setLivePresence,
    setRemoteCursors,
    setRemoteLaserTrails,
    setRemoteSelections,
    setRemoteTabFocus,
    setRemoteViewports,
  } = fromCollaboration;
  const { documentTrashed, selfParticipantRef, setDocumentName, tabsRef } = fromPersistence;
  // Filled in useEditorFollowing, once the viewport they navigate through exists: the changeset feed and the
  // room read them at call time.
  const revealChangesetRef = useRef<((tabId: string, ids: readonly string[]) => void) | null>(null);
  const receiveFocusRef = useRef<
    ((from: string, tabId: string, at: { x: number; y: number }) => void) | null
  >(null);
  // Live poll (docs/specs/012-collaboration/live-poll.md): the ephemeral pulse-check. Declared before the
  // room connection because that's what feeds it inbound ops. Nothing it
  // holds is persisted — no tab field, no autosave, no change log.
  // Kept in step with the facilitator hook below, which cannot be declared up
  // here: it needs the room, and the room needs this.
  const sessionBlockedRef = useRef(false);
  // The room's roster, for a `collaborators` poll (docs/specs/012-collaboration/live-poll.md). A ref because the
  // presence rows it is filled from are derived much further down this file —
  // they need the room, which needs the poll hook — and because the only
  // moment its value matters is the instant somebody starts a poll.
  const pollCollaboratorsRef = useRef<readonly PollCandidate[]>([]);
  // Our collab key, for the poll's answers and host (docs/specs/012-collaboration/collab-race-hardening.md). A ref: the poll
  // hook's handlers stay stable while identity hydrates.
  const pollSelfKeyRef = useLatest(voteSelfId);
  const livePoll = useLivePoll({
    roomRef,
    sessionBlockedRef,
    collaboratorsRef: pollCollaboratorsRef,
    selfKeyRef: pollSelfKeyRef,
  });
  // In-place recovery when the room can't replay our reconnect gap
  // (docs/specs/012-collaboration/resync-without-reload.md), in place of the page reload this used to do.
  const resyncFromServer = useRoomResync({
    documentId,
    selfId: selfParticipant.id,
    sessionShareCode,
    tabsRef,
    loadedTabIdsRef,
    applyRemoteTabs,
    lastSavedTabsRef,
    setTabLoadErrors,
    noteChangesetSeen: realtime.changesetSeen.noteSeen,
    setDocumentName,
    lastSavedNameRef,
  });
  // Agent changesets relayed through the room (docs/specs/024-agents/agent-changesets.md "In the
  // editor"): applied, outlined, toasted. See useChangesetFeed.
  const changesetFeed = useChangesetFeed({
    documentId,
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
    revealInView: (tabId, ids) => revealChangesetRef.current?.(tabId, ids),
    toast,
    canUndo: canEdit,
  });
  // Realtime room: WebSocket per shared document (presence + ops). See
  // useRoomConnection.
  // Reaction bursts (docs/specs/009-elements/reaction-pad.md): ephemeral, per-client, never document state.
  const reactions = useReactionBursts();

  // Who is running this session (docs/specs/012-collaboration/facilitator.md). Declared before the room
  // connection because the socket hands it every answer and asks it for the
  // token on each hello.
  const facilitator = useFacilitator({
    documentId,
    send: (msg) => roomRef.current?.send(msg),
    // toast.info, so the Show notifications preference (docs/specs/007-editor/user-preferences.md) governs these
    // exactly as it governs every other announcement.
    onNotice: (message) => toast.info(message),
    // Names come from the roster we already hold, so a renamed participant's
    // announcement reads correctly.
    nameOf: (presenceId) => livePresence.find((p) => p.id === presenceId)?.name ?? null,
  });
  useAssignRef(sessionBlockedRef, facilitator.sessionToolsBlocked);

  // The facilitator has freed an element we were holding (docs/specs/007-editor/editor-app.md lock,
  // docs/specs/012-collaboration/facilitator.md). Only our socket is sent this, so there is no target id to check.
  //
  // Clearing `selectedId` is the whole of it: usePresenceBroadcast already
  // fires a `select` op on every change, so peers' locks fall away through the
  // path that was there before this feature, and the room announces nothing to
  // anyone else. Editing is dropped too — the lock exists precisely so two
  // people don't type into one element, and leaving an open editor behind
  // would hand back the thing the release was meant to take away.
  const receiveSelectionReleased = useCallback(
    ({ elementId }: { elementId: string; by: string }) => {
      setSelectedId((current) => (current === elementId ? null : current));
      setEditingId((current) => (current === elementId ? null : current));
      setMultiSelectedIds((prev) => {
        if (!prev.has(elementId)) return prev;
        const next = new Set(prev);
        next.delete(elementId);
        return next;
      });
      // Said plainly, because an element vanishing from under you with no
      // explanation reads as a bug rather than as somebody running a session.
      toast.info('The facilitator freed an element you were holding');
    },
    [setSelectedId, setEditingId, setMultiSelectedIds, toast],
  );

  // The Q&A board (docs/specs/012-collaboration/qa-board.md). Up here, ahead of the room, because the room
  // lands the server's `qa` ops through it.
  const qaBoard = useQaBoard({
    documentId,
    activeId,
    selfParticipant,
    sessionShareCode,
    applyRemoteTabs,
    commitTabs,
    lastSavedTabsRef,
    onError: (message) => toast.error(message),
  });

  useRoomConnection({
    onAdderKey: participant.setAdderKey,
    hydrated,
    documentId,
    documentServerStored: realtime.documentServerStored,
    // A workbench session that ended stops the room (blueprint "The workbench page" step 6).
    enabled: realtime.sessionCommunity === null && !workbench?.ended,
    onWorkbenchEnded: workbench ? () => workbench.end('revoked') : undefined,
    // docs/specs/015-api/api.md "A room holds at most 100 connections": said once; editing carries on alone.
    onRoomFull: () => toast.warning(ROOM_FULL_NOTICE),
    documentTeamId,
    selfParticipant,
    sessionShareCode,
    lastSeenRef,
    markSeen,
    selfParticipantRef,
    saveBaseline: { tabs: lastSavedTabsRef, name: lastSavedNameRef, journal: remoteOpJournalRef },
    ownWrites,
    countAppliedOp,
    sessionShareCodeRef,
    roomRef,
    applyRemoteOp,
    pendingIdeaIds: ideaPosts.pendingIdeaIds,
    loadedTabIdsRef,
    markTabLoaded,
    setLivePresence,
    setLiveAgents,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteTabFocus,
    setRemoteLaserTrails,
    setRemoteViewports,
    setDocumentName,
    setSelfParticipant,
    receiveReaction: reactions.receive,
    // Filled by the hook below, which cannot be declared up here because
    // taking an invitation navigates through the viewport (declared later
    // still). Same knot, and the same ref, as the portal's travel callback.
    receiveFocusHere: (from, tabId, at) => receiveFocusRef.current?.(from, tabId, at),
    receiveFacilitator: facilitator.receiveFacilitator,
    receiveSelectionReleased,
    // Everyone follows a collaborator's switch of the tab's mode; the one on this tab is said.
    receivePeerModeSwitch: (name, tabId, mode) => {
      if (tabId === activeId) toast.info(peerModeSwitchMessage(name, mode));
    },
    readFacilitatorToken: facilitator.readFacilitatorToken,
    setFollowerIds,
    readFollowing: () => followingRef.current,
    receivePoll: livePoll.receivePoll,
    receivePollAnswer: livePoll.receiveAnswer,
    receivePollEnd: livePoll.receivePollEnd,
    receiveQa: qaBoard.receiveQa,
    receiveDocumentTrashed: () => documentTrashed.setDocumentTrashed(true),
    resyncFromServer,
    receiveChangeset: changesetFeed.receiveChangeset,
    // A peer's landed save moves this Editor's delta base copy, when its baseline proves to hold what was stored
    // (docs/specs/006-document/delta-saves.md "A peer's save moves the base copy"). Nobody else saves deltas.
    receiveTabSaved: (tab, rev, digest) => {
      if (!documentId || !canEdit || participant.participating) return;
      void apiAdoptPeerSave(documentId, tab, rev, digest);
    },
    onRoomJoined: () => {
      void changesetFeed.checkSinceLoad();
    },
  });

  // This browser's drafts of unsaved changes: one a load put back goes on screen and saves, one overtaken is said
  // (docs/specs/006-document/delta-saves.md "Drafts of unsaved changes").
  useTabDrafts({
    hydrated,
    documentId,
    selfId: selfParticipant.id,
    mayEdit: canEdit && !participant.participating,
    tabsRef,
    lastSavedTabsRef,
    loadedTabIds,
    applyLoaded: applyRemoteOp,
    toast,
  });

  // Broadcast local selection + active-tab focus to peers (presence
  // indicators + TabBar avatars). See usePresenceBroadcast.
  usePresenceBroadcast({
    hydrated,
    documentId,
    documentServerStored: realtime.documentServerStored,
    selection: selectionStore,
    activeId,
    roomRef,
  });

  // Lazy fetch the active tab's full payload on first open, plus the
  // search panel's load-everything prefetch. See usePerTabLoad.
  const { loadAllTabs } = usePerTabLoad({
    hydrated,
    documentId,
    activeId,
    selfId: selfParticipant.id,
    sessionShareCode,
    sessionTabScope,
    tabsRef,
    loadedTabIdsRef,
    setLoadedTabIds,
    setTabLoadErrors,
    retryNonce: tabLoadRetryNonce,
    lastSavedTabsRef,
    applyLoaded: applyRemoteOp,
    noteChangesetSeen: realtime.changesetSeen.noteSeen,
  });

  // Re-attempt the active tab's failed lazy fetch. Clear its error so
  // the overlay swaps from the error card to the spinner, drop it from
  // the loaded-set so the effect actually refetches, then bump the nonce
  // to re-run that effect even though activeId hasn't changed.
  const retryActiveTabLoad = () => {
    loadedTabIdsRef.current.delete(activeId);
    setTabLoadErrors((prev) => {
      if (!prev.has(activeId)) return prev;
      const next = new Set(prev);
      next.delete(activeId);
      return next;
    });
    setTabLoadRetryNonce((n) => n + 1);
  };
  return {
    changesetFeed,
    facilitator,
    livePoll,
    loadAllTabs,
    pollCollaboratorsRef,
    reactions,
    receiveFocusRef,
    revealChangesetRef,
    view: {
      // The outlines relayed changesets draw (useChangesetFeed), for the canvas overlay.
      changesetReveals: changesetFeed.reveals,
      // The facilitator baton (docs/specs/012-collaboration/facilitator.md): who is running this session.
      facilitator,
      reactionBursts: reactions.bursts,
      clearReactionBurst: reactions.clear,
      // Live poll (docs/specs/012-collaboration/live-poll.md) — the whole ephemeral surface in one object
      // rather than a dozen flattened keys, since nothing else reads into it.
      livePoll,
      loadAllTabs,
      retryActiveTabLoad,
      qaBoard,
    },
  };
}

export type EditorRoomSlice = ReturnType<typeof useEditorRoom>;
