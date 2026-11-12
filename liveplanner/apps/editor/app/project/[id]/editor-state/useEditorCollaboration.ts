import type { LinkedActions } from '@/hooks/plan/useLinkedActionCards';
import { useRef } from 'react';
import type { CommentMention } from '@liveplanner/project';
import { useEditorContextMenu } from '@/hooks/canvas/useEditorContextMenu';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { useViewPreview, previewAdderKey } from '../useViewPreview';
import { useParticipantSession } from '../useParticipantSession';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { useEditorComments } from '@/hooks/collab/useEditorComments';
import { usePlanList } from '@/hooks/persistence/usePlanList';
import { usePlanShareState } from '@/hooks/persistence/usePlanShareState';
import { useProjectTrashed } from '../useProjectTrashed';
import { useElementDeltas } from '@/hooks/collab/useElementDeltas';
import { usePresenceState } from '../usePresenceState';
import { useEditorPersistence } from '../editor-persistence';
import { useEditorRealtime } from '../editor-realtime';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorProjectSlice } from './useEditorProject';
import type { EditorDialogsSlice } from './useEditorDialogs';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// Sharing and the session: the realtime and share state (editor-realtime), comment threads and their deltas,
// per-user preferences, the context menu, the persistence state (editor-persistence: save status, the name),
// presence, the plan's links, the Trash state, the role preview and what a Participant may do.
export function useEditorCollaboration(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  projectSlice: EditorProjectSlice,
  dialogsSlice: EditorDialogsSlice,
) {
  const { embedMode, workbench, workbenchMode } = env;
  const { activeId, sessionTabScope, setEditingId, setMultiSelectedIds, setSelectedId } =
    selectionSlice;
  const { hydrated, projectId, selfParticipant, tickTabs } = projectSlice;
  const { dialogs } = dialogsSlice;
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
    projectShareable,
    setProjectShareable,
    projectTeamId,
    setProjectTeamId,
    setProjectShareCode,
    setIsOwner,
    setProjectOwnerId,
    setProjectOwnerName,
    setProjectOwnerColor,
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
  // One answer / tick / comment, applied here and sent to the room as
  // a delta ahead of the autosave (docs/specs/012-collaboration/collab-race-hardening.md). Shared by the comments, the
  // checklist and the collaboration elements below.
  const applyElementDelta = useElementDeltas({ activeId, tickTabs, roomRef });
  // The mention notify (useCommentMentions, below): declared first because the
  // comments hook takes it before the teams it depends on exist.
  const mentionNotifyRef = useRef<
    (text: string, mentions: CommentMention[], itemId?: string, commentId?: string) => void
  >(() => {});
  // The Actions board (useLinkedActionCards, below): declared first because the item store and the actions hook
  // report to it before it exists.
  const linkedActionsRef = useRef<LinkedActions | null>(null);
  // Comment-thread state + handlers. The open-id drives the
  // dynamic <CommentThreadPopover> JSX gate further down; the
  // action callbacks bind to the selection popover + the popover
  // itself. Mutations bypass the history hook (no Ctrl+Z eats a
  // half-typed comment) and travel as deltas; see
  // apps/editor/hooks/collab/useEditorComments.ts.
  const {
    commentThreadOpenId,
    commentThreadOpenCell,
    openComments,
    showComments,
    closeComments,
    addComment,
    replaceCommentId,
    deleteComment,
    resolveThread,
    unresolveThread,
  } = useEditorComments({
    applyElementDelta,
    selfParticipant,
    // Bound below, once the teams the mention list comes from have loaded.
    onMentioned: (text, mentions) => mentionNotifyRef.current(text, mentions),
    // A Community visitor reads the plan, never its conversation (docs/specs/025-community/community.md).
    commentsOff: realtime.sessionCommunity !== null,
  });
  // Per-user editor preferences (docs/specs/007-editor/user-preferences.md): the state, the ref mirrors
  // the drag hook reads, and the localStorage read + D1 sync effects.
  // See useEditorPreferences.
  const {
    userPreferences,
    setUserPreferences,
    prefsSettled,
    autoRebindArrowsRef,
    alignmentGuidesRef,
  } = useEditorPreferences({
    ownerId: selfParticipant.id,
    passwordGated: sharePasswordGate !== null,
  });

  // Per-element note popover (state + open/close/setNote handlers)
  // lives in useEditorNotes. Invoked further down, after `commit`
  // exists.

  // Right-click context menu state (cursor position + element-scoped
  // vs tab-scoped mode). See useEditorContextMenu.
  const { contextMenu, setContextMenu, closeContextMenu } = useEditorContextMenu();

  // Element link picker (open + anchor state) and the link read/write
  // handlers live in useElementLinks. Invoked further down, after
  // `openProject` + the selection helpers exist.

  const confirm = useConfirm();
  const toast = useToast();
  // Persistence-facing state: autosave status pill + savedAt, project
  // name (mirrored to the tab title), the Explorer's owned + shared
  // project lists, and the transient import-error toast — plus the two list-refresh helpers the hydration
  // + autosave paths call. See editor-persistence; the slice is spread
  // into the returned view-model below, so the explicit return doesn't
  // re-list these.
  const persistence = useEditorPersistence({ toast });
  const {
    setSaveStatus,
    setSavedAt,
    projectName,
    setProjectName,
    projectItemTypes,
    setProjectItemTypes,
    setImportError,
  } = persistence;
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
  } = usePresenceState();
  // The plan's links are the index's: the badge and the presence stack read them from there.
  usePlanShareState({
    projectId,
    serverStored: realtime.projectServerStored,
    sessionShareCode,
    shareDialogOpen: dialogs.shareDialogOpen,
    setShareable: setProjectShareable,
  });
  // The person's plans, for the pickers that name another plan: read from the index once the plan is open and the
  // browser idle (usePlanList), never inside a workbench, which reaches its one plan only.
  const { projectList, refreshProjectList } = usePlanList(
    hydrated && !workbenchMode && !embedMode,
    selfParticipant.id,
  );
  // The deleted state (docs/specs/013-workspace/trash.md): the project is in
  // the Trash. Set by the load, the room and the autosave.
  const projectTrashed = useProjectTrashed({
    projectId,
    viaShareLink: sessionShareCode !== null,
  });
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
  // The project's structure (tabs, their order and folders, the name, the
  // deck) is read-only for a view link and for any tab-scoped link: a scoped
  // edit link edits its one tab's content, nothing around it
  // (docs/specs/013-workspace/tab-scoped-share-links.md).
  const isStructureReadOnly = isReadOnly || sessionTabScope !== null;
  return {
    addComment,
    alignmentGuidesRef,
    applyElementDelta,
    autoRebindArrowsRef,
    canEdit,
    canToggleRole,
    closeComments,
    closeContextMenu,
    commentThreadOpenCell,
    commentThreadOpenId,
    confirm,
    contextMenu,
    copying,
    deleteComment,
    isReadOnly,
    isStructureReadOnly,
    lastSeenRef,
    linkedActionsRef,
    liveAgents,
    livePresence,
    markSeen,
    mentionNotifyRef,
    openComments,
    showComments,
    participant,
    passwordRetry,
    peerMotion,
    persistence,
    prefsSettled,
    presenceClock,
    projectItemTypes,
    projectList,
    projectName,
    projectShareable,
    projectTeamId,
    projectTrashed,
    realtime,
    refreshProjectList,
    remoteSelections,
    remoteTabFocus,
    replaceCommentId,
    resolveThread,
    roomRef,
    sessionRole,
    sessionShareCode,
    sessionShareCodeRef,
    setContextMenu,
    setCopying,
    setImportError,
    setIsOwner,
    setLiveAgents,
    setLivePresence,
    setProjectItemTypes,
    setProjectName,
    setProjectOwnerColor,
    setProjectOwnerId,
    setProjectOwnerName,
    setProjectShareCode,
    setProjectShareable,
    setProjectTeamId,
    setRemoteCursors,
    setRemoteSelections,
    setRemoteTabFocus,
    setSaveStatus,
    setSavedAt,
    setSessionRole,
    setSessionShareCode,
    setSharePasswordGate,
    setUserPreferences,
    sharePasswordGate,
    toast,
    toggleViewPreview,
    unresolveThread,
    userPreferences,
    viewPreview,
  };
}

export type EditorCollaborationSlice = ReturnType<typeof useEditorCollaboration>;
