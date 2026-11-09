import { useModeDefaultTool } from '@/hooks/editor/useModeDefaultTool';
import { usePhotoPresence } from '@/hooks/editor/usePhotoPresence';
import { useCallback, useEffect, useRef } from 'react';
import type { Element } from '@livedesign/design';
import { useCommentMentions } from '@/hooks/collab/useCommentMentions';
import { useEditorMode } from '@/hooks/editor/useEditorMode';
import { useAddCustomColour } from '@/hooks/editor/useAddCustomColour';
import { useTagColourSetter } from '@/hooks/editor/useTagColourSetter';
import { useReleaseSelectionLock } from '@/hooks/collab/useReleaseSelectionLock';
import { useComponentLibrary } from '../useComponentLibrary';
import { useEditorBroadcast } from '@/hooks/collab/useEditorBroadcast';
import { useCommentReactionScope } from '@/hooks/collab/useCommentReactionScope';
import { participantKey } from '@/lib/identity';
import { ROOM_FULL_NOTICE } from '@/lib/api/room';
import { useTokenTeams } from '@/lib/explorer-host';
import { usePerTabLoad } from '../usePerTabLoad';
import { useRoomConnection } from '../useRoomConnection';
import { useRoomResync } from '../useRoomResync';
import { usePresenceBroadcast } from '../usePresenceBroadcast';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useChangesetFeed } from '../useChangesetFeed';
import { useDragPreviewBroadcast } from '@/hooks/collab/useDragPreviewBroadcast';
import type { EditorDesignSlice } from './useEditorDesign';
import type { EditorSelection } from './useEditorSelection';
import type { EditorTools } from './useEditorTools';
import type { EditorSession } from './useEditorSession';
import type { EditorPersistence } from './useEditorPersistence';

// No elements, one stable list (an empty design before its first tab).
const NO_ELEMENTS: Element[] = [];

// Said when a main could not be stored (docs/specs/009-elements/components.md "Sharing, collaboration and storage").
const COMPONENT_SAVE_FAILED =
  'Your component change could not be saved. Check your connection and try again.';

