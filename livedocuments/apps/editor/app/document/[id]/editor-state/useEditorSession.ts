import { useRef, useState } from 'react';
import type { CommentMention } from '@livedocuments/document';
import { useEditorContextMenu } from '@/hooks/canvas/useEditorContextMenu';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { useViewPreview } from '../useViewPreview';
import { useParticipantSession } from '../useParticipantSession';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { useEditorComments } from '@/hooks/collab/useEditorComments';
import type { Participant } from '@/lib/identity';
import { useDocumentList } from '@/hooks/persistence/useDocumentList';
import { useDocumentShareState } from '@liveworkspace/workbench/hooks/persistence/useDocumentShareState';
import { useDocumentTrashed } from '../useDocumentTrashed';
import { useElementDeltas } from '@/hooks/collab/useElementDeltas';
import { usePresenceState } from '../usePresenceState';
import { useEditorPersistence } from '../editor-persistence';
import { useEditorRealtime } from '../editor-realtime';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorTools } from './useEditorTools';

// Who is here and what they may do: the local participant, the sharing and realtime-room slice, the comment
// threads, editor preferences, the context menu, confirm and toast, the persistence and presence state slices,
// which tabs have loaded, the document id and hydration flag, the Trash state, the role preview and the Participant
// session.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorSession({
  documentSlice,
  selectionSlice,
  toolsSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  toolsSlice: EditorTools;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { embedMode, workbenchMode, workbench, tickTabs } = documentSlice;
  const { sessionTabScope, activeId, setSelectedId, setEditingId, setMultiSelectedIds } =
    selectionSlice;
  const { dialogs } = toolsSlice;
  // Local-session participant. Initialised to a stable placeholder so the
  // SSG output and the first client paint agree (Math.random() in a lazy
  // initialiser ran on both server and client and produced different
  // names, tripping React's hydration mismatch). The post-mount hydration
  // step below either loads a saved identity or mints a fresh random one
  // — both happen synchronously inside useLayoutEffect, so the user never
  // sees the placeholder.
  const [selfParticipant, setSelfParticipant] = useState<Participant>({
    id: 'self',
    name: 'Guest',
    color: '#0ea5e9',
    status: 'online',
  });
  // Keyboard-shortcut catalog modal + per-device disable toggle.
  // The toggle gates EVERY shortcut in useEditorKeyboardShortcuts
  // below; the modal opens from a button in the TabBar.
  const { enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled } = useShortcutsEnabled();
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
  // One tick / comment, applied here and sent to the room as a delta ahead of the autosave
  // (docs/specs/012-collaboration/collab-race-hardening.md). Shared by the comments and the checklist below.
  const applyElementDelta = useElementDeltas({ activeId, tickTabs, roomRef });
  // The mention notify (useCommentMentions, below): declared first because the
  // comments hook takes it before the teams it depends on exist.
  const mentionNotifyRef = useRef<(text: string, mentions: CommentMention[]) => void>(() => {});
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
    // A Community visitor reads the document, never its conversation (docs/specs/025-community/blueprints/community.md).
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

  // Right-click context menu state (cursor position + element-scoped
  // vs tab-scoped mode). See useEditorContextMenu.
  const { contextMenu, setContextMenu, closeContextMenu } = useEditorContextMenu();

  // Element link picker (open + anchor state) and the link read/write
  // handlers live in useElementLinks. Invoked further down, after
  // `openDocument` + the selection helpers exist.

  const confirm = useConfirm();
  const toast = useToast();
  // Persistence-facing state: autosave status pill + savedAt, document
  // name (mirrored to the tab title), the Explorer's owned + shared
  // document lists, and the transient import-error toast — plus the two list-refresh helpers the hydration
  // + autosave paths call. See editor-persistence; the slice is spread
  // into the returned view-model below, so the explicit return doesn't
  // re-list these.
  const persistence = useEditorPersistence({ toast });
  const {
    setSaveStatus,
    setSavedAt,
    documentName,
    setDocumentName,
    documentPresentation,
    setDocumentPresentation,
    setImportError,
  } = persistence;
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
  // Local laser trail — held in state so the overlay re-renders when
  // we append a point, but mutations stay cheap by always producing a
  // bounded array.
  // `localLaserTrail` now comes from useEditorBroadcast, declared
  // further down once the WS gates (roomRef, documentShareable...)
  // are in scope. Editor-page still reads it for the laserTrailRows
  // aggregator that Canvas consumes.
  // Dismissing a "shared with you" row lives in useDocumentListActions
  // (via useDocumentActions below), shared with /explorer and /new.
  // Tab ids whose full payload has been fetched. Hydration loads the
  // active tab inline; the rest pop in lazily when the user switches
  // to them. Tracked in a ref because it's only ever read inside the
  // effects, not rendered.
  const loadedTabIdsRef = useRef<Set<string>>(new Set());
  // Mirror of the ref above into reactive state, used by the JSX
  // gate that hides the template picker until the active tab's
  // content has actually been fetched. Without this the user sees
  // a "pick a template" flash on every fresh tab open: hydration
  // gives them the empty placeholder (elements.length === 0,
  // templateChosen unset), the picker renders, then the lazy fetch
  // resolves and the picker hides. Re-rendering on every change
  // would be wasteful; we only update this set after a
  // hydration / fetch lands, so the renders are bounded.
  const [loadedTabIds, setLoadedTabIds] = useState<Set<string>>(new Set());
  // Tab ids whose lazy fetch FAILED (network / 5xx — not a 404). Drives
  // the canvas's blocking error overlay so the user can't edit a blank
  // placeholder and have the autosave wipe the real server row (docs/specs/006-document/per-tab-storage.md).
  // `tabLoadRetryNonce` lets the Retry button re-run usePerTabLoad's
  // effect for the same active tab (deps otherwise unchanged).
  const [tabLoadErrors, setTabLoadErrors] = useState<Set<string>>(new Set());
  const [tabLoadRetryNonce, setTabLoadRetryNonce] = useState(0);
  // Mark a tab as loaded — its content is authoritative in local state,
  // so usePerTabLoad must skip it. Used by hydration and by the
  // locally-created tab paths (add / duplicate / import): those have no
  // server row to fetch yet, so without this they'd flash the loader
  // overlay (and never resolve, since the fetch 404s). Keeping them out
  // of the lazy-load path also makes the per-tab template picker fire
  // deterministically for a fresh tab.
  const markTabLoaded = (id: string) => {
    loadedTabIdsRef.current.add(id);
    setLoadedTabIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };
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
  // Persistent document id. `null` until the post-mount hydration step
  // runs; that step reads ?d=<id> from the URL (or mints a fresh id +
  // updates the URL) and pulls any saved tabs + name from localStorage.
  // Saves are gated on `hydrated` so we never overwrite stored data
  // with the empty initial render.
  const [documentId, setDocumentId] = useState<string | null>(null);
  // The document's links are the index's: the badge and the presence stack read them from there.
  useDocumentShareState({
    documentId,
    serverStored: realtime.documentServerStored,
    sessionShareCode,
    shareDialogOpen: dialogs.shareDialogOpen,
    setShareable: setDocumentShareable,
  });
  const [hydrated, setHydrated] = useState(false);
  // The person's documents, for the pickers that name another document: read from the index once the document is open and the
  // browser idle (useDocumentList), never inside a workbench, which reaches its one document only.
  const { documentList, refreshDocumentList } = useDocumentList(
    hydrated && !workbenchMode && !embedMode,
    selfParticipant.id,
  );
  // The deleted state (docs/specs/013-workspace/trash.md): the document is in
  // the Trash. Set by the load, the room and the autosave.
  const documentTrashed = useDocumentTrashed({
    documentId,
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
  // What a Participant may do, and the guard on its commits (docs/specs/013-workspace/share-roles.md): text only.
  // `isReadOnly` stays true for a Participant: its text gestures open through `participant.can` alone.
  const participant = useParticipantSession(workbench?.ended ? 'view' : previewLevel, toast.info);
  // The document's structure (tabs, their order and folders, the name, the
  // deck) is read-only for a view link and for any tab-scoped link: a scoped
  // edit link edits its one tab's content, nothing around it
  // (docs/specs/013-workspace/tab-scoped-share-links.md).
  const isStructureReadOnly = isReadOnly || sessionTabScope !== null;

  return {
    selfParticipant,
    setSelfParticipant,
    shortcutsEnabled,
    setShortcutsEnabled,
    realtime,
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
    applyElementDelta,
    mentionNotifyRef,
    commentThreadOpenId,
    commentThreadOpenCell,
    openComments,
    closeComments,
    addComment,
    replaceCommentId,
    deleteComment,
    resolveThread,
    unresolveThread,
    userPreferences,
    setUserPreferences,
    prefsSettled,
    autoRebindArrowsRef,
    alignmentGuidesRef,
    contextMenu,
    setContextMenu,
    closeContextMenu,
    confirm,
    toast,
    persistence,
    setSaveStatus,
    setSavedAt,
    documentName,
    setDocumentName,
    documentPresentation,
    setDocumentPresentation,
    setImportError,
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
    followingRef,
    loadedTabIdsRef,
    loadedTabIds,
    setLoadedTabIds,
    tabLoadErrors,
    setTabLoadErrors,
    tabLoadRetryNonce,
    markTabLoaded,
    retryActiveTabLoad,
    documentId,
    setDocumentId,
    hydrated,
    setHydrated,
    documentList,
    refreshDocumentList,
    documentTrashed,
    viewPreview,
    canToggleRole,
    toggleViewPreview,
    canEdit,
    isReadOnly,
    participant,
    isStructureReadOnly,
  };
}

export type EditorSession = ReturnType<typeof useEditorSession>;
