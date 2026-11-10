import { planHidesCursors } from '@/lib/plan-cursors';
import { usePlanPresence } from '@/hooks/plan/usePlanPresence';
import { usePlanItems } from '@/hooks/plan/usePlanItems';
import { type CardThreads, useCardThreads } from '@/hooks/plan/useCardThreads';
import { usePlanTabSweep } from '@/hooks/plan/usePlanTabSweep';
import { useItemTypes } from '@/hooks/plan/useItemTypes';
import { usePlanDefaultTool } from '@/hooks/editor/usePlanDefaultTool';
import { signalReconnect } from '@/lib/offline-queue/reconnect';
import { type SheetsBridge, useSheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { tabNamedForSheet } from '@/lib/tab-named-plan';
import { useRef, useEffect } from 'react';
import { type Element, voteHidesCursors } from '@liveplanner/project';
import { useCommentMentions } from '@/hooks/collab/useCommentMentions';
import { useAddCustomColour } from '@/hooks/editor/useAddCustomColour';
import { useTagColourSetter } from '@/hooks/editor/useTagColourSetter';
import { useEditorBroadcast } from '@/hooks/collab/useEditorBroadcast';
import { useCommentReactionScope } from '@/hooks/collab/useCommentReactionScope';
import { useTokenTeams } from '@/lib/explorer-host';
import { usePerTabLoad } from '../usePerTabLoad';
import { useRoomConnection } from '../useRoomConnection';
import { useRoomFullNotice } from '../useRoomFullNotice';
import { usePresenceBroadcast } from '../usePresenceBroadcast';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useDragPreviewBroadcast } from '@/hooks/collab/useDragPreviewBroadcast';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorProjectSlice } from './useEditorProject';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// The plan's data and its room: cards, card threads, card types, card presence and the sheets bridge, the room
// connection that carries them, presence broadcast, the per-tab load, teams and mentions, the active tab, and the
// cursor and drag broadcasts.
export function useEditorPlanData(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  projectSlice: EditorProjectSlice,
  dialogsSlice: EditorDialogsSlice,
  collaborationSlice: EditorCollaborationSlice,
  persistenceSlice: EditorPersistenceSlice,
) {
  const { accountUserId, workbench, workbenchMode } = env;
  const { activeId, selectionStore, sessionTabScope, setActiveId, setSelectedId } = selectionSlice;
  const {
    applyRemoteOp,
    commitTabs,
    countAppliedOp,
    hydrated,
    itemUndo,
    lastSavedNameRef,
    lastSavedTabsRef,
    loadedTabIdsRef,
    markTabLoaded,
    ownWrites,
    projectId,
    remoteOpJournalRef,
    selfParticipant,
    setLoadedTabIds,
    setSelfParticipant,
    setTabLoadErrors,
    tabLoadRetryNonce,
    tabs,
    tickTabs,
    voteSelfId,
  } = projectSlice;
  const { canvasTool, setCanvasTool } = dialogsSlice;
  const {
    applyElementDelta,
    canEdit,
    lastSeenRef,
    linkedActionsRef,
    livePresence,
    markSeen,
    mentionNotifyRef,
    participant,
    projectItemTypes,
    projectShareable,
    projectTeamId,
    projectTrashed,
    realtime,
    roomRef,
    sessionShareCode,
    sessionShareCodeRef,
    setLiveAgents,
    setLivePresence,
    setProjectItemTypes,
    setProjectName,
    setRemoteCursors,
    setRemoteSelections,
    setRemoteTabFocus,
    toast,
  } = collaborationSlice;
  const { changesetFeed, resyncFromServer, selfParticipantRef, tabsRef } = persistenceSlice;
  // Realtime room: WebSocket per shared project (presence + ops). See
  // useRoomConnection.
  // The project's items (docs/specs/026-plan/items.md): what Plan boards and Plan cards draw, read from the first
  // load, every tab being in Plan.
  const planItems = usePlanItems({
    projectId,
    ready: hydrated,
    ownerId: selfParticipant.id,
    name: selfParticipant.name,
    color: selfParticipant.color,
    shareCode: sessionShareCode,
    tabScope: sessionTabScope,
    // Which of this session's card writes may wait for the connection (offline-changes.md "Roles").
    level: participant.can.level,
    pushUndo: itemUndo.push,
    onError: (message) => toast.error(message),
    // An undo of a card's delete puts it back on its threads (docs/specs/026-plan/items.md "Cards coming and going").
    threadsOf: (itemId) => cardThreadsRef.current?.threadsOf(itemId) ?? [],
    onOwnWrite: (write, before) => {
      linkedActionsRef.current?.noteOwnWrite(write, before);
      // A card deleted, or put back, changes the threads it was on: read them again once it has landed.
      if (write.kind === 'delete' || write.kind === 'create') cardThreadsRef.current?.refetch();
    },
  });
  // The plan's card comment threads (docs/specs/026-plan/items.md "Comments"), read once its cards are.
  const cardThreadsRef = useRef<CardThreads | null>(null);
  const cardThreads = useCardThreads({
    projectId,
    // A Community visitor's link is refused every thread door (docs/specs/025-community/community.md), so it asks none.
    ready: planItems.status === 'ready' && realtime.sessionCommunity === null,
    ownerId: selfParticipant.id,
    self: planItems.self,
    shareCode: sessionShareCode,
    tabScope: sessionTabScope,
    onError: (message) => toast.error(message),
    // A thread comment's mentions reach people as a canvas comment's do (docs/specs/026-plan/items.md "Comments").
    onMentioned: (text, mentions, itemId, commentId) =>
      mentionNotifyRef.current(text, mentions, itemId, commentId),
  });
  useAssignRef(cardThreadsRef, cardThreads);

  // The project's item types (docs/specs/026-plan/item-types.md): what cards, panels and the palette's
  // Cards category draw from, and the Card Types panel changes.
  const itemTypes = useItemTypes({
    projectId,
    ownerId: selfParticipant.id,
    shareCode: sessionShareCode,
    stored: projectItemTypes,
    setStored: setProjectItemTypes,
    pushUndo: itemUndo.push,
    onError: (message) => toast.error(message),
  });

  // Whose hands are on which Plan card (docs/specs/026-plan/plan-board.md): sent and heard through the room.
  const planPresence = usePlanPresence({
    activeTabId: activeId,
    peers: livePresence,
    send: (op) => roomRef.current?.send({ kind: 'op', op }),
  });

  // The sheet store's bridge (docs/specs/029-sheets/sheet-store.md "Live for everyone"): the room's sheet ops reach
  // the lazily loaded sheet chunk through it, once a Sheet is drawn.
  const sheetsCommitRef = useRef<((map: (els: Element[]) => Element[]) => void) | null>(null);
  const sheetsPlaceRef = useRef<SheetsBridge['placeElement'] | null>(null);
  const sheets = useSheetsBridge({
    projectId: projectId ?? '',
    ownerId: selfParticipant.id,
    shareCode: sessionShareCode,
    tabScope: sessionTabScope,
    self: planItems.self,
    // A Participant writes cells; only an Editor shapes the Sheet (docs/specs/013-workspace/share-roles.md).
    canEdit: participant.can.sheetCells,
    canShape: canEdit,
    peers: livePresence,
    pushUndo: itemUndo.push,
    toast: (message) => toast.error(message),
    notify: (message) => toast.info(message),
    send: (op) => roomRef.current?.send({ kind: 'op', op }),
    activeTabId: activeId,
    // `commit`, `undo` and `redo` are declared further down; read at call time.
    commitElements: (map) => sheetsCommitRef.current?.(map),
    placeElement: (at, make, opts) => sheetsPlaceRef.current?.(at, make, opts),
    tickElements: (map) =>
      tickTabs((ts) =>
        ts.map((t) => (t.id === activeId ? { ...t, elements: map(t.elements) } : t)),
      ),
    selectElement: (id) => setSelectedId(id),
    // Quietly (the sheet's own undo holds the rename): a Sheet tab follows its sheet's title.
    sheetRetitled: (sheetId, title) =>
      tickTabs((ts) => {
        const next = ts.map((t) => tabNamedForSheet(t, sheetId, title));
        return next.every((t, i) => t === ts[i]) ? ts : next;
      }),
  });

  const roomFullNotice = useRoomFullNotice(toast.warning);
  useRoomConnection({
    onAdderKey: participant.setAdderKey,
    onRoomFull: roomFullNotice.noticeFull,
    hydrated,
    projectId,
    projectServerStored: realtime.projectServerStored,
    // A workbench session that ended stops the room (blueprint "The workbench page" step 6).
    // A Community visitor never joins the room: no cursors, no presence (docs/specs/025-community/community.md).
    enabled: realtime.sessionCommunity === null && !workbench?.ended,
    onWorkbenchEnded: workbench ? () => workbench.end('revoked') : undefined,
    projectTeamId,
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
    setProjectName,
    setSelfParticipant,
    receiveProjectTrashed: () => projectTrashed.setProjectTrashed(true),
    resyncFromServer: async () => {
      planItems.refetch();
      cardThreads.refetch();
      sheets.resync();
      await resyncFromServer();
    },
    receiveChangeset: changesetFeed.receiveChangeset,
    receiveItems: planItems.receive,
    receiveThreads: cardThreads.receive,
    receiveItemTypes: itemTypes.receive,
    receivePlanPresence: planPresence.receive,
    receiveSheets: sheets.receiveSheets,
    receiveSheetPresence: sheets.receiveSheetPresence,
    onRoomJoined: () => {
      roomFullNotice.joined();
      void changesetFeed.checkSinceLoad();
      planItems.refetch();
      cardThreads.refetch();
      sheets.resync();
      sheets.reannounce();
      // Changes that waited for the connection go now (docs/specs/007-editor/offline-changes.md "Sending them").
      signalReconnect();
      // A rejoined connection has a new presence id, which carries no hold until it is said again.
      planPresence.reannounce();
    },
  });

  // Broadcast local selection + active-tab focus to peers (presence
  // indicators + TabBar avatars). See usePresenceBroadcast.
  usePresenceBroadcast({
    hydrated,
    projectId,
    projectServerStored: realtime.projectServerStored,
    selection: selectionStore,
    activeId,
    roomRef,
  });

  // Lazy fetch the active tab's full payload on first open, plus the
  // search panel's load-everything prefetch. See usePerTabLoad.
  const { loadAllTabs } = usePerTabLoad({
    hydrated,
    projectId,
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
  // A Plan project's statuses are read from every tab: load the rest once (usePlanTabSweep).
  usePlanTabSweep(hydrated, tabs.length, loadAllTabs);

  // Teams the signed-in user belongs to (docs/specs/013-workspace/teams.md), surfaced in the
  // search panel. Fetched lazily the first time search opens so
  // guest sessions and non-searching sessions never pay the request;
  // guests can't have teams, so the gate also requires an account id.
  // Signed-in only (guests can't have teams). Loaded for the whole
  // session, not just while search is open, because the floating
  // Explorer panel now surfaces teams + their projects (a Teams
  // accordion, team rows in Recent, the current team project —
  // docs/specs/013-workspace/team-shared-projects.md), so the data has to be present whenever the panel is.
  const teams = useTokenTeams(!!accountUserId && !workbenchMode);
  // Comment @-mentions (docs/specs/012-collaboration/comment-mentions.md): the project team's members as
  // candidates, and the notify a mentioning comment fires.
  const commentMentions = useCommentMentions({
    // A workbench reads no team and notifies no one.
    ownerId: workbenchMode ? null : (accountUserId ?? null),
    teams,
    projectTeamId,
    projectId,
  });
  useAssignRef(mentionNotifyRef, commentMentions.notifyMentioned);
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;
  // Comment reactions (docs/specs/012-collaboration/comment-reactions.md): whoever may comment may react, under
  // the collab key their answers use.
  const commentReactions = useCommentReactionScope({
    applyElementDelta,
    activeTab,
    selfKey: voteSelfId,
    selfName: selfParticipant.name,
    canReact: hydrated && participant.can.takePart,
  });
  // A colour picked with + joins the tab's custom colours, which every picker offers.
  const addCustomColour = useAddCustomColour({ activeId: activeTab.id, canEdit, tickTabs });
  // A card tag's colour for the tab (docs/specs/009-elements/tag-colours.md).
  const setTagColour = useTagColourSetter({ activeTab, canEdit, commitTabs });
  // Plan starts on Hand and leaves Format out (docs/specs/026-plan/plan-mode.md "The tools").
  usePlanDefaultTool(canvasTool, setCanvasTool);
  // Vote privacy (docs/specs/012-collaboration/session-tools.md): while a hide-cursors vote is open on this tab,
  // peer cursors are neither sent nor drawn. Derived here so
  // the outbound gate (useEditorBroadcast) and the render gate
  // (usePresenceRows) read the same value off the synced tab.
  const voteCursorsHidden = voteHidesCursors(activeTab.vote);

  // The outbound cursor broadcaster lives in useEditorBroadcast. Same
  // throttle, same gates as before, just out of the page file.
  const { broadcastCursor } = useEditorBroadcast({
    roomRef,
    hydrated,
    projectId,
    projectShareable,
    projectTeamId,
    activeId,
    // A vote hides them, and so does a Plan tab other than a Dashboard (plan-cursors.ts).
    cursorsHidden: voteCursorsHidden || planHidesCursors(activeTab),
  });
  // Our drags, live for collaborators (docs/specs/008-canvas/drag-preview.md), whenever the room is open.
  useDragPreviewBroadcast({
    roomRef,
    live: hydrated && !!projectId && (projectShareable || !!projectTeamId),
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
    activeTab,
    addCustomColour,
    broadcastCursor,
    cardThreads,
    commentMentions,
    commentReactions,
    itemTypes,
    loadAllTabs,
    planItems,
    planPresence,
    setTagColour,
    sheets,
    sheetsCommitRef,
    sheetsPlaceRef,
    teams,
    voteCursorsHidden,
  };
}

export type EditorPlanDataSlice = ReturnType<typeof useEditorPlanData>;