// The room: in-place resync, the agent changeset feed, the selection-lock release, photo presence and the component
// library, the WebSocket room and presence broadcast, the lazy per-tab load, teams and comment mentions, the active
// tab, comment reactions, the editor mode, the outbound cursor / laser / drag broadcasts, and the
// stranded-active-tab repair.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorCollaboration({
  designSlice,
  selectionSlice,
  toolsSlice,
  sessionSlice,
  persistenceSlice,
}: {
  designSlice: EditorDesignSlice;
  selectionSlice: EditorSelection;
  toolsSlice: EditorTools;
  sessionSlice: EditorSession;
  persistenceSlice: EditorPersistence;
}) {
  const {
    embedMode,
    workbenchMode,
    workbench,
    accountUserId,
    tabs,
    applyRemoteTabs,
    applyRemoteOp,
    tickTabs,
    commitTabs,
  } = designSlice;
  const {
    sessionTabScope,
    activeId,
    setActiveId,
    selectionStore,
    setSelectedId,
    setEditingId,
    setMultiSelectedIds,
  } = selectionSlice;
  const { canvasTool, setCanvasTool } = toolsSlice;
  const {
    selfParticipant,
    setSelfParticipant,
    realtime,
    roomRef,
    designShareable,
    designTeamId,
    sessionShareCode,
    sessionShareCodeRef,
    applyElementDelta,
    mentionNotifyRef,
    toast,
    setDesignName,
    livePresence,
    setLivePresence,
    setLiveAgents,
    lastSeenRef,
    markSeen,
    setRemoteTabFocus,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteLaserTrails,
    setRemoteViewports,
    setFollowerIds,
    followingRef,
    loadedTabIdsRef,
    setLoadedTabIds,
    setTabLoadErrors,
    tabLoadRetryNonce,
    markTabLoaded,
    designId,
    hydrated,
    designTrashed,
    canEdit,
    participant,
  } = sessionSlice;
  const {
    lastSavedTabsRef,
    lastSavedNameRef,
    remoteOpJournalRef,
    ownWrites,
    countAppliedOp,
    tabsRef,
    selfParticipantRef,
  } = persistenceSlice;
  // In-place recovery when the room can't replay our reconnect gap
  // (docs/specs/012-collaboration/resync-without-reload.md), in place of the page reload this used to do.
  const resyncFromServer = useRoomResync({
    designId,
    selfId: selfParticipant.id,
    sessionShareCode,
    tabsRef,
    loadedTabIdsRef,
    applyRemoteTabs,
    lastSavedTabsRef,
    setTabLoadErrors,
    noteChangesetSeen: realtime.changesetSeen.noteSeen,
  });
  // The toast's Show, set with the viewport (useEditorViewport): declared here, before the feed that calls it.
  const revealChangesetRef = useRef<((tabId: string, ids: readonly string[]) => void) | null>(null);
  // Agent changesets relayed through the room (docs/specs/024-agents/agent-changesets.md "In the
  // editor"): applied, outlined, toasted. See useChangesetFeed.
  const changesetFeed = useChangesetFeed({
    designId,
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
  // Realtime room: WebSocket per shared design (presence + ops). See
  // useRoomConnection.
  // Free an element somebody else is holding (docs/specs/007-editor/live-app.md lock).
  const releaseSelectionLock = useReleaseSelectionLock({
    send: (msg) => roomRef.current?.send(msg),
  });

  // Somebody has freed an element we were holding (docs/specs/007-editor/live-app.md lock). Only our
  // socket is sent this, so there is no target id to check.
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
      // explanation reads as a bug.
      toast.info('Somebody freed an element you were holding');
    },
    [setSelectedId, setEditingId, setMultiSelectedIds, toast],
  );

  // Who is on which layer of a photo page (docs/specs/031-photo/photo-pages.md "Collaboration").
  const photoPresence = usePhotoPresence({
    activeTabId: activeId,
    peers: livePresence,
    send: (op) => roomRef.current?.send({ kind: 'op', op }),
  });

  // The design's component library (docs/specs/009-elements/components.md "The library"), kept live by the room.
  const componentLibrary = useComponentLibrary({
    hydrated,
    designId,
    ownerId: selfParticipant.id,
    shareCode: sessionShareCode,
    elements: (tabs.find((t) => t.id === activeId) ?? tabs[0])?.elements ?? NO_ELEMENTS,
    onSaveError: () => toast.error(COMPONENT_SAVE_FAILED),
  });

  useRoomConnection({
    onAdderKey: participant.setAdderKey,
    hydrated,
    designId,
    designServerStored: realtime.designServerStored,
    // A workbench session that ended stops the room (blueprint "The workbench page" step 6).
    // A Community visitor never joins the room: no cursors, no presence (docs/specs/025-community/community.md).
    enabled: realtime.sessionCommunity === null && !workbench?.ended,
    onWorkbenchEnded: workbench ? () => workbench.end('revoked') : undefined,
    onRoomFull: () => toast.warning(ROOM_FULL_NOTICE),
    designTeamId,
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
    loadedTabIdsRef,
    markTabLoaded,
    setLivePresence,
    setLiveAgents,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteTabFocus,
    setRemoteLaserTrails,
    setRemoteViewports,
    setDesignName,
    setSelfParticipant,
    receiveSelectionReleased,
    setFollowerIds,
    readFollowing: () => followingRef.current,
    receiveDesignTrashed: () => designTrashed.setDesignTrashed(true),
    resyncFromServer,
    receiveChangeset: changesetFeed.receiveChangeset,
    receiveComponent: componentLibrary.receiveComponent,
    receivePhotoPresence: photoPresence.receive,
    onRoomJoined: () => {
      void changesetFeed.checkSinceLoad();
      // A rejoined connection has a new presence id, which carries no hold until it is said again.
      photoPresence.reannounce();
    },
  });

  // Broadcast local selection + active-tab focus to peers (presence
  // indicators + TabBar avatars). See usePresenceBroadcast.
  usePresenceBroadcast({
    hydrated,
    designId,
    designServerStored: realtime.designServerStored,
    selection: selectionStore,
    activeId,
    roomRef,
  });

  // Lazy fetch the active tab's full payload on first open, plus the
  // search panel's load-everything prefetch. See usePerTabLoad.
  const { loadAllTabs } = usePerTabLoad({
    hydrated,
    designId,
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

  // Teams the signed-in user belongs to (docs/specs/013-workspace/teams.md), surfaced in the
  // search panel. Fetched lazily the first time search opens so
  // guest sessions and non-searching sessions never pay the request;
  // guests can't have teams, so the gate also requires an account id.
  // Signed-in only (guests can't have teams). Loaded for the whole
  // session, not just while search is open, because the floating
  // Explorer panel now surfaces teams + their designs (a Teams
  // accordion, team rows in Recent, the current team design —
  // docs/specs/013-workspace/team-shared-designs.md), so the data has to be present whenever the panel is.
  const teams = useTokenTeams(!!accountUserId && !workbenchMode);
  // Comment @-mentions (docs/specs/012-collaboration/comment-mentions.md): the design team's members as
  // candidates, and the notify a mentioning comment fires.
  const commentMentions = useCommentMentions({
    // A workbench reads no team and notifies no one.
    ownerId: workbenchMode ? null : (accountUserId ?? null),
    teams,
    designTeamId,
    designId,
  });
  useAssignRef(mentionNotifyRef, commentMentions.notifyMentioned);
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;
  // Comment reactions (docs/specs/012-collaboration/comment-reactions.md): whoever may comment may react, under
  // the collab key this browser's hello publishes.
  const commentReactions = useCommentReactionScope({
    applyElementDelta,
    activeTab,
    selfKey: participantKey(selfParticipant),
    selfName: selfParticipant.name,
    canReact: participant.can.takePart,
  });
  // The tab's editor mode (docs/specs/007-editor/pages-mode.md "One mode"): Pages, the one mode.
  const editorMode = useEditorMode(canEdit);
  // A colour picked with + joins the tab's custom colours, which every picker offers.
  const addCustomColour = useAddCustomColour({ activeId: activeTab.id, canEdit, tickTabs });
  // A card tag's colour for the tab (docs/specs/009-elements/tag-colours.md).
  const setTagColour = useTagColourSetter({ activeTab, canEdit, commitTabs });
  // The tool the editor starts with: Select, or Hand on a phone.
  useModeDefaultTool(canvasTool, setCanvasTool, embedMode);

  // Outbound realtime broadcasters (cursor + laser) and the local
  // laser-trail buffer live in useEditorBroadcast. Same throttle,
  // same gates, same trail-clears-on-tool-change behaviour as
  // before, just out of the page file.
  const { broadcastCursor, broadcastLaser, broadcastViewport, localLaserTrail } =
    useEditorBroadcast({
      roomRef,
      hydrated,
      designId,
      designShareable,
      designTeamId,
      activeId,
      canvasTool,
    });
  // Our drags, live for collaborators (docs/specs/008-canvas/drag-preview.md), whenever the room is open.
  useDragPreviewBroadcast({
    roomRef,
    live: hydrated && !!designId && (designShareable || !!designTeamId),
    activeId,
  });
  // Viewport state (pan offset, zoom, the canvas wrapper ref the
  // measurements read through, and a parallel zoomRef the drag hook
  // reads each pointer-move) lives in useEditorViewport. The hook
  // is invoked further down, once `activeTab` is in scope; it
  // also owns `getViewportCenter` and `fitToScreen`.

  // Same trick for selfParticipant — the WS effect intentionally
  // omits selfParticipant from its dep list (re-opening the socket
  // on every name/colour change would be wasteful), so the
  // presence callback would otherwise close over a stale value
  // when reconciling unique colours.

  // Reconcile a stranded activeId: undoing a tab add/duplicate (or a
  // remote peer deleting the tab under us) removes the tab the id
  // points at. The render fallback above masks it visually, but every
  // mutator writes via `patchTab(ts, activeId, …)`, which no-ops on a
  // missing id — so edits would silently stop landing until the user
  // clicked a tab. Snap to the surviving fallback instead.
  useEffect(() => {
    if (tabs.length > 0 && tabs.every((t) => t.id !== activeId)) {
      setActiveId(tabs[0]!.id);
    }
  }, [tabs, activeId, setActiveId]);

  return {
    revealChangesetRef,
    changesetFeed,
    releaseSelectionLock,
    photoPresence,
    componentLibrary,
    loadAllTabs,
    teams,
    commentMentions,
    activeTab,
    commentReactions,
    editorMode,
    addCustomColour,
    setTagColour,
    broadcastCursor,
    broadcastLaser,
    broadcastViewport,
    localLaserTrail,
  };
}

export type EditorCollaboration = ReturnType<typeof useEditorCollaboration>;
