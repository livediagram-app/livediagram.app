'use client';

import { useKeyboardAvoidance } from '@liveworkspace/workbench/hooks/canvas/useKeyboardAvoidance';
import { useCallback, useEffect } from 'react';
import { type ShapeElement } from '@livediagram/document';
import { FOCUS_PRESS_MESSAGE, focusPressOutcome } from '@/lib/focus-audience';
import { track } from '@/lib/telemetry';
import { useEditorBroadcast } from '@/hooks/collab/useEditorBroadcast';
import { useEditorViewport as useCanvasViewport } from '@/hooks/canvas/useEditorViewport';
import { useDragPreviewBroadcast } from '@/hooks/collab/useDragPreviewBroadcast';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorModesSlice } from './useEditorModes';

// The viewport (pan, zoom, the canvas element) and what is broadcast beside it: cursors, lasers, drags,
// reactions and Bring Focus. A slice of useEditorState (../useEditorState.ts): it takes the slices composed
// before it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorViewport({
  fromDocument,
  fromHistory,
  fromSelection,
  fromTools,
  fromCollaboration,
  fromRoom,
  fromComments,
  fromModes,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromRoom: EditorRoomSlice;
  fromComments: EditorCommentsSlice;
  fromModes: EditorModesSlice;
}) {
  const { documentId, hydrated, toast } = fromDocument;
  const { tabs } = fromHistory;
  const { activeId, readSelection, setActiveId } = fromSelection;
  const { canvasTool } = fromTools;
  const { documentShareable, documentTeamId, livePresence, remoteViewports, roomRef } =
    fromCollaboration;
  const { reactions } = fromRoom;
  const { activeTab } = fromComments;
  const { voteCursorsHidden } = fromModes;

  // Outbound realtime broadcasters (cursor + laser) and the local
  // laser-trail buffer live in useEditorBroadcast. Same throttle,
  // same gates, same trail-clears-on-tool-change behaviour as
  // before, just out of the page file.
  const {
    broadcastCursor,
    broadcastLaser,
    broadcastReaction,
    broadcastViewport,
    broadcastFocusHere,
    localLaserTrail,
  } = useEditorBroadcast({
    roomRef,
    hydrated,
    documentId,
    documentShareable,
    documentTeamId,
    activeId,
    canvasTool,
    // A vote hides them.
    cursorsHidden: voteCursorsHidden,
  });
  // Our drags, live for collaborators (docs/specs/008-canvas/drag-preview.md), whenever the room is open.
  useDragPreviewBroadcast({
    roomRef,
    live: hydrated && !!documentId && (documentShareable || !!documentTeamId),
    activeId,
  });
  // Viewport state (pan offset, zoom, the canvas wrapper ref the
  // measurements read through, and a parallel zoomRef the drag hook
  // reads each pointer-move) lives in useEditorViewport. The hook
  // is invoked further down, once `activeTab` is in scope; it
  // also owns `getViewportCenter` and `fitToScreen`.

  // Open or collapse a comment panel (docs/specs/012-collaboration/comment-pin.md). Persisted rather than local,
  // so a facilitator opening the thread they want discussed opens it for the
  // room instead of only for themselves.
  // Set a reaction pad off (docs/specs/009-elements/reaction-pad.md): play it here, then tell the room.
  //
  // Local-first rather than round-tripping through the server: the press has
  // to feel instant, and a burst is not shared state that could disagree — it
  // is the same animation run independently on every machine.
  const { play: playReaction } = reactions;
  const fireReaction = useCallback(
    (element: ShapeElement) => {
      const played = playReaction(element.id, element.reaction);
      broadcastReaction(element.id, played);
      track('Element', 'Used', 'ReactionPad');
    },
    [playReaction, broadcastReaction],
  );

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

  const {
    viewport,
    setViewportOffset,
    setViewportZoom,
    zoomRef,
    canvasMainRef,
    getViewportCenter,
    getViewportCanvasRect,
    fitToScreen,
    landOnTab,
    fitToBounds,
    centreOn,
    isCentredOn,
    scrollIntoView,
  } = useCanvasViewport({ activeTab, readSelection });
  // A phone's keyboard never hides the caret on the canvas (useKeyboardAvoidance).
  useKeyboardAvoidance({ canvasMainRef, zoomRef, setViewportOffset });

  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): ask everyone else to come and look at this
  // element, on our tab, each at their own zoom.
  //
  // Sends the element's CENTRE rather than our pan: two people rarely have the
  // same window size, so copying a pan lands the element off-centre for anyone
  // whose canvas is a different shape. Our own view does not move — we are
  // already looking at it.
  const pressFocusButton = useCallback(
    (element: ShapeElement) => {
      const at = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
      const sent = broadcastFocusHere(at, zoomRef.current);
      // A press that moves nobody is invisible from this side, so say which
      // kind of nobody it was: an empty room, or a room already looking at it.
      // `livePresence` is peers ONLY (the room excludes the asker from every
      // presence list it sends), so one other person is length 1.
      toast.info(
        FOCUS_PRESS_MESSAGE[
          focusPressOutcome({
            sent,
            peerIds: livePresence.map((p) => p.id),
            viewports: remoteViewports.get(),
            tabId: activeId,
            at,
          })
        ],
      );
      track('Element', 'Used', 'BringFocus');
    },
    [broadcastFocusHere, livePresence, remoteViewports, activeId, zoomRef, toast],
  );
  return {
    broadcastViewport,
    canvasMainRef,
    centreOn,
    fitToBounds,
    fitToScreen,
    getViewportCanvasRect,
    getViewportCenter,
    isCentredOn,
    landOnTab,
    localLaserTrail,
    scrollIntoView,
    setViewportZoom,
    viewport,
    zoomRef,
    view: {
      getViewportCenter,
      fireReaction,
      pressFocusButton,
      broadcastCursor,
      broadcastLaser,
      canvasMainRef,
      fitToScreen,
      // Bring an element into view (the Collaborate panel's jump to a card).
      scrollIntoView,
      setViewportOffset,
      setViewportZoom,
      viewport,
    },
  };
}

export type EditorViewportSlice = ReturnType<typeof useEditorViewport>;
