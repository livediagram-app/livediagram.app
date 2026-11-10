import { useKeyboardAvoidance } from '@liveworkspace/workbench/hooks/canvas/useKeyboardAvoidance';
import { useEffect, useRef, useEffectEvent } from 'react';
import { useFollowMe } from '@/hooks/collab/useFollowMe';
import { useShowFollowersMyView } from '@liveworkspace/workbench/hooks/collab/useShowFollowersMyView';
import { useEditorViewport as useViewportState } from '@/hooks/canvas/useEditorViewport';
import { useCanvasPinchZoom } from '@/hooks/canvas/useCanvasPinchZoom';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useTabEntryEffects } from '../useTabEntryEffects';
import { useCollabDeepLinkCapture } from '../useCollabDeepLink';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { boundsOfElements } from '@/lib/changeset-reveals';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorPersistence } from './useEditorPersistence';
import type { EditorCollaboration } from './useEditorCollaboration';

// The view: the viewport (pan, zoom, fit) and keyboard avoidance, publishing and following viewports, the changeset
// reveal, pinch zoom, the Inbox deep-link capture and the tab-entry fit.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorViewport({
  selectionSlice,
  sessionSlice,
  persistenceSlice,
  collaborationSlice,
}: {
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  persistenceSlice: EditorPersistence;
  collaborationSlice: EditorCollaboration;
}) {
  const { activeId, setActiveId, readSelection } = selectionSlice;
  const {
    roomRef,
    sharePasswordGate,
    toast,
    livePresence,
    remoteViewports,
    followerIds,
    followingRef,
    loadedTabIds,
    hydrated,
  } = sessionSlice;
  const { tabsRef } = persistenceSlice;
  const { revealChangesetRef, activeTab, broadcastViewport } = collaborationSlice;
  const {
    viewport,
    setViewportOffset,
    setViewportZoom,
    zoomRef,
    viewportOffsetRef,
    canvasMainRef,
    getViewportCenter,
    getViewportCanvasRect,
    fitToScreen,
    fitToBounds,
    scrollIntoView,
  } = useViewportState({ activeTab, readSelection });
  // A phone's keyboard never hides the caret on the canvas (useKeyboardAvoidance).
  useKeyboardAvoidance({ canvasMainRef, zoomRef, setViewportOffset });

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
  });
  useAssignRef(followingRef, followMe.followingId);

  // A tab we are about to land on already aimed, so the tab-entry
  // fit-to-screen below leaves it alone (it runs a frame later and would
  // otherwise snap the view straight back off the element).
  const skipTabFitRef = useRef<string | null>(null);

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
  // Server capabilities (GET /api/capabilities). Fetched once at mount.
  const { emailEnabled } = useCapabilities(sharePasswordGate === null);

  // Pinch-to-zoom on touch screens + trackpad pinch (Ctrl+wheel).
  const { isPinchingRef } = useCanvasPinchZoom({
    canvasMainRef,
    viewport,
  });

  // Capture an Inbox element deep link BEFORE the tab-entry
  // effect below rewrites the hash to the plain #t= pin (docs/specs/013-workspace/inbox.md §1).
  // Consumed further down by useCollabDeepLink once the tab is ready.
  const collabDeepLink = useCollabDeepLinkCapture();

  // Tab-entry side effects (URL #t= pin + fit-to-screen once per tab
  // entry). See useTabEntryEffects. A tab showing pages frames the page you were
  // last on (else its first) instead (set by usePagesMode below), never the whole row.
  const frameFirstPageRef = useRef<(() => void) | null>(null);
  const { requestFit } = useTabEntryEffects({
    hydrated,
    activeId,
    elementCount: activeTab.elements.length,
    tabLoaded: loadedTabIds.has(activeId),
    fitToScreen: () => {
      (frameFirstPageRef.current ?? fitToScreen)();
    },
    skipFitForTabRef: skipTabFitRef,
  });

  return {
    viewport,
    setViewportOffset,
    setViewportZoom,
    zoomRef,
    viewportOffsetRef,
    canvasMainRef,
    getViewportCenter,
    getViewportCanvasRect,
    fitToScreen,
    scrollIntoView,
    followMe,
    skipTabFitRef,
    emailEnabled,
    isPinchingRef,
    collabDeepLink,
    frameFirstPageRef,
    requestFit,
  };
}

export type EditorViewport = ReturnType<typeof useEditorViewport>;
