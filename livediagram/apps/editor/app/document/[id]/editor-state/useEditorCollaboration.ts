'use client';

import { useRef } from 'react';
import { previewAdderKey, useViewPreview } from '../useViewPreview';
import { useParticipantSession } from '../useParticipantSession';
import { useIdeaPosts } from '@/hooks/collab/useIdeaPosts';
import { useElementDeltas } from '@/hooks/collab/useElementDeltas';
import { usePresenceState } from '../usePresenceState';
import { useEditorRealtime } from '../editor-realtime';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';

// Sharing and the realtime room's state: the share role and its read-only preview, a Participant's session,
// presence, element deltas and idea posts. The room connection itself is useEditorRoom. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorCollaboration({
  fromDocument,
  fromHistory,
  fromSelection,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
}) {
  const { toast, workbench } = fromDocument;
  const { tabs, tickTabs } = fromHistory;
  const { activeId, sessionTabScope, setEditingId, setMultiSelectedIds, setSelectedId } =
    fromSelection;
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
  // One answer / idea / tick / comment, applied here and sent to the room as
  // a delta ahead of the autosave (docs/specs/012-collaboration/collab-race-hardening.md). Shared by the comments, the
  // checklist and the collaboration elements below.
  const applyElementDelta = useElementDeltas({ activeId, tickTabs, roomRef });
  // Idea posts held until the room answers them (docs/specs/012-collaboration/idea-box.md "Racing for the last card").
  const ideaPosts = useIdeaPosts({
    tabs,
    tickTabs,
    roomRef,
    onRefused: (message) => toast.error(message),
  });

  // Realtime presence state (who's connected + their cursors / selections
  // / laser trails / tab focus). See usePresenceState; the room writes it
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
    remoteCursors,
    setRemoteCursors,
    remoteLaserTrails,
    setRemoteLaserTrails,
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
  // A workbench session that ended leaves the editor read-only (the autosave stands down with it).
  const { viewPreview, previewLevel, canToggleRole, toggleViewPreview, canEdit } = useViewPreview(
    workbench?.ended ? 'view' : sessionRole,
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
    workbench?.ended ? 'view' : previewLevel,
    toast.info,
    previewLevel === 'participate' && canToggleRole ? previewAdderKey() : null,
  );
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
    ideaPosts,
    isReadOnly,
    isStructureReadOnly,
    lastSeenRef,
    liveAgents,
    livePresence,
    markSeen,
    participant,
    passwordRetry,
    presenceClock,
    realtime,
    remoteCursors,
    remoteLaserTrails,
    remoteSelections,
    remoteTabFocus,
    remoteViewports,
    roomRef,
    sessionRole,
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
    setRemoteCursors,
    setRemoteLaserTrails,
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
      livePresence,
      documentTeamId,
      setDocumentTeamId,
    },
  };
}

export type EditorCollaborationSlice = ReturnType<typeof useEditorCollaboration>;
