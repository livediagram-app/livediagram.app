'use client';

import { useCallback, useEffect, useRef, useEffectEvent } from 'react';
import { useFollowMe } from '@liveworkspace/workbench/hooks/collab/useFollowMe';
import { useNudges } from '@/hooks/collab/useNudges';
import { useShowFollowersMyView } from '@liveworkspace/workbench/hooks/collab/useShowFollowersMyView';
import { useFocusLanding } from '@/hooks/collab/useFocusLanding';
import { useFocusInvite } from '@/hooks/collab/useFocusInvite';
import { useCanvasPinchZoom } from '@/hooks/canvas/useCanvasPinchZoom';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useTabEntryEffects } from '../useTabEntryEffects';
import { padOnlyTabCentre } from '@/lib/pad-only-tab';
import { useCollabDeepLinkCapture } from '../useCollabDeepLink';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { boundsOfElements } from '@/lib/changeset-reveals';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorActiveTabSlice } from './useEditorActiveTab';
import type { EditorViewportSlice } from './useEditorViewport';

// Follow-me, nudges, travel that keeps walking, Bring Focus landing, the changeset reveal, server capabilities,
// pinch zoom, and the tab-entry effects (the #t= pin and fit). A slice of useEditorState (../useEditorState.ts):
// it takes the slices composed before it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorFollowing({
  fromDocument,
  fromSelection,
  fromTools,
  fromCollaboration,
  fromPersistence,
  fromRoom,
  fromActiveTab,
  fromViewport,
}: {
  fromDocument: EditorDocumentSlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromRoom: EditorRoomSlice;
  fromActiveTab: EditorActiveTabSlice;
  fromViewport: EditorViewportSlice;
}) {
  const { hydrated, loadedTabIds, selfParticipant, toast } = fromDocument;
  const { activeId, setActiveId } = fromSelection;
  const { keepWalkingTo } = fromTools;
  const {
    followerIds,
    followingRef,
    livePresence,
    participant,
    peerMotion,
    realtime,
    remoteTabFocus,
    remoteViewports,
    roomRef,
    sharePasswordGate,
  } = fromCollaboration;
  const { documentName, tabsRef } = fromPersistence;
  const { receiveFocusRef, revealChangesetRef } = fromRoom;
  const { activeTab } = fromActiveTab;
  const {
    broadcastViewport,
    canvasMainRef,
    centreOn,
    fitTabToScreen,
    fitToBounds,
    isCentredOn,
    viewport,
    zoomAnchor,
  } = fromViewport;
  // Publish where WE are looking, on change (docs/specs/012-collaboration/follow-me-viewport.md). Unsolicited by design
  // — see the RoomOp comment — and throttled to ~10 Hz inside the broadcaster,
  // so an idle participant sends nothing at all.
  // `broadcastViewport` is re-created every render, so it is called through an effect event. It follows
  // the viewport store (a pan or zoom renders no part of the editor) and sends again on a tab switch.
  const publishViewNow = () => {
    const view = viewport.get();
    const node = canvasMainRef.current;
    broadcastViewport(view.offset, view.zoom, {
      width: node?.offsetWidth ?? 0,
      height: node?.offsetHeight ?? 0,
    });
  };
  const publishViewport = useEffectEvent(publishViewNow);
  useEffect(() => {
    publishViewport();
    return viewport.subscribe(publishViewport);
  }, [viewport, activeId]);
  // A new follower is shown our view at once, not at our next pan.
  useShowFollowersMyView(followerIds, publishViewNow);

  // Follow-me viewport (docs/specs/012-collaboration/follow-me-viewport.md): pin our pan / zoom / tab to a peer's until
  // we take the canvas back. View-role visitors can both follow and be
  // followed — it mutates nothing, and the audience on a view link is exactly
  // who most needs it.
  const followMe = useFollowMe({
    remoteViewports,
    livePresenceIds: livePresence.map((p) => p.id),
    activeId,
    viewport,
    onFollowTab: setActiveId,
    onNotice: (message) => toast.info(message),
    followerIds,
    nameOf: (id) => livePresence.find((p) => p.id === id)?.name ?? 'Someone',
    sendFollow: (target) => roomRef.current?.send({ kind: 'op', op: { kind: 'follow', target } }),
    readCanvasSize: () => {
      const node = canvasMainRef.current;
      return node ? { width: node.offsetWidth, height: node.offsetHeight } : null;
    },
  });
  useAssignRef(followingRef, followMe.followingId);

  // Nudge (docs/specs/012-collaboration/nudge.md): from Collaborators, to one person through the room; an Editor's or
  // a Participant's. Being nudged plays, toasts and, in a hidden tab, notifies (useNudges).
  const sendNudgeOp = useCallback(
    (targetId: string) => roomRef.current?.send({ kind: 'op', op: { kind: 'nudge', targetId } }),
    [roomRef],
  );
  const nudges = useNudges({
    send: realtime.documentServerStored ? sendNudgeOp : null,
    canNudge: participant.can.takePart,
    livePresence,
    peerMotion,
    remoteTabFocus,
    activeId,
    setActiveId,
    centreOn,
    documentName,
    ownerId: selfParticipant.id,
  });

  // A tab we are about to land on already aimed, so the tab-entry
  // fit-to-screen below leaves it alone (it runs a frame later and would
  // otherwise snap the view straight back off the element).
  const skipTabFitRef = useRef<string | null>(null);
  // Travel to another tab (a Portal, an Elevator, the Directory's Go) keeps Avatar mode and lands already aimed: the
  // tab-entry fit leaves it alone, and the walk's camera centres the character at 100% (avatar-mode.md "Changing tab").
  const travelKeepingWalk = (tabId: string) => {
    skipTabFitRef.current = tabId;
    keepWalkingTo(tabId);
  };

  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): the invitation somebody else's press leaves on
  // screen, and what taking it does. Placed after the viewport because taking
  // one navigates through it.
  const landFocus = useCallback(
    (_tabId: string, at: { x: number; y: number }) => centreOn(at),
    [centreOn],
  );
  const focusLanding = useFocusLanding({ activeId, setActiveId, land: landFocus });
  const focusInvite = useFocusInvite({
    onFollowTab: focusLanding.onFollowTab,
    onCentreOn: focusLanding.onCentreOn,
    isAlreadyThere: (tabId, at) => tabId === activeId && isCentredOn(at),
  });
  // The toast's Show (docs/specs/024-agents/agent-changesets.md "In the editor", CS34): the tab, then
  // every element the changeset touched that is still there, framed no closer than 100%.
  useAssignRef(revealChangesetRef, (tabId: string, ids: readonly string[]) => {
    const tab = tabsRef.current.find((t) => t.id === tabId);
    const bounds = tab ? boundsOfElements(tab.elements, ids) : null;
    if (!bounds) return;
    if (tabId !== activeId) {
      skipTabFitRef.current = tabId;
      setActiveId(tabId);
    }
    fitToBounds(bounds, { maxZoom: 1 });
  });
  useAssignRef(receiveFocusRef, focusInvite.receiveFocusHere);

  // Server capabilities. Fetched once at mount.
  const { emailEnabled } = useCapabilities(sharePasswordGate === null);

  // Pinch-to-zoom on touch screens + trackpad pinch (Ctrl+wheel).
  const { isPinchingRef } = useCanvasPinchZoom({
    canvasMainRef,
    viewport,
    zoomAnchor,
  });

  // Capture an Inbox element deep link BEFORE the tab-entry
  // effect below rewrites the hash to the plain #t= pin (docs/specs/013-workspace/inbox.md §1).
  // Consumed further down by useCollabDeepLink once the tab is ready.
  const collabDeepLink = useCollabDeepLinkCapture();

  // Tab-entry side effects (URL #t= pin + fit-to-screen once per tab
  // entry). See useTabEntryEffects. A blank tab holding nothing but its Avatar Pad is not fitted to the pad: its view
  // opens with the pad BLANK_PAD_DROP below the middle, as it lands when a tab is started blank in the editor
  // (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one").
  const { requestFit } = useTabEntryEffects({
    hydrated,
    activeId,
    elementCount: activeTab.elements.length,
    tabLoaded: loadedTabIds.has(activeId),
    fitToScreen: () => {
      const padCentre = padOnlyTabCentre(activeTab.elements);
      if (padCentre) centreOn(padCentre);
      else fitTabToScreen();
      focusLanding.afterTabFit(activeId);
    },
    skipFitForTabRef: skipTabFitRef,
  });
  return {
    collabDeepLink,
    isPinchingRef,
    requestFit,
    view: {
      focusInvite,
      // Side by side (docs/specs/007-editor/split-view.md) hands the editor a tab already aimed.
      skipTabFitRef,
      // Travel to another tab keeps Avatar mode (docs/specs/008-canvas/avatar-mode.md "Changing tab").
      keepWalkingTo: travelKeepingWalk,
      isPinchingRef,
      followMe,
      nudges,
      emailEnabled,
    },
  };
}

export type EditorFollowingSlice = ReturnType<typeof useEditorFollowing>;
