'use client';

import { useRef } from 'react';
import { previewAdderKey, useViewPreview } from '../useViewPreview';
import { useParticipantSession } from '../useParticipantSession';
import { useElementDeltas } from '@/hooks/collab/useElementDeltas';
import { usePresenceState } from '../usePresenceState';
import { useEditorRealtime } from '../editor-realtime';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';

// Sharing and the realtime room's state: the share role and its read-only preview, a Participant's session (and
// its held walk), presence, and element deltas. The room connection itself is useEditorRoom. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorCollaboration({
  fromDocument,
  fromHistory,
  fromSelection,
  fromTools,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
}) {
  const { embedMode, toast } = fromDocument;
  const { tickTabs } = fromHistory;
  const { activeId, sessionTabScope, setEditingId, setMultiSelectedIds, setSelectedId } =
    fromSelection;
  const { holdWalking } = fromTools;
  // Sharing, session-permission and realtime-room infrastructure: the
  // shareable / team / share-code flags that gate the WS room, owner +
  // owner-badge info, the share-link list + password, the granted
  // session role + session share code, and the room ref.
  // See editor-realtime. Declared early so the preferences + capabilities
  // gates below can read `sharePasswordGate`. The slice is spread into
  // the returned view-model below, so the explicit return doesn't
  // re-list these.
  const realtime = useEditorRealtime();
  const {
    roomRef,
    documentShareable,
    setDocumentShareable,
    documentTeamId,
    setDocumentTeamId,
    setDocumentShareCode,
    setIsOwner,
    setDocumentOwnerId,
    setDocumentOwnerName,
    setDocumentOwnerColor,
    copying,
    setCopying,
    passwordRetry,
    sharePasswordGate,
    setSharePasswordGate,
    sessionRole,
    setSessionRole,
    sessionShareCode,
    setSessionShareCode,
    sessionShareCodeRef,
  } = realtime;
  // One tick / comment, applied here and sent to the room as a delta ahead of
  // the autosave (docs/specs/012-collaboration/collab-race-hardening.md). Shared by the comments and the checklist below.
  const applyElementDelta = useElementDeltas({ activeId, tickTabs, roomRef });

  // Realtime presence state (who's connected + their cursors / selections
  // / tab focus). See usePresenceState; the room writes it
  // via the setters, the presence-row builders read the values.
  const {
    livePresence,
    setLivePresence,
    liveAgents,
    setLiveAgents,
    lastSeenRef,
    presenceClock,
    markSeen,
    remoteTabFocus,
    setRemoteTabFocus,
    remoteSelections,
    setRemoteSelections,
    peerMotion,
    setRemoteCursors,
    setRemoteAvatars,
    remoteViewports,
    setRemoteViewports,
    followerIds,
    setFollowerIds,
  } = usePresenceState();
  // Who we follow, for the room connection to say again on a new socket; filled once useFollowMe exists below.
  const followingRef = useRef<string | null>(null);

  // Sharing / session / owner / share-link state + the room refs all now
  // live in useEditorRealtime, destructured above. Embeds honour the share
  // code's role (docs/specs/013-workspace/embeds.md): a view code renders a read-only viewer, an edit
  // code an editable embed. The api enforces the role on every write, so
  // this is presentation-side only.
  // The role pill's local read-only preview (docs/specs/007-editor/editor-app.md#role-pill).
  const { viewPreview, previewLevel, canToggleRole, toggleViewPreview, canEdit } = useViewPreview(
    sessionRole,
    () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setEditingId(null);
    },
  );
  const isReadOnly = !canEdit;
  // A Participant's adder key, what it may do, and the guard on its commits (docs/specs/013-workspace/share-roles.md).
  // `isReadOnly` stays true for a Participant: its content gestures open through `participant.can` alone.
  // Previewing as a Participant, an Editor has no adder key of its own (a room ticket carries one only for a
  // participate session), so the preview stamps what it adds with a local one and handles it as a Participant would.
  const participant = useParticipantSession(
    previewLevel,
    toast.info,
    previewLevel === 'participate' && canToggleRole ? previewAdderKey() : null,
  );
  // A Participant is always walking, on every tab, with no way out (docs/specs/013-workspace/share-roles.md "A
  // Participant walks"). Set while rendering, like the tab change useCanvasTool handles, so no frame draws it otherwise.
  holdWalking(participant.can.alwaysWalks && !embedMode);
  // The document's structure (tabs, their order and folders, the name, the
  // deck) is read-only for a view link and for any tab-scoped link: a scoped
  // edit link edits its one tab's content, nothing around it
  // (docs/specs/013-workspace/tab-scoped-share-links.md).
  const isStructureReadOnly = isReadOnly || sessionTabScope !== null;
  return {
    applyElementDelta,
    canEdit,
    copying,
    documentShareable,
    documentTeamId,
    followerIds,
    followingRef,
    isReadOnly,
    isStructureReadOnly,
    lastSeenRef,
    liveAgents,
    livePresence,
    markSeen,
    participant,
    passwordRetry,
    peerMotion,
    presenceClock,
    realtime,
    remoteSelections,
    remoteTabFocus,
    remoteViewports,
    roomRef,
    sessionShareCode,
    sessionShareCodeRef,
    setCopying,
    setDocumentOwnerColor,
    setDocumentOwnerId,
    setDocumentOwnerName,
    setDocumentShareCode,
    setDocumentShareable,
    setDocumentTeamId,
    setFollowerIds,
    setIsOwner,
    setLiveAgents,
    setLivePresence,
    setRemoteAvatars,
    setRemoteCursors,
    setRemoteSelections,
    setRemoteTabFocus,
    setRemoteViewports,
    setSessionRole,
    setSessionShareCode,
    setSharePasswordGate,
    sharePasswordGate,
    view: {
      isStructureReadOnly,
      viewPreview,
      canToggleRole,
      toggleViewPreview,
      ...realtime,
      canApplyStyleToAllTabs: !isStructureReadOnly,
      isReadOnly,
      // What this session may do (docs/specs/013-workspace/share-roles.md): a Participant's content gestures.
      can: participant.can,
      participating: participant.participating,
      // A Participant's adder key: whose notes on a Notice Board are its own (docs/specs/009-elements/social-pieces.md).
      adderKey: participant.adderKey,
      // One delta to an element (docs/specs/012-collaboration/collab-race-hardening.md): a notice board's pin and unpin.
      applyElementDelta,
      livePresence,
      documentTeamId,
      setDocumentTeamId,
    },
  };
}

export type EditorCollaborationSlice = ReturnType<typeof useEditorCollaboration>;
