'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffectEvent,
} from 'react';
import {
  isEventStormingTab,
  onlyDraftNotesChanged,
  stampTabKind,
  isBoxed,
  resolveSlide,
  slideBounds,
  stampNewElementLayers,
  voteHidesCursors,
  elementActions,
  type BoxedElement,
  type CommentMention,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';

import { useWhiteboard } from '@/hooks/canvas/useWhiteboard';
import { useSnapColours } from '@/hooks/canvas/useSnapColours';
import { isPathEditing } from '@/lib/path-edit';
import { usePathCommits } from '@/hooks/canvas/usePathCommits';
import { useCanvasEraser } from '@/hooks/canvas/useCanvasEraser';
import { useCanvasTool } from '@/hooks/canvas/useCanvasTool';
import { useCommentMentions } from '@/hooks/collab/useCommentMentions';
import { useDesktopOnlyToolExit } from '@/hooks/canvas/useDesktopOnlyToolExit';
import { isMobileViewportSync } from '@/lib/responsive';
import { useLaserConfig } from '@/hooks/canvas/useLaserConfig';
import { useEraserConfig } from '@/hooks/canvas/useEraserConfig';
import { useFormatConfig } from '@/hooks/canvas/useFormatConfig';
import { useStyleMemory } from '@/hooks/canvas/useStyleMemory';
import { useQuickStyle } from '@/hooks/canvas/useQuickStyle';
import { useSwatchOverrides } from '@/hooks/canvas/useSwatchOverrides';
import { getTheme } from '@/lib/themes';
import { DEFAULT_SCHEME_ID } from '@livediagram/document';
import { useEditorMode, usePinTabOpening } from '@/hooks/editor/useEditorMode';
import { editorModeShortcut } from '@/hooks/editor/editor-mode-shortcut';
import { announce } from '@/lib/announcer';
import { useTabOpensIn } from '@/hooks/editor/useTabOpensIn';
import { usePortalSetters } from '@/hooks/canvas/usePortalSetters';
import { useBehaviourElements } from '@/hooks/canvas/useBehaviourElements';
import { useCollabElements } from '@/hooks/canvas/useCollabElements';
import { useQuizElements } from '@/hooks/canvas/useQuizElements';
import { useQaBoard } from '@/hooks/canvas/useQaBoard';
import { useFollowMe } from '@/hooks/collab/useFollowMe';
import { useFacilitator } from '@/hooks/collab/useFacilitator';
import { useFocusInvite } from '@/hooks/collab/useFocusInvite';
import { FOCUS_PRESS_MESSAGE, focusPressOutcome } from '@/lib/focus-audience';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { useCellLinkPicker } from '@/hooks/canvas/useCellLinkPicker';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { usePublishPicture } from '@/hooks/persistence/usePublishedPicture';
import { useCommentPicturesLoader } from '@/lib/comment-pictures';
import { useBoardSceneInsert } from '@/hooks/canvas/useBoardSceneInsert';
import { useLibraryShapeInsert } from '@/hooks/canvas/useLibraryShapeInsert';
import { useClipboard } from '@/hooks/canvas/useClipboard';
import { useDocumentActions } from '@/hooks/canvas/useDocumentActions';
import { useEditorContextMenu } from '@/hooks/canvas/useEditorContextMenu';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { useViewPreview } from './useViewPreview';
import { usePowerUserOffer } from '@/hooks/ui/usePowerUserOffer';
import { useDocumentHistory } from '@/hooks/canvas/useDocumentHistory';
import { useCanvasA11y } from '@/hooks/canvas/useCanvasA11y';
import { useLaneSettle } from '@/hooks/canvas/useLaneSettle';
import { useNudgeSelection } from '@/hooks/canvas/useNudgeSelection';
import { useFolders } from '@/hooks/persistence/useFolders';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import {
  readUserPreferences,
  toggleRecentExcluded,
  writeUserPreferences,
} from '@/lib/user-preferences';
import type { PollCandidate } from '@/lib/poll-collaborators';
import { track } from '@/lib/telemetry';
import { pollResultElement } from '@/lib/poll-capture';
import { useActivityLogDebounce } from '@/hooks/collab/useActivityLogDebounce';
import { useActivityLogEmitter } from '@/hooks/collab/useActivityLogEmitter';
import { useEditorBroadcast } from '@/hooks/collab/useEditorBroadcast';
import { useLivePoll } from '@/hooks/collab/useLivePoll';
import { useFavourites } from '@/hooks/persistence/useFavourites';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { useEditorComments } from '@/hooks/collab/useEditorComments';
import { useEditorDrag } from '@/hooks/canvas/useEditorDrag';
import { useNoteActions } from '@/hooks/canvas/useNoteActions';
import { usePhotoPicker } from '@/hooks/canvas/usePhotoPicker';
import { warmBoundaryModel } from '@/lib/photo-model/client';
import { usePhotoDraft } from '@/hooks/canvas/usePhotoDraft';
import { useEditorImages } from '@/hooks/canvas/useEditorImages';
import { useEditorNotes } from '@/hooks/canvas/useEditorNotes';
import { useElementLinks } from '@/hooks/canvas/useElementLinks';
import { useElementSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { useElementStyle } from '@/hooks/canvas/useElementStyle';
import { useStylePreview } from '@/hooks/canvas/useStylePreview';
import { useShapeDrawing } from '@/hooks/canvas/useShapeDrawing';
import { useShareLinks } from '@/hooks/persistence/useShareLinks';
import { useTabActions } from '@/hooks/persistence/useTabActions';
import { useTeamLibrariesSweep } from '@/hooks/persistence/useTeamLibrariesSweep';
import { useVoteReview } from '@/hooks/canvas/useVoteReview';
import { useTeams } from '@/hooks/persistence/useTeams';
import { useTabFolders } from '@/hooks/persistence/useTabFolders';
import { useTabCanvas } from '@/hooks/canvas/useTabCanvas';
import { useTabSession } from '@/hooks/persistence/useTabSession';
import { useEditorKeyboardShortcuts } from '@/hooks/canvas/useEditorKeyboardShortcuts';
import { useEditorViewport } from '@/hooks/canvas/useEditorViewport';
import { useSlideDeck } from './useSlideDeck';
import { slideMaxZoom } from '@/lib/presentation-config';
import { useCanvasPinchZoom } from '@/hooks/canvas/useCanvasPinchZoom';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { participantKey, type Participant } from '@/lib/identity';
import { markNameConfirmed } from '@/lib/local-identity';
import {
  apiNotifyActionAssigned,
  apiSaveDocumentMeta,
  apiSaveSelf,
  type ChangeLogEntry,
} from '@/lib/api-client';
import {
  emptyEntryHistory,
  entryHistoryCancel,
  entryHistoryPush,
  type EntryHistory,
} from '@/lib/entry-history';
import {
  actionRowsFromElements,
  commentRowsFromElements,
} from '@/components/panels/CollaboratePanel';

import { useEditorActions } from '@/hooks/collab/useEditorActions';
import { createTab, deriveTabLoadState, mergeAiElements, patchTab } from './editor-page-helpers';
import { useAutosave } from './useAutosave';
import { useDocumentTrashed } from './useDocumentTrashed';
import { useDriveFollow } from './useDriveFollow';
import { createRemoteOpJournal, type RemoteOpJournal } from './save-baseline';
import { useElementDeltas } from '@/hooks/collab/useElementDeltas';
import { usePerTabLoad } from './usePerTabLoad';
import { useReactionBursts } from '@/hooks/canvas/useReactionBursts';
import { useRoomConnection } from './useRoomConnection';
import { useRoomResync } from './useRoomResync';
import { useIdentityBootstrap } from './useIdentityBootstrap';
import { useEditorHistory } from './useEditorHistory';
import { useRevertPreview } from './useRevertPreview';
import { useTemplateFlow } from './useTemplateFlow';
import { usePanelLayout } from './usePanelLayout';
import { usePresenceRows } from './usePresenceRows';
import { usePresenceState } from './usePresenceState';
import { useEditorDialogs } from './useEditorDialogs';
import { useElementHelpers, selectionIds } from './useElementHelpers';
import { useElementCreation } from './useElementCreation';
import { useMindGrowth } from './useMindGrowth';
import { useLayersState } from './useLayersState';
import { useInlineIconMutators } from './useInlineIconMutators';
import { usePresenceBroadcast } from './usePresenceBroadcast';
import { useSelectionEditing } from './useSelectionEditing';
import { useFormatTool } from './useFormatTool';
import { useCleanupPreview } from '@/hooks/canvas/useCleanupPreview';
import { useTabEntryEffects } from './useTabEntryEffects';
import { useCollabDeepLink, useCollabDeepLinkCapture } from './useCollabDeepLink';
import { useEditorUiState } from './editor-ui-state';
import { useTabScope } from './useTabScope';
import { useEditorPersistence } from './editor-persistence';
import { useEditorRealtime } from './editor-realtime';
import { useAssignRef, useLatest } from '@/hooks/ui/useLatest';

// Activity-log past/future stacks share the cap with the
// state-snapshot stack: we can't undo past what useDocumentHistory
// remembers, so there's no point in tracking more log entries than
// that. Imported from the hook directly so the two stacks can't
// drift.

export function useEditorState(opts: { embed?: boolean } = {}) {
  // Read-only embed view (docs/specs/013-workspace/embeds.md). The flag forces view behaviour
  // regardless of the share role, suppresses the visitor identity
  // screen, and EditorView swaps the chrome for the embed badge +
  // tab switcher. Constant for the lifetime of the page (it comes
  // from which route mounted us), so it's safe in derived consts.
  const embedMode = opts.embed === true;
  const initialTabs: Tab[] = [createTab('Tab 1')];

  // Embed page-view telemetry (docs/specs/013-workspace/embeds.md) is emitted by editor-page.tsx —
  // exactly one site, so an embed render can't be double-counted.

  // Clerk wiring (token provider + guest→authed migration). One hook
  // does both — see `hooks/useClerkApiBootstrap.ts`. The values it
  // returns are the same ones `useAuth()` would; we read them via the
  // hook so the page has one source of truth.
  const { authLoaded, clerkUserId, clerkDisplayName } = useClerkApiBootstrap();
  // Keep the participant record's profile picture current (docs/specs/014-identity/profile-picture.md §6).
  usePublishPicture(clerkUserId);

  const {
    tabs,
    canUndo,
    canRedo,
    commit: rawCommitTabs,
    tick: tickTabs,
    markCheckpoint: rawMarkCheckpoint,
    cancelToCheckpoint: rawCancelToCheckpoint,
    reset: rawResetTabs,
    applyRemote: applyRemoteTabs,
    undo: undoHistory,
    redo: redoHistory,
  } = useDocumentHistory(initialTabs);

  // Per-step Undo/Redo memory for the activity log (docs/specs/012-collaboration/activity-and-audit.md): one
  // token-stamped marker per history step, holding the log entry that
  // step emitted or null. Every history push below pairs with a marker
  // push; the emitter (useActivityLogEmitter) fills a marker in — the
  // debounced emitters by the token their gesture's push returned
  // (their flush can land after OTHER steps were pushed), the
  // immediate commit-then-emit path by newest; and undo/redo
  // (useEditorHistory) pop/replay markers 1:1 with the snapshot stack.
  // So undoing an entry-less step (add tab, vote, no-op checkpoint)
  // can never delete some other edit's audit row. A ref because
  // nothing renders from it and the matching API call needs a
  // synchronous mutation.
  const entryHistoryRef = useRef<EntryHistory>(emptyEntryHistory());
  const historyTokenRef = useRef(0);
  const commitTabs = (mapTabs: (ts: Tab[]) => Tab[]): number => {
    const token = ++historyTokenRef.current;
    entryHistoryRef.current = entryHistoryPush(entryHistoryRef.current, token);
    // Layer stamping (docs/specs/006-document/layers.md): elements APPEARING in this commit without
    // a valid layerId land on the active layer. One choke point, so no
    // individual creation path (draw, paste, AI, template, Mermaid
    // import) carries layer logic. stampNewElementLayers no-ops on tabs
    // that never materialised `layers`, and on undo/remote applies (which
    // bypass commitTabs entirely).
    rawCommitTabs((ts) => {
      // Tab kind (docs/specs/021-event-storming/event-storming.md): a committed tab says what KIND of board it
      // is, rather than leaving a reader to know that absence means
      // 'diagram'. Same choke point as the layer stamp below, and
      // `stampTabKind` returns the tab unchanged when it already has one,
      // so an untouched tab keeps its identity for the memoised views.
      const next = mapTabs(ts).map(stampTabKind);
      const stamp = activeLayerStampRef.current;
      if (!stamp) return next;
      return next.map((t) => {
        if (t.id !== stamp.tabId) return t;
        const prev = ts.find((p) => p.id === t.id);
        const els = stampNewElementLayers(
          prev?.elements ?? [],
          t.elements,
          t.layers,
          stamp.layerId,
        );
        return els === t.elements ? t : { ...t, elements: els };
      });
    });
    return token;
  };
  const markCheckpoint = (): number => {
    // A gesture inside the draft (dragging a draft note) must not push a step
    // of its own, or Undo after Add would stop at that drag instead of taking
    // the whole import back.
    if (photoDraftOpenRef.current) return historyTokenRef.current;
    const token = ++historyTokenRef.current;
    entryHistoryRef.current = entryHistoryPush(entryHistoryRef.current, token);
    rawMarkCheckpoint();
    return token;
  };
  // Stable identity: usePerTabLoad takes this, and an identity that changed
  // every render once turned a failed tab load into a refetch on every
  // re-render (the 30s presence tick included), each one an Error report.
  const resetTabs = useCallback(
    (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => {
      // reset clears the snapshot stacks (context switch), so the
      // markers must go with them or the pairing skews.
      entryHistoryRef.current = emptyEntryHistory();
      rawResetTabs(tabs);
    },
    [rawResetTabs],
  );
  // Escape-cancel for an in-flight drag: restore the gesture's
  // checkpoint and DISCARD the step (no redo entry — a cancelled drag
  // never happened), popping its marker in step.
  // Restore the armed checkpoint and DISCARD the step. The photo draft's own
  // Discard calls this directly: it is the gesture's owner, so it is the one
  // caller that always means it.
  const cancelGesture = () => {
    entryHistoryRef.current = entryHistoryCancel(entryHistoryRef.current);
    rawCancelToCheckpoint();
  };
  const cancelToCheckpoint = () => {
    // Inside a draft there is no per-gesture checkpoint for anyone ELSE to go
    // back to — the draft's own is the only one, and popping it because a drag
    // was cancelled would take the whole import with it. The dragged note
    // simply stays where it was let go; Discard is how you undo the import.
    if (photoDraftOpenRef.current) return;
    cancelGesture();
  };

  // Stable id + name projection of the tabs for link-badge hover cards
  // (docs/specs/008-canvas/canvas-and-palette.md): keyed on a signature so it only changes when a tab is
  // added / removed / renamed, NOT on every element edit, keeping the
  // memoised element views from re-rendering as the user types.
  //
  // NUL and SOH separate the fields because neither can occur in an id or a
  // name, so no rename can forge a signature by containing the delimiter.
  // Written as ESCAPES, not literal bytes: as raw bytes they made this the
  // only non-text file in the repo, `file` reported it as `data`, and
  // ripgrep answered every search of it with "binary file matches" and moved
  // on. On the 2,800-line module that composes every editor hook and builds
  // EditorContext, that silently broke "find all usages": a dead-code sweep
  // saw a hook's definition and no callers, because every call site is in
  // here. Same runtime string, searchable source.
  const tabSig = tabs.map((t) => `${t.id}\u0000${t.name}`).join('\u0001');
  const tabSummaries = useMemo(
    () =>
      tabSig === ''
        ? []
        : tabSig.split('\u0001').map((entry) => {
            const [id = '', name = ''] = entry.split('\u0000');
            return { id, name };
          }),
    [tabSig],
  );

  // Ephemeral selection / edit UI (active tab, single + multi selection,
  // edit + format-painter source, the two transient picker flags). See
  // editor-ui-state. Destructured here because the body references these
  // names directly throughout; the whole slice is spread into the
  // returned view-model below (the `...panelLayout` / `...dialogs`
  // convention), so the explicit return doesn't re-list these.
  // A tab-scoped share session's one tab (docs/specs/013-workspace/tab-scoped-share-links.md). Created first:
  // the active-tab guard in editor-ui-state reads its ref.
  const tabScope = useTabScope();
  const { sessionTabScope, setSessionTabScope, tabScopeRef, isOutOfScope } = tabScope;
  const uiState = useEditorUiState(initialTabs[0]!.id, tabScopeRef);
  const {
    activeId,
    setActiveId,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    setEditCursorAtEnd,
    formatSourceId,
    setFormatSourceId,
    multiSelectedIds,
    setMultiSelectedIds,
    templatePickerMode,
    setTemplatePickerMode,
  } = uiState;
  // Drag state lives inside the useEditorDrag hook, lifted out of
  // this component to keep the page focused on orchestration. The
  // hook is invoked further down (after `tick`, `commit`,
  // `applyFormatFromSource` and the rest of the drag dependencies
  // exist).
  // Floating-panel layout (positions + open/visible flags) is one
  // cohesive slice — see usePanelLayout. Spread wholesale into the
  // returned view-model (see the return below).
  const panelLayout = usePanelLayout();
  const dialogs = useEditorDialogs();
  // Canvas tool (Pan / Select / Laser). See useCanvasTool: the raw
  // setter serves internal auto-switches, the tracked selectCanvasTool
  // serves the user-facing pickers.
  // The laser pen (docs/specs/008-canvas/laser-panel.md): persisted per browser, published with every
  // laser sample, and edited from the Laser Panel.
  const laserPen = useLaserConfig();
  // The eraser's settings (docs/specs/008-canvas/eraser-panel.md): read by the erase gesture below and
  // edited from the Eraser Panel.
  const eraserSettings = useEraserConfig();
  // The format painter's settings (docs/specs/008-canvas/format-panel.md): which parts of a copied style
  // travel, read by the paint and edited from the Format Panel.
  const formatSettings = useFormatConfig();
  const { canvasTool, setCanvasTool, selectCanvasTool, exitAvatarTool, toolBeforeCurrent } =
    useCanvasTool({
      defaultPan: embedMode,
    });
  useDesktopOnlyToolExit(canvasTool, setCanvasTool);
  // Persistent Format painter tool (docs/specs/008-canvas/canvas-and-palette.md): the mode-boundary reset +
  // the exit that restores the pre-Format tool. See useFormatTool.
  const { formatToolActive, exitFormatTool } = useFormatTool({
    canvasTool,
    setCanvasTool,
    setFormatSourceId,
  });
  // templatePickerMode (from useEditorUiState) gates the derived
  // `identityOnlyScreenOpen` chrome flag; transitions live in
  // `openTemplatePicker` / `skipTemplatePicker` / `chooseTemplate`.
  // Whether the participant has explicitly confirmed their identity in a
  // modal at least once (either Create Document on the welcome flow, Skip,
  // or Join Document on the join flow). Persisted via localStorage so a
  // returning visitor isn't re-prompted. Brand new visitors landing on a
  // pre-existing document see the join flow until they confirm.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  // True after hydration if we successfully loaded a saved document from
  // the API (i.e. the user is joining someone else's document, not
  // starting a fresh one). Drives the join-screen trigger.
  const [loadedExistingDocument, setLoadedExistingDocument] = useState(false);
  // True when the URL points at a document that the API didn't return
  // (deleted, never existed, or owned by someone else). Renders the
  // NotFound surface instead of the editor + welcome modal.
  const [documentNotFound, setDocumentNotFound] = useState(false);
  // Distinct from documentNotFound (a clean 404): the load call itself
  // FAILED (network down / 5xx), which is retryable. Drives ApiErrorPage.
  const [loadError, setLoadError] = useState(false);
  // Loading screen is the default — every first paint shows the
  // spinner, including SSG output, so users hitting a `?d=` / `?s=`
  // URL never glimpse the empty canvas and assume their data is gone.
  // The hydration useLayoutEffect flips it to false either immediately
  // (no URL params → straight to welcome modal) or once the API call
  // resolves (params → load the document first).
  const [loadingDocument, setLoadingDocument] = useState(true);
  // User-facing tool picker. Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is a non-editing presenter
  // mode, so entering it clears any selection: an element selected beforehand
  // would otherwise keep its handles (dimmed under the shroud) and pop back
  // on exit. Wraps the tracked selectCanvasTool so every entry point (palette
  // dropdown, keyboard) routes through it; internal auto-switches keep using
  // the raw setCanvasTool and are unaffected.
  const pickCanvasTool = (tool: CanvasTool) => {
    // Eraser / Format / Laser / Spotlight / Isometric all act on existing
    // content, so they're unavailable on an empty canvas — the palette greys
    // them out, and this guards the keyboard-shortcut path to match. Select +
    // Hand stay available.
    const tabForTool = tabs.find((t) => t.id === activeId) ?? tabs[0];
    if (
      tabForTool &&
      tabForTool.elements.length === 0 &&
      (tool === 'eraser' ||
        tool === 'format' ||
        tool === 'laser' ||
        tool === 'spotlight' ||
        tool === 'avatar' ||
        tool === 'isometric')
    ) {
      return;
    }
    // A slide deck spans tabs, so a tab-scoped session has none
    // (docs/specs/013-workspace/tab-scoped-share-links.md): the server withholds it and refuses writes.
    if (tool === 'slide-deck' && tabScopeRef.current !== null) {
      toast.info("The slide deck isn't shared with you");
      return;
    }
    // Desktop-only (docs/specs/012-collaboration/presentation-mode.md): the pickers
    // already hide it on a phone, so this catches any path that still asks.
    if (tool === 'slide-deck' && isMobileViewportSync()) {
      toast.info('Slide Deck is only available on a larger screen');
      return;
    }
    // Spotlight and Avatar mode (docs/specs/008-canvas/avatar-mode.md) are both non-editing presenter
    // modes, so both clear the selection on entry.
    if (tool === 'spotlight' || tool === 'avatar') {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    }
    selectCanvasTool(tool);
  };
  // Pressing a Selection Mode button (docs/specs/009-elements/mode-button.md). Pressing the button for the
  // mode you are ALREADY in takes you back where you came from: on a read-only
  // walkthrough the button may be the only control on screen, so it has to work
  // in both directions. Everything else is an ordinary pick, guards included.
  const pressModeButton = (mode: CanvasTool) => {
    pickCanvasTool(canvasTool === mode ? toolBeforeCurrent() : mode);
  };
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
  // Who "I" am in a dot vote (docs/specs/012-collaboration/collab-race-hardening.md): the collab key, which is stable and
  // safe to publish, rather than the owner id, which is a guest's credential.
  const voteSelfId = participantKey(selfParticipant);
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
    documentShareCode,
    setDocumentShareCode,
    setIsOwner,
    setDocumentOwnerId,
    setDocumentOwnerName,
    setDocumentOwnerColor,
    copying,
    setCopying,
    setShareLinks,
    setSharePassword,
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
  // The mention notify (useCommentMentions, below): declared first because the
  // comments hook takes it before the teams it depends on exist.
  const mentionNotifyRef = useRef<(text: string, mentions: CommentMention[]) => void>(() => {});
  // Comment-thread state + handlers. The open-id drives the
  // dynamic <CommentThreadPopover> JSX gate further down; the
  // action callbacks bind to the selection popover + the popover
  // itself. Mutations bypass the history hook (no Ctrl+Z eats a
  // half-typed comment) and travel as deltas; see
  // apps/live/hooks/collab/useEditorComments.ts.
  const {
    commentThreadOpenId,
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
    setAiPanelVisible: panelLayout.setAiPanelVisible,
  });

  // Hide / show a document in the Explorer panel's Recent list (docs/specs/013-workspace/hide-from-recent.md).
  // Read-modify-writes from the CACHE, not the React snapshot: the PUT
  // sends the whole preferences blob, so a stale snapshot would clobber
  // flags another tab wrote.
  // Per-user document stars (docs/specs/013-workspace/favourites.md), for the Explorer panel's rows.
  // Not for the pre-hydration placeholder id, like the folders and preferences
  // hooks: that fetched the stars once for "self" and again for the real id.
  const { favouriteIds, toggleFavourite } = useFavourites(
    selfParticipant.id === 'self' ? null : selfParticipant.id,
  );

  const toggleRecentExclusion = (documentId: string) => {
    const latest = readUserPreferences();
    setUserPreferences({
      ...latest,
      recentExcludedIds: toggleRecentExcluded(latest, documentId),
    });
  };

  // Per-element note popover (state + open/close/setNote handlers)
  // lives in useEditorNotes. Invoked further down, after `commit`
  // exists.

  // Right-click context menu state (cursor position + element-scoped
  // vs tab-scoped mode). See useEditorContextMenu.
  const { contextMenu, setContextMenu, closeContextMenu } = useEditorContextMenu();

  // Element link picker (open + anchor state) and the link read/write
  // handlers live in useElementLinks. Invoked further down, after
  // `openDocument` + the selection helpers exist.

  // Folders for the owner — state + the mutation triple
  // (create / rename / delete) come from the shared useFolders
  // hook so editor-page, /new, and /explorer all share the same
  // behaviour. The hook handles its own autoLoad fetch on
  // mount, so we don't have to manually pull /api/folders here
  // anymore.
  const {
    folders,
    createFolder,
    renameFolder,
    deleteFolder: hookDeleteFolder,
  } = useFolders(selfParticipant.id === 'self' ? null : selfParticipant.id);
  const confirm = useConfirm();
  const toast = useToast();
  // Persistence-facing state: autosave status pill + savedAt, document
  // name (mirrored to the tab title), the Explorer's owned + shared
  // document lists, the activity/audit change log, and the transient
  // import-error toast — plus the two list-refresh helpers the hydration
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
    documentList,
    setDocumentList,
    sharedDocuments,
    setSharedDocuments,
    setChangeLog,
    setChangeLogLoading,
    setImportError,
    refreshDocumentList,
    refreshSharedList,
  } = persistence;
  // Realtime presence state (who's connected + their cursors / selections
  // / laser trails / tab focus). See usePresenceState; the room writes it
  // via the setters, the presence-row builders read the values.
  const {
    livePresence,
    setLivePresence,
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
    remoteAvatars,
    setRemoteAvatars,
    remoteViewports,
    setRemoteViewports,
  } = usePresenceState();
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
  const [hydrated, setHydrated] = useState(false);
  // The deleted state (docs/specs/013-workspace/trash.md): the document is in
  // the Trash. Set by the load, the room and the autosave.
  const documentTrashed = useDocumentTrashed({
    ownerId: selfParticipant.id,
    documentId,
    viaShareLink: sessionShareCode !== null,
  });
  // A change made in Google Drive reaches the open editor (docs/specs/022-drive-mirror/drive-mirror.md,
  // "Other views follow"). Only the owner's own session mirrors, never a share link.
  useDriveFollow({
    ownerId: selfParticipant.id === 'self' ? null : selfParticipant.id,
    documentId,
    enabled: sessionShareCode === null && !embedMode,
    refreshDocumentList,
    setDocumentName,
    setDocumentTrashed: documentTrashed.setDocumentTrashed,
  });
  // Sharing / session / owner / share-link state + the room refs all now
  // live in useEditorRealtime, destructured above. Embeds honour the share
  // code's role (docs/specs/013-workspace/embeds.md): a view code renders a read-only viewer, an edit
  // code an editable embed. The api enforces the role on every write, so
  // this is presentation-side only.
  // The role pill's local read-only preview (docs/specs/007-editor/live-app.md#role-pill).
  const { viewPreview, canToggleRole, toggleViewPreview, canEdit } = useViewPreview(
    sessionRole,
    () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setEditingId(null);
    },
  );
  const isReadOnly = !canEdit;
  // The document's structure (tabs, their order and folders, the name, the
  // deck) is read-only for a view link and for any tab-scoped link: a scoped
  // edit link edits its one tab's content, nothing around it
  // (docs/specs/013-workspace/tab-scoped-share-links.md).
  const isStructureReadOnly = isReadOnly || sessionTabScope !== null;
  // The once-ever power user mode offer (docs/specs/007-editor/power-user-mode.md). Its shortcut
  // counter rides the keyboard hook below.
  const powerUserOffer = usePowerUserOffer({
    prefs: userPreferences,
    settled: prefsSettled,
    editable: hydrated && !isReadOnly,
    embed: embedMode,
    zen: panelLayout.zenMode,
    apply: (next) => {
      setUserPreferences(next);
      writeUserPreferences(next, selfParticipant.id);
    },
    offer: toast.offer,
  });

  // Per-tab autosave. The previous snapshot lives in a ref so we can
  // diff: any tab whose object reference changed since last save is
  // ours to PUT; tab order / document rename hit the metadata PUT.
  // Debounced 600ms — feels responsive without hammering the API.
  // docs/specs/006-document/per-tab-storage.md has the design.
  const lastSavedTabsRef = useRef<Tab[]>([]);
  const lastSavedNameRef = useRef<string>('');
  // Peer ops that land while a save is in flight (docs/specs/012-collaboration/collab-race-hardening.md); see save-baseline.
  const remoteOpJournalRef = useRef<RemoteOpJournal>(createRemoteOpJournal());
  // Peer ops applied to `tabs`, as state: the journal's count as of this render, for the autosave.
  const [opsApplied, setOpsApplied] = useState(0);
  const countAppliedOp = useCallback(() => setOpsApplied((n) => n + 1), []);

  // True while a hover-preview is on screen (set by useStylePreview). Style
  // previews mutate `tabs` via tickTabs so they render live, but they must
  // never be persisted — only the click-commit should. Autosave reads this
  // ref to skip the debounced save while a preview is showing.
  const previewingRef = useRef(false);

  // Latest tabs mirrored to a ref so timer-driven callbacks (e.g.
  // the opacity debounce below) can read the post-debounce state
  // rather than whatever was in scope when the timer was scheduled.
  // Declared before the realtime + autosave hooks so the Yjs seed
  // (useRoomConnection) and loadAllTabs prefetch can read current tabs.
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  // Per-tab autosave (debounced + beforeunload flush). See useAutosave;
  // the last-saved mirror refs above are seeded by the hydration effect.
  const { hasUnsavedChanges } = useAutosave({
    hydrated,
    documentId,
    isReadOnly,
    tabs,
    documentName,
    selfId: selfParticipant.id,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    remoteOpJournalRef,
    opsApplied,
    previewingRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    setDocumentList,
    onDocumentTrashed: () => documentTrashed.setDocumentTrashed(true),
  });

  // Persist self only when name or color actually changed. Without
  // this guard the hydration GET → state set → effect fire chain
  // produced a useless PUT echoing the same values back to the
  // server. Status is in-memory only (the API doesn't store it) so
  // it doesn't count as a change.
  const lastPersistedSelfRef = useRef<{ name: string; color: string } | null>(null);

  // One-shot identity + document hydration. See useIdentityBootstrap.
  // Placed after the last-saved/loaded refs so they're declared before
  // being passed in.
  useIdentityBootstrap({
    authLoaded,
    passwordRetry,
    hydrated,
    clerkUserId,
    clerkDisplayName,
    embed: embedMode,
    activeId,
    selfParticipant,
    refreshDocumentList,
    refreshSharedList,
    resetTabs,
    refs: { lastPersistedSelfRef, lastSavedTabsRef, lastSavedNameRef, loadedTabIdsRef },
    set: {
      setActiveId,
      setChangeLog,
      setChangeLogLoading,
      setDocumentId,
      setDocumentName,
      setDocumentPresentation,
      setDocumentNotFound,
      setLoadError,
      setDocumentTrashed: documentTrashed.setDocumentTrashed,
      setDocumentOwnerColor,
      setDocumentOwnerId,
      setDocumentOwnerName,
      setDocumentShareable,
      setDocumentShareCode,
      setDocumentTeamId,
      setHydrated,
      setIsOwner,
      setLoadedExistingDocument,
      setLoadedTabIds,
      setLoadingDocument,
      setNameConfirmed,
      setSelfParticipant,
      setSessionRole,
      setSessionShareCode,
      setSessionTabScope,
      setSharedDocuments,
      setShareLinks,
      setSharePassword,
      setSharePasswordGate,
      setTemplatePickerMode,
    },
  });
  useEffect(() => {
    if (!hydrated) return;
    const prev = lastPersistedSelfRef.current;
    if (prev && prev.name === selfParticipant.name && prev.color === selfParticipant.color) {
      return;
    }
    lastPersistedSelfRef.current = { name: selfParticipant.name, color: selfParticipant.color };
    apiSaveSelf(selfParticipant).catch(() => {});
  }, [hydrated, selfParticipant]);

  const selfParticipantRef = useRef(selfParticipant);
  useEffect(() => {
    selfParticipantRef.current = selfParticipant;
  }, [selfParticipant]);
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
  });
  // Realtime room: WebSocket per shared document (presence + ops). See
  // useRoomConnection.
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): a shove somebody sent us, bumped by a sequence
  // number so two identical pushes both land. Canvas replays it onto our own
  // character — a push is a request to its owner, never a remote write.
  const [avatarShove, setAvatarShove] = useState<{ dx: number; dy: number; seq: number } | null>(
    null,
  );
  const receiveAvatarPush = useCallback((dx: number, dy: number) => {
    setAvatarShove((prev) => ({ dx, dy, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
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
    nameOf: (presenceId) => livePresence.find((p) => p.id === presenceId)?.name ?? 'Somebody',
  });
  useAssignRef(sessionBlockedRef, facilitator.sessionToolsBlocked);

  // The facilitator has freed an element we were holding (docs/specs/007-editor/live-app.md lock,
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
    hydrated,
    documentId,
    documentShareable,
    documentTeamId,
    selfParticipant,
    sessionShareCode,
    lastSeenRef,
    markSeen,
    selfParticipantRef,
    saveBaseline: { tabs: lastSavedTabsRef, name: lastSavedNameRef, journal: remoteOpJournalRef },
    countAppliedOp,
    sessionShareCodeRef,
    roomRef,
    applyRemoteTabs,
    setLivePresence,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteTabFocus,
    setRemoteLaserTrails,
    setRemoteAvatars,
    setRemoteViewports,
    setChangeLog,
    setDocumentName,
    setSelfParticipant,
    receiveAvatarPush,
    receiveReaction: reactions.receive,
    // Filled by the hook below, which cannot be declared up here because
    // taking an invitation navigates through the viewport (declared later
    // still). Same knot, and the same ref, as the portal's travel callback.
    receiveFocusHere: (from, tabId, at, zoom) => receiveFocusRef.current?.(from, tabId, at, zoom),
    receiveFacilitator: facilitator.receiveFacilitator,
    receiveSelectionReleased,
    readFacilitatorToken: facilitator.readFacilitatorToken,
    receivePoll: livePoll.receivePoll,
    receivePollAnswer: livePoll.receiveAnswer,
    receivePollEnd: livePoll.receivePollEnd,
    receiveQa: qaBoard.receiveQa,
    receiveDocumentTrashed: () => documentTrashed.setDocumentTrashed(true),
    resyncFromServer,
  });

  // Broadcast local selection + active-tab focus to peers (presence
  // indicators + TabBar avatars). See usePresenceBroadcast.
  usePresenceBroadcast({
    hydrated,
    documentId,
    documentShareable,
    documentTeamId,
    selectedId,
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
    resetTabs,
  });

  // Teams the signed-in user belongs to (docs/specs/013-workspace/teams.md), surfaced in the
  // search panel. Fetched lazily the first time search opens so
  // guest sessions and non-searching sessions never pay the request;
  // guests can't have teams, so the gate also requires a Clerk id.
  // Signed-in only (guests can't have teams). Loaded for the whole
  // session, not just while search is open, because the floating
  // Explorer panel now surfaces teams + their documents (a Teams
  // accordion, team rows in Recent, the current team document —
  // docs/specs/013-workspace/team-shared-documents.md), so the data has to be present whenever the panel is.
  const { teams } = useTeams(clerkUserId ?? null, {
    enabled: !!clerkUserId,
  });
  // Comment @-mentions (docs/specs/012-collaboration/comment-mentions.md): the document team's members as
  // candidates, and the notify a mentioning comment fires.
  const commentMentions = useCommentMentions({
    ownerId: clerkUserId ?? null,
    teams,
    documentTeamId,
    documentId,
  });
  useAssignRef(mentionNotifyRef, commentMentions.notifyMentioned);
  // Their libraries (docs/specs/013-workspace/team-shared-documents.md): one sweep per team. Feeds the search
  // panel's folder group AND the floating Explorer panel (team folder
  // tree + team documents in Recent + the current team document).
  const {
    teamFolders,
    teamDocuments,
    refresh: refreshTeamLibraries,
  } = useTeamLibrariesSweep(clerkUserId ?? null, teams, {
    enabled: !!clerkUserId,
  });

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;
  // The editor mode this person works on the tab in (docs/specs/007-editor/editor-modes.md): every
  // tool and rule gate keys on it, never on what the tab is.
  const editorMode = useEditorMode(activeTab, { canEdit });
  const drawMode = editorMode.mode === 'draw';
  // Comment authors' pictures for the open tab (docs/specs/014-identity/profile-picture.md §5).
  useCommentPicturesLoader(documentId, activeTab?.id, activeTab?.elements, sessionShareCode);

  // Vote privacy (docs/specs/012-collaboration/session-tools.md): while a hide-cursors vote is open on this tab,
  // peer cursors + laser trails are neither sent nor drawn. Derived here so
  // the outbound gate (useEditorBroadcast) and the render gate
  // (usePresenceRows) read the same value off the synced tab.
  const voteCursorsHidden = voteHidesCursors(activeTab.vote);

  // Outbound realtime broadcasters (cursor + laser) and the local
  // laser-trail buffer live in useEditorBroadcast. Same throttle,
  // same gates, same trail-clears-on-tool-change behaviour as
  // before, just out of the page file.
  const {
    broadcastCursor,
    broadcastLaser,
    broadcastAvatar,
    broadcastAvatarPush,
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
    cursorsHidden: voteCursorsHidden,
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
    viewportOffset,
    setViewportOffset,
    viewportZoom,
    setViewportZoom,
    zoomRef,
    canvasMainRef,
    getViewportCenter,
    fitToScreen,
    fitToBounds,
    centreOn,
    isCentredOn,
    scrollIntoView,
  } = useEditorViewport({ activeTab, selectedId });

  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): ask everyone else to come and look at this
  // element, at our zoom, on our tab.
  //
  // Sends the element's CENTRE rather than our pan: two people rarely have the
  // same window size, so copying a pan lands the element off-centre for anyone
  // whose canvas is a different shape. Our own view does not move — we are
  // already looking at it.
  const pressFocusButton = useCallback(
    (element: ShapeElement) => {
      const at = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
      const sent = broadcastFocusHere(at, zoomRef.current);
      const node = canvasMainRef.current;
      // A press that moves nobody is invisible from this side, so say which
      // kind of nobody it was: an empty room, or a room already looking at it.
      // `livePresence` is peers ONLY (the room excludes the asker from every
      // presence list it sends), so one other person is length 1.
      toast.info(
        FOCUS_PRESS_MESSAGE[
          focusPressOutcome({
            sent,
            peerIds: livePresence.map((p) => p.id),
            viewports: remoteViewports,
            size: { width: node?.offsetWidth ?? 0, height: node?.offsetHeight ?? 0 },
            tabId: activeId,
            at,
            zoom: zoomRef.current,
          })
        ],
      );
      track('Element', 'Used', 'BringFocus');
    },
    [broadcastFocusHere, livePresence, remoteViewports, activeId, zoomRef, canvasMainRef, toast],
  );

  // Slide deck (docs/specs/012-collaboration/presentation-mode.md). Owns the deck, the panel's editing verbs, and the
  // presentation Start runs. Placed after the viewport because presenting
  // frames each slide through it.
  const slideDeck = useSlideDeck({
    tabs,
    activeTabId: activeId,
    setActiveId,
    selectedId,
    multiSelectedIds,
    setSelectedId,
    setMultiSelectedIds,
    isReadOnly,
    saveDeck: (serialised) => {
      if (!hydrated || !documentId) return;
      setDocumentPresentation(serialised);
      void apiSaveDocumentMeta(
        selfParticipant.id,
        { id: documentId, presentation: serialised },
        sessionShareCode,
      ).catch(() => {
        // Best-effort, like every other metadata write: the deck is in
        // state either way and the next edit retries.
      });
    },
    loadAllTabs,
  });
  // Seed the deck once the document's stored blob arrives. Triggered only when a stored deck appears or
  // the document changes: hydrating on every deck edit would fight the editing verbs, so the blob itself
  // is read at that moment (an effect event), not depended on.
  const hydrateStoredDeck = useEffectEvent(() => slideDeck.hydrateDeck(documentPresentation));
  const hasStoredDeck = documentPresentation !== null;
  useEffect(() => {
    hydrateStoredDeck();
  }, [hasStoredDeck, documentId]);

  // What the presentation is showing right now, if anything.
  const presentingStep =
    slideDeck.presentingAt !== null ? slideDeck.runnable[slideDeck.presentingAt] : undefined;
  // The slide's elements, resolved fresh every render so an edit landing
  // underneath a presentation shows through (references, never copies).
  const presentingElements = useMemo(
    () => (presentingStep ? resolveSlide(presentingStep.slide, presentingStep.tab) : null),
    [presentingStep],
  );

  // Where the editor was looking before the deck took over, so exiting puts it
  // back. Without this you left a presentation zoomed to whatever the last
  // slide needed — often 250% on one box — and had to hunt around the canvas.
  const [preShowView, setPreShowView] = useState<{
    tabId: string;
    zoom: number;
    offset: { x: number; y: number };
  } | null>(null);
  const presenting = slideDeck.presentingAt !== null;
  // Captured on the way in, restored on the way out: state adjusted during render on the transition
  // (docs/specs/003-system-architecture/react-state-and-effects.md), so the restore lands in the same
  // commit as the exit instead of one frame later.
  const [wasPresenting, setWasPresenting] = useState(presenting);
  if (presenting !== wasPresenting) {
    setWasPresenting(presenting);
    if (presenting) {
      setPreShowView({ tabId: activeId, zoom: viewportZoom, offset: viewportOffset });
    } else if (preShowView) {
      setPreShowView(null);
      setActiveId(preShowView.tabId);
      setViewportZoom(preShowView.zoom);
      setViewportOffset(preShowView.offset);
    }
  }
  // Every editor keyboard surface is off while a deck is running (docs/specs/012-collaboration/presentation-mode.md).
  // The overlay owns the keyboard then — it consumes the keys it uses, but
  // everything else fell straight through to the editor, so pressing G in
  // front of a room armed a parallelogram on a canvas you cannot draw on.
  // Gated here rather than by swallowing keys in the overlay: this is the
  // switch the shortcut hooks already have, and it covers a surface added
  // later without anybody remembering to.
  const keyboardEnabled = shortcutsEnabled && !presenting;
  // Presenting moves the editor to the slide's tab and frames the slide. Both
  // are ordinary view state, and the effect above puts them back on exit.
  //
  // A LAYOUT effect, not an ordinary one: the canvas has already been handed
  // the new slide's elements by the time this runs, so fitting after paint
  // showed one frame of the new content under the OLD slide's camera. That is
  // the flash of "small in the corner" a deferred fit produces.
  const presentingSlideId = presentingStep?.slide.id;
  const presentingTabId = presentingStep?.tab.id;
  const [framedSlideId, setFramedSlideId] = useState(presentingSlideId);
  if (presentingSlideId !== framedSlideId) {
    setFramedSlideId(presentingSlideId);
    if (presentingTabId !== undefined && presentingTabId !== activeId) setActiveId(presentingTabId);
  }
  // A slide fills the screen by default. The editor's own fit caps at 100%
  // because a sparse canvas blown up looks broken in a workspace; a slide is
  // the only thing on a projector, so a one-box slide SHOULD be a big box —
  // unless the presenter has picked "Actual size" from the cog.
  const frameSlide = useEffectEvent((elements: NonNullable<typeof presentingElements>) => {
    const bounds = slideBounds(elements);
    if (bounds) fitToBounds(bounds, { maxZoom: slideMaxZoom(slideDeck.config) });
  });
  const slideZoom = slideDeck.config.zoom;
  useLayoutEffect(() => {
    if (presentingElements) frameSlide(presentingElements);
  }, [presentingSlideId, presentingElements, slideZoom]);

  // ...and fit again whenever the canvas CHANGES SIZE while presenting.
  //
  // Entering a presentation changes the size of the very box the fit measures,
  // and all of it lands after the effect above: the browser goes fullscreen,
  // and the header and tab bar leave with the zen treatment. Fitting against
  // the pre-presentation rect centred slide one on a viewport that no longer
  // existed by the time it painted, so it arrived shoved into a corner with
  // its top clipped.
  //
  // A ResizeObserver rather than a window `resize` listener, because hiding
  // the chrome changes the canvas's height without the WINDOW changing size at
  // all. This covers that, fullscreen arriving late, fullscreen being refused,
  // an ordinary resize, and a phone rotating.
  const refitSlide = useEffectEvent(() => {
    if (!presentingStep) return;
    const bounds = slideBounds(resolveSlide(presentingStep.slide, presentingStep.tab));
    if (bounds) fitToBounds(bounds, { maxZoom: slideMaxZoom(slideDeck.config) });
  });
  useEffect(() => {
    const node = canvasMainRef.current;
    if (!presenting || !node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => refitSlide());
    observer.observe(node);
    return () => observer.disconnect();
  }, [presenting, canvasMainRef]);

  // Publish where WE are looking, on change (docs/specs/012-collaboration/follow-me-viewport.md). Unsolicited by design
  // — see the RoomOp comment — and throttled to ~10 Hz inside the broadcaster,
  // so an idle participant sends nothing at all.
  // `broadcastViewport` is re-created every render, so it is called through an effect event; the viewport
  // (and the tab) are the trigger.
  const publishViewport = useEffectEvent(() => broadcastViewport(viewportOffset, viewportZoom));
  useEffect(() => {
    publishViewport();
  }, [viewportOffset, viewportZoom, activeId]);

  // Follow-me viewport (docs/specs/012-collaboration/follow-me-viewport.md): pin our pan / zoom / tab to a peer's until
  // we take the canvas back. View-role visitors can both follow and be
  // followed — it mutates nothing, and the audience on a view link is exactly
  // who most needs it.
  const followMe = useFollowMe({
    remoteViewports,
    livePresenceIds: livePresence.map((p) => p.id),
    activeId,
    viewportOffset,
    viewportZoom,
    setViewportOffset,
    setZoom: setViewportZoom,
    onFollowTab: setActiveId,
    onNotice: (message) => toast.info(message),
  });

  // A tab we are about to land on already aimed, so the tab-entry
  // fit-to-screen below leaves it alone (it runs a frame later and would
  // otherwise snap the view straight back off the element).
  const skipTabFitRef = useRef<string | null>(null);

  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): the invitation somebody else's press leaves on
  // screen, and what taking it does. Placed after the viewport because taking
  // one navigates through it.
  const focusInvite = useFocusInvite({
    onFollowTab: (tabId) => {
      if (tabId !== activeId) skipTabFitRef.current = tabId;
      setActiveId(tabId);
    },
    onCentreOn: centreOn,
    isAlreadyThere: (tabId, at, zoom) => tabId === activeId && isCentredOn(at, zoom),
  });
  const receiveFocusRef = useLatest<
    ((from: string, tabId: string, at: { x: number; y: number }, zoom: number) => void) | null
  >(focusInvite.receiveFocusHere);

  // Server capabilities (docs/specs/007-editor/ai-assistance.md). Fetched once at mount; determines
  // whether the AI panel option is shown in Settings and rendered.
  const { aiEnabled: aiCapable, emailEnabled } = useCapabilities(sharePasswordGate === null);

  // Pinch-to-zoom on touch screens + trackpad pinch (Ctrl+wheel).
  const { isPinchingRef } = useCanvasPinchZoom({
    canvasMainRef,
    viewportZoom,
    setViewportZoom,
    viewportOffset,
    setViewportOffset,
  });

  // Capture an Activity-page element deep link BEFORE the tab-entry
  // effect below rewrites the hash to the plain #t= pin (docs/specs/013-workspace/activity-page.md §1).
  // Consumed further down by useCollabDeepLink once the tab is ready.
  const collabDeepLink = useCollabDeepLinkCapture();

  // Tab-entry side effects (URL #t= pin + fit-to-screen once per tab
  // entry). See useTabEntryEffects.
  const { requestFit } = useTabEntryEffects({
    hydrated,
    activeId,
    elementCount: activeTab.elements.length,
    tabLoaded: loadedTabIds.has(activeId),
    fitToScreen,
    skipFitForTabRef: skipTabFitRef,
  });

  // Derived realtime presence rows (avatars per tab, remote cursors,
  // laser trails, per-element selections) and the concurrent-selection
  // lock (docs/specs/007-editor/live-app.md). Pure derivation over the usePresenceState values +
  // the local laser trail. See usePresenceRows.
  const {
    participantsByTab,
    remoteCursorRows,
    remoteAvatarRows,
    laserTrailRows,
    remoteSelectionsByElement,
    lockedByOther,
  } = usePresenceRows({
    documentShareable,
    documentTeamId,
    activeId,
    selfParticipant,
    tabs,
    livePresence,
    presenceClock,
    remoteTabFocus,
    remoteCursors,
    remoteSelections,
    remoteLaserTrails,
    remoteAvatars,
    localLaserTrail,
    selfLaserConfig: laserPen.config,
    cursorsHidden: voteCursorsHidden,
  });
  // Everyone in the document, as poll candidates (docs/specs/012-collaboration/live-poll.md). Self first, then
  // whoever is present on any tab — the order the Collaborators modal uses, so
  // a roster poll's ballot reads the way the panel beside it does. Someone on
  // two tabs appears twice here; de-duplicating is `pollCollaboratorOptions`'s
  // job, along with numbering shared names and applying the cap, so the
  // composer's preview and the frozen ballot cannot disagree.
  const pollCollaborators = useMemo<readonly PollCandidate[]>(
    () => [
      { id: selfParticipant.id, name: selfParticipant.name },
      ...[...participantsByTab.values()].flat().map((p) => ({ id: p.id, name: p.name })),
    ],
    [participantsByTab, selfParticipant],
  );
  // The poll hook reads the roster through a ref, because it is declared long
  // before this point (see the note there).
  useEffect(() => {
    pollCollaboratorsRef.current = pollCollaborators;
  }, [pollCollaborators]);
  // Comment-bearing element rows for the floating Comments panel.
  // Only the boxed elements carry threads (arrows can't), so the
  // filter walks `activeTab.elements` and routes the boxed ones
  // through the helper. The memo keys on the element list identity
  // so a selection / pan / zoom that doesn't touch elements skips
  // recomputation.
  const commentRows = useMemo(() => {
    const boxed: BoxedElement[] = activeTab.elements.filter((el): el is BoxedElement =>
      isBoxed(el),
    );
    return commentRowsFromElements(boxed);
  }, [activeTab.elements]);

  // Assigned-action state + handlers (docs/specs/012-collaboration/assigned-actions.md), the comments hook's
  // sibling: the popover open-id, the Assign Action dialog target, and
  // the save / complete / reopen / delete mutations. Mutations bypass
  // history like comments (Cmd+Z must never silently unassign work).
  // The email notify is fire-and-forget through the api worker, which
  // re-verifies team membership + document access server-side.
  const {
    actionPopoverOpenId,
    openActionPopover,
    closeActionPopover,
    assignActionFor,
    assignActionId,
    openAssignActionDialog,
    closeAssignActionDialog,
    openAssignAction,
    saveAction,
    completeAction,
    reopenAction,
    deleteAction,
  } = useEditorActions({
    activeId,
    tickTabs,
    getAction: (elementId, actionId) => {
      const el = activeTab.elements.find((e) => e.id === elementId);
      if (!el || !isBoxed(el)) return undefined;
      const list = elementActions(el);
      return actionId ? list.find((a) => a.id === actionId) : list[0];
    },
    isActionCard: (elementId) =>
      activeTab.elements.some(
        (e) => e.id === elementId && e.type === 'shape' && e.shape === 'action-card',
      ),
    // The signed-in account, or the hydrated guest participant identity
    // (guests may self-assign, docs/specs/012-collaboration/assigned-actions.md §2). Null only pre-hydration.
    self: {
      userId: clerkUserId ?? (hydrated ? selfParticipant.id : null),
      name: clerkDisplayName ?? (hydrated ? selfParticipant.name : null),
    },
    notify: (input) => {
      if (!clerkUserId || !documentId) return;
      void apiNotifyActionAssigned(clerkUserId, input.teamId, {
        assigneeUserId: input.assigneeUserId,
        assigneeMemberId: input.assigneeMemberId,
        documentId,
        actionName: input.actionName,
        ...(input.description ? { description: input.description } : {}),
      }).catch(() => {});
    },
  });

  // Action rows (open AND done — the panel filters between Outstanding
  // and Completed) for the floating Actions panel (docs/specs/012-collaboration/assigned-actions.md), the
  // commentRows sibling: same memo key, same boxed-only walk. Rows
  // assigned to the current user sort first.
  const actionRows = useMemo(() => {
    const boxed: BoxedElement[] = activeTab.elements.filter((el): el is BoxedElement =>
      isBoxed(el),
    );
    return actionRowsFromElements(boxed, clerkUserId ?? selfParticipant.id);
  }, [activeTab.elements, clerkUserId, selfParticipant.id]);

  // True only while the first-run welcome modal is up. Drives the chrome
  // hide rule (palette / explorer / dock / tab bar all suppressed so the
  // user's focus is on the modal). The Browse-templates flow uses the
  // same modal but isn't "welcome" — chrome stays visible there.
  //
  // Gated on `hydrated` so the modal (and chrome hide) only kick in once
  // the post-mount useLayoutEffect has had a chance to replace the
  // placeholder participant with the loaded / freshly minted one. Without
  // this, TemplatePicker's `useState(participant.name)` lazy init captures
  // the SSG placeholder "Guest" and never updates.
  // Welcome ("New Document") lives on /live/new since docs/specs/007-editor/new-document-route.md, so any
  // time the picker fires on the editor route it's the per-tab
  // "Pick a template" variant. Identity (visitor join) keeps its
  // own mode.
  const effectiveTemplatePickerMode =
    templatePickerMode === 'identity' ? ('identity' as const) : ('templates' as const);
  // The Quick Start (template grid) only opens on an EXPLICIT request — adding
  // a tab (useTabActions.addTab) or the empty-canvas button, both of which set
  // templatePickerMode='templates'. It no longer auto-opens just because a tab
  // is empty, so a freshly-created (truly blank) document lands on the canvas.
  const templateGridOpen = templatePickerMode === 'templates';
  // Join screen for visitors landing on an existing document who haven't
  // confirmed their identity yet. Same chrome-hide rule as the old
  // welcome modal — focus the user on the name input before they
  // start editing.
  //
  // View-role visitors get this too: their name is broadcast to other
  // participants (cursor label, presence stack, comments), so they need
  // a chance to set it before joining rather than appearing under a
  // default. The identity card only writes the participant's OWN row
  // (PUT /api/participants/:id, gated on owner === id, not document
  // edit), so a viewer can confirm a name without any 403. EditorView
  // lets the IDENTITY mode of the picker through for read-only while
  // still blocking the template-choosing mode.
  //
  // Embeds skip the prompt entirely (docs/specs/013-workspace/embeds.md): a "what's your name"
  // card inside a README iframe is wrong, so embed sessions keep
  // their default guest identity silently.
  const joinScreenOpen =
    !embedMode &&
    hydrated &&
    loadedExistingDocument &&
    !nameConfirmed &&
    templatePickerMode === 'identity';
  const identityOnlyScreenOpen = joinScreenOpen;
  // Combined gate for chrome-hide. Only the join-existing flow lives
  // on this route now; the historical new-document welcome lives on
  // /live/new.
  const anyWelcomeOpen = identityOnlyScreenOpen;
  // --- Element-scoped history helpers (active-tab aware) -------------------

  // Single emission point for activity-log entries. Every editorial
  // change goes through here — both element commits and surgical
  // reverts — so the audit stays honest. See
  // docs/specs/012-collaboration/activity-and-audit.md. Optimistic: we prepend the entry
  // Activity-log entry emission lives in useActivityLogEmitter.
  // The hook owns the shared appendLogEntry path (optimistic local
  // append + fire-and-forget API + room broadcast + entry-history
  // push) and exposes the two emit shapes the page calls: emitChange
  // for element diffs, emitTabMeta for theme / canvas / lock /
  // background tweaks. `entryHistoryRef` stays declared in this
  // file because the undo / redo flow below also reads + mutates
  // it; passing the ref in lets the hook write to the same buffer.
  // Live mirror of the panel list for the emitter's coalescing check
  // (a repeat edit folds into the newest entry only while that entry
  // is still ours). A ref, not the state value, so the emit callbacks
  // read the current list instead of a stale closure.
  const changeLogRef = useLatest(persistence.changeLog);
  const { emitChange, emitTabMeta } = useActivityLogEmitter({
    documentId,
    selfParticipant,
    setChangeLog,
    entryHistoryRef,
    sessionShareCode,
    roomRef,
    changeLogRef,
  });
  // The tab menu's Opens in (docs/specs/007-editor/editor-modes.md): the mode a tab opens in.
  const tabOpensIn = useTabOpensIn({ tabs, canEdit: !isReadOnly, commitTabs, emitTabMeta });

  // A locked tab refuses every element mutation. Commit /
  // tick / element-add helpers all consult this early-return guard
  // so a single check covers drag, edit, paint, delete, etc.
  const activeTabLocked = activeTab.locked === true;
  // Lazy per-tab load gate (docs/specs/006-document/per-tab-storage.md). Until the active tab's content has
  // landed it's an empty placeholder, NOT its real server row. The canvas
  // shows a blocking overlay over this state — but that overlay only
  // captures POINTER events; window/document keyboard + paste listeners
  // (shape shortcuts, Cmd+V) sail past it. So an edit could land on the
  // placeholder, which then (a) makes the lazy fetch discard the real
  // server content as "user already edited" and (b) re-arms the autosave
  // to PUT the near-empty body over the real row — wiping it. Folding the
  // load state into editsBlocked blocks EVERY commit-based mutator
  // (keyboard, paste, AI, import, clear) at one chokepoint, not just the
  // pointer paths the overlay covers. 'ready' is the only editable state
  // (a loaded tab, a locally-created/peer-delivered tab with content, or
  // a dismissed template picker — see deriveTabLoadState).
  const activeTabLoadState = deriveTabLoadState({
    hydrated,
    hasDocument: !!documentId,
    loaded: loadedTabIds.has(activeId),
    errored: tabLoadErrors.has(activeId),
    elementsLength: activeTab.elements.length,
    templateChosen: activeTab.templateChosen === true,
  });
  // The active tab keeps the mode it opened in once loaded: an Opens in change moves nobody.
  usePinTabOpening(activeTab, activeTabLoadState === 'ready');
  // A view-only session (a 'view' share role) is read-only in exactly
  // the same way a locked tab is: no element or tab mutation may land.
  // Folding the flags into one guard means every mutation helper
  // below stays blocked with a single check, and the interaction
  // starters (beginDrag, beginEdit, ...) layer on their own isReadOnly
  // checks so a viewer can still select and inspect.
  const editsBlocked = activeTabLocked || isReadOnly || activeTabLoadState !== 'ready';

  // An Activity-page row opened this document at one element (docs/specs/013-workspace/activity-page.md
  // §1): once the pinned tab is ready, select it, bring it into view and
  // open its popover. See useCollabDeepLink.
  useCollabDeepLink({
    link: collabDeepLink,
    hydrated,
    activeId,
    activeTabLoadState,
    elements: activeTab.elements,
    select: (id) => {
      setSelectedId(id);
      setMultiSelectedIds(new Set());
      setEditingId(null);
    },
    scrollIntoView,
    openActionPopover,
    openComments,
  });

  const commit = (mapElements: (els: Element[]) => Element[]) => {
    if (editsBlocked) return;
    // Read the LIVE elements (via tabsRef), not the render-time `activeTab`
    // closure. A deferred caller can run long after the render that created
    // this `commit` — e.g. the link-card unfurl resolves a few seconds
    // after the URL is set — and mapping over the stale snapshot would
    // write the element back as it was BEFORE the in-between edit, silently
    // dropping it (the bug where a link-card reset to "Add a link" once its
    // preview fetch landed).
    const liveTab = tabsRef.current.find((t) => t.id === activeId) ?? activeTab;
    const before = liveTab.elements;
    const after = mapElements(before);
    // An edit confined to the notes a photo draft brought in belongs to the
    // draft's gesture, not to the undo stack: it is written live and folded
    // into the one step Add leaves behind. Anything touching the author's own
    // work commits normally, so a Discard can never take it with it.
    if (photoDraftOpenRef.current && onlyDraftNotesChanged(before, after)) {
      tickTabs((ts) => patchTab(ts, activeId, { elements: after }));
      return;
    }
    commitTabs((ts) => patchTab(ts, activeId, { elements: after }));
    emitChange(activeId, before, after);
  };

  // Tab-level history commit scoped to the ACTIVE tab, for mutations
  // that touch more than the elements array — the layer ops and the
  // layer-aware Bring to Front / Send to Back also restack
  // `tab.layers`. Reads the LIVE tab (same rationale as `commit`) and
  // emits the element diff so a mass change (layer delete) reaches the
  // activity log.
  const commitActiveTab = (mapTab: (t: Tab) => Tab) => {
    if (editsBlocked) return;
    const liveTab = tabsRef.current.find((t) => t.id === activeId) ?? activeTab;
    const next = mapTab(liveTab);
    if (next === liveTab) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? mapTab(t) : t)));
    emitChange(activeId, liveTab.elements, next.elements);
  };

  // Style memory (docs/specs/008-canvas/quick-style-panel.md): what the panel or the context menu last
  // chose per element kind, applied to the next element the user draws. The
  // style hooks below get `commit` / `tickTabs` wrapped to record into it.
  const activeTheme = getTheme(activeTab.theme);
  const styleMemory = useStyleMemory({
    documentId,
    theme: activeTheme,
    board: drawMode,
  });
  const liveActiveElements = () =>
    (tabsRef.current.find((t) => t.id === activeId) ?? activeTab).elements;
  const rememberingCommit = (mapElements: (els: Element[]) => Element[]) => {
    const before = liveActiveElements();
    commit(mapElements);
    if (!editsBlocked) styleMemory.recordEdit(before, mapElements(before));
  };
  const rememberingTickTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    const beforeTabs = tabsRef.current;
    tickTabs(mapTabs);
    const before = beforeTabs.find((t) => t.id === activeId)?.elements;
    const after = mapTabs(beforeTabs).find((t) => t.id === activeId)?.elements;
    if (before && after && !editsBlocked) styleMemory.recordEdit(before, after);
  };

  // Layers domain slice (docs/specs/006-document/layers.md): the active layer, the panel /
  // context-menu ops, and the hidden / locked element-id sets every
  // interaction gate below reads.
  const layersState = useLayersState({
    activeId,
    activeTab,
    editsBlocked,
    commitActiveTab,
    tickTabs,
    markCheckpoint,
    toastInfo: toast.info,
  });
  const {
    layers,
    activeLayerId,
    activeLayerBlocked,
    layerHiddenIds,
    layerLockedIds,
    layerInertIds,
  } = layersState;
  // Refresh the commit choke point's stamp (see commitTabs above).
  // Active-layer stamp for the commit choke point below (docs/specs/006-document/layers.md). A ref
  // (not state): commitTabs is defined before the layers slice computes,
  // so the slice refreshes this every render and the closure reads the
  // latest value at commit time.
  const activeLayerStampRef = useLatest<{ tabId: string; layerId: string } | null>({
    tabId: activeId,
    layerId: activeLayerId,
  });

  // Is this an event-storming board (docs/specs/021-event-storming/event-storming.md)? One layer, so this is just
  // tab data — it drives the palette, the stationery and the note menu.
  const esBoard = isEventStormingTab(activeTab);
  // Element creation lands on the active layer, so it's additionally
  // blocked while that layer is hidden or locked (docs/specs/006-document/layers.md).
  const createBlocked = editsBlocked || activeLayerBlocked;

  // An older event-storming board is settled onto the lanes once
  // (docs/specs/021-event-storming/event-storming.md "Always on a lane").
  useLaneSettle({
    activeTab,
    editsBlocked,
    commitActiveTab,
    markSettled: (tabId) =>
      tickTabs((ts) => ts.map((t) => (t.id === tabId ? { ...t, esLanesSettled: true } : t))),
    toastInfo: toast.info,
  });

  // A layer turning hidden or locked (locally or by a peer) drops its
  // elements from any live selection — the same guarantee delete gives. Adjusted during render when the
  // inert set changes (it is memoised), so a hidden element is never shown selected for a frame.
  const [prunedForInertIds, setPrunedForInertIds] = useState(layerInertIds);
  if (layerInertIds !== prunedForInertIds) {
    setPrunedForInertIds(layerInertIds);
    if (selectedId && layerInertIds.has(selectedId)) setSelectedId(null);
    if ([...multiSelectedIds].some((id) => layerInertIds.has(id))) {
      setMultiSelectedIds(new Set([...multiSelectedIds].filter((id) => !layerInertIds.has(id))));
    }
  }

  // Apply AI-returned elements as a single undo block (docs/specs/007-editor/ai-assistance.md).
  // Generate handles both modifications and additions in one pass:
  //   - Elements whose ID matches an existing element → replace in place
  //   - Elements with a new ID → append; deduplicate if the AI reused a
  //     short ID (e.g. "ai-001") from a previous generation, remapping
  //     arrow endpoints to keep connections intact.
  // Clean always gets the full element list back so it replaces everything.
  const applyAiElements = (elements: Element[], mode: 'generate' | 'clean') => {
    commit((existingEls) => mergeAiElements(existingEls, elements, mode));
  };

  // Click handler for Activity rows (Revert has its own button that
  // stops propagation). Element-related entries select the affected
  // element on the right tab; tab-meta entries pop the matching
  // accordion in the Editor panel so the user can see what changed
  // and tweak it again.
  // Hover-to-preview for the Activity rows' Revert (docs/specs/012-collaboration/activity-and-audit.md): resting
  // on a revertable row shows the revert result live; leaving restores.
  // Shares previewingRef with the style previews so autosave skips the
  // ephemeral frames. See useRevertPreview.
  const { previewRevert, clearRevertPreview } = useRevertPreview({
    tabsRef,
    tickTabs,
    previewingRef,
  });

  // Activity log + undo/redo handlers. See useEditorHistory.
  const {
    handleActivityRowClick,
    clearActivityForActiveTab,
    revertChange: revertChangeCommit,
    tick,
    undo,
    redo,
  } = useEditorHistory({
    activeId,
    documentId,
    selfId: selfParticipant.id,
    sessionShareCode,
    tabs,
    editsBlocked,
    canUndo,
    canRedo,
    commitTabs,
    tickTabs,
    undoHistory,
    redoHistory,
    refs: { roomRef, entryHistoryRef },
    set: {
      setActiveId,
      setSelectedId,
      setMultiSelectedIds,
      setEditingId,
      setChangeLog,
      setFormatSourceId,
    },
  });

  // The Revert button sits inside the hovered row, so its click lands
  // while the hover preview is still on screen. Clear the preview FIRST:
  // the restore tick and the revert's commit compose in one React batch,
  // so the history snapshot captures the true pre-hover state instead of
  // baking the preview into the undo baseline.
  const revertChange = (entry: ChangeLogEntry) => {
    clearRevertPreview();
    revertChangeCommit(entry);
  };
  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  // Selection + placement + format helpers. See useElementHelpers.
  const {
    addBoxed,
    addBoxedAt,
    currentSelectionIds,
    selectionPrimary,
    exitFormatPainter,
    applyFormatFromSource,
  } = useElementHelpers({
    selectedId,
    activeId,
    activeTab,
    // Creation-only helpers: additionally blocked while the active layer
    // is hidden / locked (docs/specs/006-document/layers.md).
    editsBlocked: createBlocked,
    multiSelectedIds,
    formatSourceId,
    formatConfig: formatSettings.config,
    getViewportCenter,
    commit,
    commitTabs,
    emitChange,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
  });

  // Photo import (docs/specs/021-event-storming/event-storming.md Phase 8): reads a photographed wall, reconciles it
  // against this board and lands the result as an on-canvas DRAFT. Detection
  // and reading are both in-browser now (Phase 9), so this needs no model key.
  const photoDraft = usePhotoDraft({
    activeTab,
    activeId,
    ownerId: selfParticipant.id,
    aiEnabled: aiCapable,
    createBlocked,
    tick,
    markCheckpoint,
    // The draft OWNS the gesture, so it cancels it directly rather than
    // through the guard that keeps everyone else out of its checkpoint.
    cancelToCheckpoint: cancelGesture,
    emitChange,
    setSelectedId,
    setMultiSelectedIds,
    fitToBounds,
    toastError: toast.error,
  });
  // The hidden file input the palette row and the command-palette entry open.
  // Keep the history-ownership ref (declared beside `commit`) in step with
  // whether a draft is actually open.
  // While a photo draft is open it OWNS the history (docs/specs/021-event-storming/event-storming.md Phase 8): the
  // landing and every correction the author makes to a draft note are one
  // gesture, ending at Add (the step stands) or Discard (it is thrown away).
  // A ref, because `commit` / `markCheckpoint` are defined long before the
  // draft hook and read it at call time.
  const photoDraftOpenRef = useLatest(photoDraft.draftOpen);
  const photoImportAvailable = esBoard;
  // One draft at a time: while one is open the entry points say so rather
  // than starting a second import over the first.
  const photoImportBlocked = createBlocked || photoDraft.draftOpen;
  // A photo dropped or pasted on one of these boards is a piece of WALL, not
  // a picture element: it goes straight to the reader, and nothing on the
  // canvas becomes an image.
  const readPhotoFile =
    photoImportAvailable && !photoImportBlocked
      ? (file: File) => {
          void photoDraft.startFromFile(file);
        }
      : undefined;
  // One input, rendered once beside the canvas, so the camera-capture attribute
  // and the accepted-type list live in exactly one place. The picker guards the
  // dialog itself: a stray second click (a double-click in the file dialog)
  // must not replace the chooser that is already returning a file.
  const photoPicker = usePhotoPicker({
    canOpen: () => photoImportAvailable && !photoImportBlocked,
    onFile: (file) => readPhotoFile?.(file),
    onOpen: warmBoundaryModel,
  });
  const photoPickerRef = photoPicker.inputRef;
  const openPhotoImport = photoPicker.open;

  // Note acts on an event-storming board (docs/specs/021-event-storming/event-storming.md): add the next note beside
  // one, change a note's kind.
  const noteActions = useNoteActions({
    activeTab,
    createBlocked,
    layerInertIds,
    commit,
    addBoxedAt,
  });

  // --- Tab actions ---------------------------------------------------------

  // Tab-lifecycle actions (add / import / rename / duplicate / delete /
  // reorder, active-tab lock, link-into-document, clear content). They
  // touch history, the activity log, selection, telemetry, confirm /
  // toast, the change-log panel and the document list — see
  // useTabActions. Document-level lifecycle + the template flow stay in
  // the page below.
  const {
    addTab,
    importIntoActiveTab,
    importTextIntoActiveTab,
    importSceneIntoActiveTab,
    importScenesAsNewDocuments,
    toggleActiveTabLock,
    renameTab,
    linkActiveTabTo,
    duplicateTab,
    deleteTab,
    reorderTabs,
    clearTabContent,
  } = useTabActions({
    tabs,
    activeId,
    editorMode: editorMode.mode,
    documentList,
    ownerId: selfParticipant.id,
    documentId,
    createTab,
    commit,
    commitTabs,
    emitTabMeta,
    markTabLoaded,
    isTabLoaded: (id: string) => loadedTabIdsRef.current.has(id),
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setTemplatePickerMode,
    setImportError,
    requestFit,
    setChangeLog,
    refreshDocumentList,
    confirm,
    toast,
  });

  // Tab-folder membership (docs/specs/006-document/tab-folders.md), kept separate from the busy
  // useTabActions. Menu-only: drag-reorder lives above.
  const {
    moveTabToFolder,
    removeTabFromFolder,
    renameFolder: renameTabFolder,
  } = useTabFolders({
    tabs,
    activeId,
    commitTabs,
    emitTabMeta,
  });

  // Document-level lifecycle + navigation (delete / duplicate /
  // move-to-folder / delete-folder, and the new / open / make-a-copy
  // full-page-load helpers). Operates on whole documents + the Explorer
  // list, distinct from per-tab lifecycle in useTabActions. See
  // useDocumentActions.
  const {
    deleteDocument,
    deleteFolder,
    moveDocumentToFolder,
    moveDocumentTo,
    duplicateDocument,
    dismissSharedDocument,
    newDocument,
    openDocument,
    makeCopy,
  } = useDocumentActions({
    documentId,
    documentName,
    documentList,
    setDocumentList,
    confirm,
    ownerId: selfParticipant.id,
    hookDeleteFolder,
    folders,
    sharedDocuments,
    setSharedDocuments,
    copying,
    setCopying,
    sessionShareCode,
    refreshTeamLibraries,
    refreshDocumentList: () => refreshDocumentList(selfParticipant.id),
    // Keep the header's Private / Team badge honest when the OPEN document
    // changes scope via the move picker (docs/specs/013-workspace/team-shared-documents.md).
    onDocumentScopeChanged: (id, teamId) => {
      if (id === documentId) setDocumentTeamId(teamId);
    },
  });

  // Mark the participant's name as "confirmed" — they explicitly
  // dismissed at least one modal that prompted for it. Persisted in
  // localStorage so a returning visitor isn't re-prompted, and clears
  // the in-memory flag so the modal closes immediately.
  const confirmName = () => {
    // Welcome / identity-only modal is dismissed by confirming the
    // user's name. The closure check on the previous state means we
    // only emit on the transition, not every render that re-runs
    // this callback after the welcome flow.
    const wasOpen = !nameConfirmed;
    markNameConfirmed();
    setNameConfirmed(true);
    if (wasOpen) track('UI', 'Closed', 'Welcome');
  };

  // Share-dialog actions (create / revoke link, build the visitor URL,
  // save the participant name). The share-link list + shareable flags
  // stay as page state since the hydration / save effects also write
  // them; the hook reconciles via the setters. See useShareLinks.
  const {
    updateParticipantName,
    createShareLink,
    extendShareLink,
    rescopeShareLink,
    revokeShareLink,
    setDocumentSharePassword,
    shareUrlFor,
  } = useShareLinks({
    documentId,
    selfParticipant,
    setSelfParticipant,
    setShareLinks,
    setSharePassword,
    setDocumentShareable,
    setDocumentShareCode,
    documentShareCode,
    confirmName,
  });

  // Template / identity modal actions. See useTemplateFlow. confirmName
  // stays in the page (also wired into useShareLinks) and is passed in.
  const { openTemplatePicker, skipTemplatePicker, chooseTemplate } = useTemplateFlow({
    activeId,
    tabs,
    templatePickerMode,
    selfParticipant,
    getViewportCenter,
    commitTabs,
    confirmName,
    setSelectedId,
    setEditingId,
    setSelfParticipant,
    setTemplatePickerMode,
    requestFit,
  });

  // Debounced activity-log emitters (see hooks/useActivityLogDebounce
  // for the per-key slot machinery + the 500 ms window rationale).
  // `scheduleTabMetaLog` handles canvas-pattern / background-colour /
  // opacity edits, `scheduleElementChangeLog` handles fill-colour /
  // stroke-colour / text-colour / element-opacity sliders.
  const { scheduleTabMetaLog, scheduleElementChangeLog } = useActivityLogDebounce({
    emitChange,
    emitTabMeta,
    tabsRef,
    activeId,
    activeTabElements: activeTab.elements,
  });

  // Tab-level appearance + layout actions (theme switch, background
  // pattern / colour / opacity / pattern-colour, reset-to-theme,
  // auto-align). All mutate the active tab; see useTabCanvas.
  const {
    autoAlignTab,
    autoLayoutTab,
    applyTabFontToAll,
    setTabFont,
    setTabDefaultTextSize,
    setBackgroundPattern,
    setTheme,
    resetTabsUsingTheme,
    resetElementsToTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
    setBackgroundPatternScale,
    setBackgroundAnimationSpeed,
  } = useTabCanvas({
    editsBlocked,
    activeId,
    activeTab,
    commit,
    commitTabs,
    tickTabs,
    markCheckpoint,
    emitTabMeta,
    scheduleTabMetaLog,
  });

  // Live session tools (docs/specs/012-collaboration/session-tools.md): facilitator timer + dot-voting handlers.
  // State lives on the tab (`activeTab.timer` / `activeTab.vote`), so the
  // UI reads it straight off the tab; these are just the mutators.
  const {
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    setTimerDuration,
    extendTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    setVoteReviewIndex,
    castVote,
    retractVote,
  } = useTabSession({
    editsBlocked,
    sessionToolsBlocked: facilitator.sessionToolsBlocked,
    isFacilitator: facilitator.isFacilitator,
    activeId,
    activeTab,
    // The non-history mutator, per docs/specs/012-collaboration/session-tools.md: starting a timer or
    // placing a dot isn't undoable (and mustn't evict real edits
    // from the bounded undo stack).
    commitTabs: tickTabs,
    emitTabMeta,
    // Dots and the host are keyed by the collab key, not the owner id: the
    // owner id is a guest's credential, and a dot op broadcasts its voter to
    // every socket in the room (docs/specs/012-collaboration/collab-race-hardening.md, docs/specs/012-collaboration/participant-responses.md).
    selfId: voteSelfId,
    // Straight down the socket, ahead of the autosave (docs/specs/012-collaboration/session-tools.md). A no-op
    // before the room is open, exactly like every other presence-speed send —
    // a solo vote still works, it just has nobody to tell.
    emitVote: (tabId, elementId, delta, round) =>
      roomRef.current?.send({
        kind: 'op',
        op: {
          kind: 'vote',
          tabId,
          elementId,
          voter: voteSelfId,
          delta,
          ...(round ? { round } : {}),
        },
      }),
  });

  // The interactive Behaviour elements that act on the SESSION rather than the
  // document (docs/specs/012-collaboration/session-button.md, /106, /107): the session button's press, the reveal
  // zone's local uncover, and the picker's roll.
  const { pressSessionButton, revealedIds, toggleRevealForMe, pickerFor, setSessionConfigFor } =
    useBehaviourElements({
      activeId,
      commitTabs,
      tickTabs,
      editsBlocked,
      sessionToolsBlocked: facilitator.sessionToolsBlocked,
      selfParticipant,
      livePresence,
      activeTimer: activeTab.timer,
      activeVote: activeTab.vote,
      startTimer,
      pauseTimer,
      resumeTimer,
      startVote,
      startPoll: livePoll.startPoll,
    });

  // The collaboration elements (docs/specs/012-collaboration/participant-responses.md to docs/specs/012-collaboration/roll-call.md). Sibling of the
  // behaviour hook above: these write to the document through `tickTabs`,
  // which does NOT push undo history, so one person's Ctrl+Z can never
  // retract another person's answer (docs/specs/012-collaboration/collab-race-hardening.md). Scatter alone commits.
  const collabElements = useCollabElements({
    activeId,
    commitTabs,
    tickTabs,
    applyElementDelta,
    activeElements: activeTab.elements,
    editsBlocked,
    sessionToolsBlocked: facilitator.sessionToolsBlocked,
    selfParticipant,
    livePresence,
    startTimer,
  });
  // A checklist tick is a room press like an answer (docs/specs/012-collaboration/collab-race-hardening.md).
  const { toggleChecklistItem } = collabElements;
  // The Quiz (docs/specs/012-collaboration/quiz.md): its own verbs, on the same facilitator-gated patch.
  const quiz = useQuizElements({
    activeId,
    commitTabs,
    applyElementDelta,
    patchAsFacilitator: collabElements.patchAsFacilitator,
    editsBlocked,
    sessionToolsBlocked: facilitator.sessionToolsBlocked,
    selfParticipant,
  });

  // Keeping a poll's results (docs/specs/012-collaboration/poll-result-capture.md). Ends the poll for the room through
  // the SAME `endPoll` the plain End uses — one op, so a participant sees no
  // difference and no new op kind exists — and additionally drops the tallies
  // onto the canvas as an ordinary, undoable element.
  // Keep Results (docs/specs/012-collaboration/poll-result-capture.md): drop a chart of the tallies so far onto the
  // active tab. The poll keeps running, so it can be kept again later
  // (a second chart), and End is still the only thing that ends it.
  const keepPollResults = () => {
    const poll = livePoll.poll;
    if (!poll) return;
    addBoxed((x, y) => pollResultElement(poll, livePoll.answers, x, y));
    track('Element', 'Added', 'PollResult');
  };

  // Image domain (picker state, recent-images list, placement + fill
  // handlers). Lives in its own hook so the page no longer carries
  // that state or its six handlers — see useEditorImages + docs/specs/009-elements/images.md.
  const {
    imagePickerOpenFor,
    imageContext,
    addImageFromGallery,
    openImagePickerFor,
    applyImageToElement,
    removeImageFromElement,
    refreshRecentImages,
    closeImagePicker,
  } = useEditorImages({
    editsBlocked,
    isReadOnly,
    embedMode,
    getViewportCenter,
    commit,
    setSelectedId,
    documentId,
    ownerId: selfParticipant.id,
    sessionShareCode,
  });

  // Per-element note popover (single plain-text paragraph; see
  // packages/document BoxedElement.note). State + handlers in
  // useEditorNotes.
  const { noteOpenId, openNote, closeNote, setNote } = useEditorNotes({ commit });

  // --- Element CRUD --------------------------------------------------------

  // Draw-to-size + freehand pen tooling (pendingDraw state machine +
  // commit handlers). beginDrawIfEnabled short-circuits the palette
  // adds below into draw mode; the rest is consumed by the Canvas +
  // keyboard hook. See useShapeDrawing.
  const {
    pendingDraw,
    beginDraw,
    commitDraw,
    cancelDrawShape,
    beginFreehand,
    beginShapePen,
    beginPolygon,
    commitFreehand,
    commitPolygon,
    highlighterColor,
    setHighlighterColor,
    highlighterWidth,
    setHighlighterWidth,
  } = useShapeDrawing({
    editsBlocked: createBlocked,
    selectedId,
    canvasTool,
    setCanvasTool,
    activeTab,
    drawMode,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    openImagePickerFor,
    zoomRef,
    styleNewElement: styleMemory.styleNewElement,
  });
  // The Path tool (docs/specs/023-draw-mode/path-tool.md): a drawn path, a continued one, an edit.
  const { commitPath, commitPathEdit } = usePathCommits({
    editsBlocked: createBlocked,
    commit,
    styleNewElement: styleMemory.styleNewElement,
    setSelectedId,
  });

  // Mind-map growth (docs/specs/009-elements/mind-node.md): Tab / Enter / the "+" ring. See useMindGrowth.
  const { canGrowMindNode, growMindNode, abandonMindNode } = useMindGrowth({
    editsBlocked: createBlocked,
    activeId,
    activeTab,
    commitTabs,
    setSelectedId,
    setEditingId,
    emitChange,
    scrollIntoView,
  });

  // Palette element-creation handlers. See useElementCreation.
  const {
    addShape,
    addIcon,
    addSticker,
    addTechIcon,
    addTable,
    addAnnotation,
    addLinkCard,
    addVideo,
    addImage,
    addBanner,
    addHero,
    addHeader,
    addCallout,
    addStatRow,
    addProcess,
    addAvatar,
    dropPaletteItem,
    addText,
    addSticky,
    addArrow,
    handleCanvasDoubleClick,
    connectSourceId,
    connectArrowTo,
    cancelConnect,
  } = useElementCreation({
    editsBlocked: createBlocked,
    imagesBlocked: embedMode,
    activeId,
    activeTab,
    selectedId,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxed,
    addBoxedAt,
    beginDraw,
    styleNewElement: styleMemory.styleNewElement,
  });

  // Inline-icon attach/detach mutators (a shape's single inline icon).
  // Cohesive slice extracted to useInlineIconMutators — closes over only
  // editsBlocked + commit.
  const { dropIconOnElement, removeIconFromElement, dropIconElementOnShape } =
    useInlineIconMutators({ editsBlocked, commit });

  // Per-cell table links (docs/specs/008-canvas/canvas-and-palette.md). Which cell's link picker is open +
  // the history-committed write into that cell's style. See
  // useCellLinkPicker; the shared LinkPickerDialog renders against it
  // in EditorView.
  const { cellLinkPickerOpenFor, setCellLinkPickerOpenFor, openCellLinkPicker, applyCellLink } =
    useCellLinkPicker({ editsBlocked, commit });

  // Structural element operations (delete, marquee commit, lock, and the
  // duplicate family). They change the element set
  // and/or the selection rather than element fields; see
  // useElementSelectionActions.
  const {
    deleteSelected,
    selectMarquee,
    toggleLockMultiSelected,
    duplicateMultiSelected,
    deleteMultiSelected,
    narrowMultiSelection,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    spawnConnectSelected,
  } = useElementSelectionActions({
    currentSelectionIds,
    selectedId,
    multiSelectedIds,
    activeTab,
    commit,
    setSelectedId,
    setEditingId,
    setMultiSelectedIds,
    setFormatSourceId,
    lockedByOther,
    layerLockedIds,
    layerInertIds,
  });

  // Snap colours (docs/specs/023-draw-mode/draw-mode.md "Snap colours"): one commit, one undo step.
  const snapColours = useSnapColours({
    elements: activeTab.elements,
    inertIds: layerInertIds,
    editsBlocked,
    commit,
  });

  // The whiteboard dock (docs/specs/023-draw-mode/draw-mode.md): device-local pens, recognition and
  // eraser mode, and the dock presses turned into ordinary editor calls.
  const whiteboardDock = useWhiteboard({
    activeTab,
    drawMode,
    canvasTool,
    pendingDraw,
    editsBlocked: createBlocked,
    setCanvasTool,
    selectCanvasTool,
    beginDraw,
    cancelDraw: cancelDrawShape,
    pathEditing: isPathEditing(activeTab.elements, editingId),
    leavePathEdit: () => setEditingId(null),
    snapColours,
    userPreferences,
    setUserPreferences,
    writeUserPreferences,
    ownerId: selfParticipant.id,
  });

  // Eraser canvas tool (docs/specs/008-canvas/canvas-and-palette.md): press / drag to delete any element the
  // pointer touches, as a single-undo gesture. Canvas calls beginErase
  // from its capture-phase pointerdown. See useCanvasEraser.
  const { beginErase } = useCanvasEraser({
    config: eraserSettings.config,
    whiteboard: whiteboardDock.whiteboard ? { mode: whiteboardDock.prefs.eraserMode } : null,
    editsBlocked,
    layerInertIds,
    activeId,
    activeTab,
    tick,
    markCheckpoint,
    emitChange,
    setSelectedId,
    setEditingId,
  });

  // Element styling / layering actions (lock, layer order, text size /
  // align / style, fill / stroke / text colour, opacity, padding, the
  // arrow + border presets, shape-kind morph, reset-to-theme). All
  // mutate the current selection; see useElementStyle.
  const {
    toggleLockSelected,
    toggleAspectLockSelected,
    bringSelectedToFront,
    sendSelectedToBack,
    setTextSizeSelected,
    setTextAlignSelected,
    setLaneUprightTitleSelected,
    setFontSelected,
    toggleTextStyleSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setOpacitySelected,
    setShadowSelected,
    setPaddingSelected,
    setIconSizeSelected,
    setArrowEndsSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    setHeaderFillSelected,
    setArrowheadColorSelected,
    setLabelFillSelected,
    setTableHeaderTextColorSelected,
    setArrowStyleSelected,
    setArrowStrokeStyleSelected,
    setArrowRouteBehindSelected,
    setArrowExactStartSelected,
    setShapeKindSelected,
    resetAspectRatioSelected,
    setSizeSelected,
    setRotationSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setBorderRadiusSelected,
    setMarkerSelected,
    setMarkerSizeSelected,
    setRailCountSelected,
    addRailPointSelected,
    appendTableRowSelected,
    appendTableColumnSelected,
    setRailLabelSelected,
    setCodeSelected,
    setCodeWrapSelected,
    setLegendItemsSelected,
    setMindFlowSelected,
    tidyMindMapSelected,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setWebRowsSelected,
    setHeroCaptionLine,
    setHeroCaptionSelected,
    setChecklistItemsSelected,
    setEntityFieldsSelected,
    setEstimateScaleSelected,
    setAgendaItemsSelected,
    setDecisionStatusSelected,
    setDecisionDateSelected,
    setDecisionDriversSelected,
    setChairFacingSelected,
    setButtonModeSelected,
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartLegendPositionSelected,
    setLineDataSelected,
    resetShapeStyleSelected,
    resetArrowStyleSelected,
    setAnimationSelected,
    setArrowFlowSelected,
    setIconAnimationSelected,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setAnimationSpeedSelected,
    setFlowSpeedSelected,
    setAnimationRepeatSelected,
    setIconAnimationRepeatSelected,
    setFlowRepeatSelected,
    resetColorsSelected,
  } = useElementStyle({
    currentSelectionIds,
    selectionPrimary,
    selectedId,
    activeTab,
    activeId,
    editsBlocked,
    // Every style setter the context menu reaches records into style memory.
    commit: rememberingCommit,
    commitActiveTab,
    tickTabs: rememberingTickTabs,
    markCheckpoint,
    scheduleElementChangeLog,
  });

  // The quick style panel (docs/specs/008-canvas/quick-style-panel.md): its view of the selection and one
  // action per choice. The panel itself decides where and whether it shows.
  const quickSelectionIds = useMemo(
    () => selectionIds(selectedId, multiSelectedIds),
    [selectedId, multiSelectedIds],
  );
  const swatchOverrides = useSwatchOverrides({
    themeId: activeTab.theme ?? DEFAULT_SCHEME_ID,
    userPreferences,
    setUserPreferences,
    writeUserPreferences,
    ownerId: selfParticipant.id,
  });
  const quickStyle = useQuickStyle({
    activeTab,
    drawMode,
    theme: activeTheme,
    selectionIds: quickSelectionIds,
    editsBlocked,
    liveElements: liveActiveElements,
    commit,
    memory: styleMemory,
    swatchOverrides,
    pen: {
      held: whiteboardDock.tool === 'pen' ? whiteboardDock.activePen : null,
      update: whiteboardDock.updatePen,
      colours: whiteboardDock.colourMemory,
    },
    toolIntent: pendingDraw,
  });

  // Portal links (docs/specs/009-elements/portal-element.md) live off the style hook: a link can point at a
  // portal on ANOTHER tab, so these setters need the whole tab list and a
  // tabs-wide commit rather than the active tab's element mapper.
  const {
    setPortalTargetSelected,
    setPortalNameSelected,
    createLinkedPortal,
    setSessionConfigSelected,
    setRevealedSelected,
    setPickerSourceSelected,
    setReactionSelected,
    setPickerOptionsSelected,
  } = usePortalSetters({
    currentSelectionIds,
    contextTargetId: contextMenu?.mode === 'element' ? contextMenu.elementId : null,
    commitTabs,
    tabs,
    activeId,
    setSelectedId,
  });

  // Hover-to-preview for the style-preset tiles (docs/specs/010-palette/style-presets.md): hovering a preset on
  // a desktop pointer shows it live; the change only sticks on click. See
  // useStylePreview — preview/revert go through tickTabs (no history), the
  // commit restores the original first so undo snapshots the true pre-hover
  // state.
  const {
    clearPreview: clearStylePreview,
    previewShapeColorPreset,
    commitShapeColorPreset,
    previewArrowPreset,
    commitArrowPreset,
    previewAnimation,
    commitAnimation,
    previewArrowFlow,
    commitArrowFlow,
    previewIconAnimation,
    commitIconAnimation,
    previewFillColor,
    previewCodeTheme,
    commitCodeTheme,
    previewTablePreset,
    commitTablePreset,
    previewChartPalette,
    commitChartPalette,
    previewLabelFill,
    commitLabelFill,
    previewHeaderFill,
    previewArrowheadColor,
    commitFillColor,
    commitHeaderFill,
    commitArrowheadColor,
    previewStrokeColor,
    commitStrokeColor,
    previewTextColor,
    commitTextColor,
    previewBorderStroke,
    commitBorderStroke,
    previewBorderStyle,
    commitBorderStyle,
    previewBorderRadius,
    commitBorderRadius,
    previewShadow,
    commitShadow,
    previewRotation,
    commitRotation,
    previewShapeKind,
    commitShapeKind,
    previewIconSize,
    commitIconSize,
    previewIconWeight,
    commitIconWeight,
    previewMarker,
    commitMarker,
    previewMarkerSize,
    commitMarkerSize,
    previewTextAlign,
    commitTextAlign,
    previewTextSize,
    commitTextSize,
    previewFont,
    commitFont,
    previewPadding,
    commitPadding,
    previewInlineIcon,
    commitInlineIcon,
  } = useStylePreview({
    editsBlocked,
    activeId,
    currentSelectionIds,
    tabsRef,
    tickTabs,
    commitTabs,
    emitChange,
    previewingRef,
    onCommitted: styleMemory.recordEdit,
  });

  // The same idea one level up (docs/specs/008-canvas/layout-cleanup.md): hovering a Cleanup row in the tab
  // menu lays the whole tab out behind it, and the layout only sticks on click.
  const { previewCleanup, endCleanupPreview } = useCleanupPreview({
    editsBlocked,
    activeId,
    tabsRef,
    tickTabs,
    previewingRef,
  });

  // Element link picker state + the link read/write/follow handlers.
  // See useElementLinks.
  const {
    linkPickerOpenForId,
    setLinkPickerOpenForId,
    linkPickerInitialMode,
    openLinkPicker,
    applyElementLink,
    followLink,
  } = useElementLinks({
    currentSelectionIds,
    commit,
    tabs,
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    openDocument,
  });

  // Selection-editing handlers (format painter, label edit, type-to-edit,
  // single + shift-click select). See useSelectionEditing.
  const {
    beginFormatPainter,
    beginEdit,
    commitLabel,
    commitTable,
    commitHeaderSize,
    cancelEdit,
    typeIntoSelected,
    selectElement,
    toggleInMultiSelect,
  } = useSelectionEditing({
    selectedId,
    isReadOnly,
    layerInertIds,
    adoptLayerName: layersState.adoptLayerNameFromLabel,
    formatSourceId,
    formatToolActive,
    multiSelectedIds,
    documentName,
    tabs,
    activeTab,
    drawMode,
    commit,
    tickTabs,
    applyFormatFromSource,
    lockedByOther,
    set: {
      setFormatSourceId,
      setSelectedId,
      setEditingId,
      setEditCursorAtEnd,
      setMultiSelectedIds,
      setDocumentName,
      setContextMenu,
    },
  });

  // Canvas accessibility baseline (docs/specs/004-interface-design/canvas-accessibility.md): Tab / Shift+Tab element
  // traversal while the canvas surface is focused, plus SR live-region
  // announcements on selection changes. See useCanvasA11y.
  useCanvasA11y({
    enabled: keyboardEnabled,
    elements: activeTab.elements,
    selectedId,
    multiSelectedIds,
    editingId,
    selectElement,
    lockedByOther,
    layerInertIds,
    scrollIntoView,
    ownsTabKey: canGrowMindNode,
  });

  // Vote-results review (docs/specs/012-collaboration/session-tools.md): the local walkthrough of revealed top
  // picks — focus highlight + Previous / Next / Done in the vote banner.
  const {
    voteReview,
    voteResults,
    jumpToVoteResult,
    nextVoteResult,
    prevVoteResult,
    doneVoteReview,
  } = useVoteReview({
    activeTab,
    selfId: voteSelfId,
    facilitating: facilitator.isFacilitator,
    scrollIntoView,
    clearVote,
    setVoteReviewIndex,
  });

  // Keyboard nudge (docs/specs/008-canvas/canvas-and-palette.md Move). See useNudgeSelection for the
  // burst-coalescing + auto-rebind behaviour; this hook also owns
  // the timer-cleanup-on-unmount that the prior inline version
  // didn't have.
  const nudgeSelection = useNudgeSelection({
    isReadOnly,
    multiSelectedIds,
    selectedId,
    activeTab,
    laneBoard: esBoard,
    markCheckpoint,
    tick,
    scheduleElementChangeLog,
    autoRebindArrowsRef,
  });

  // Drag state machine + its global pointer-move / pointer-up
  // listeners live in useEditorDrag (see apps/live/hooks/useEditorDrag.ts).
  // The hook owns the drag state and the four `begin*` dispatchers.
  // Wiring it up here passes the editor-page's "what is going on
  // right now" state as deps so the hook can read fresh values on
  // every pointer move without re-attaching listeners.
  // `drag` itself isn't consumed in the page (Canvas pulls cursor
  // styling from `canvasTool`, not the drag state); only the four
  // begin-handlers below are passed through to Canvas as props.
  const {
    drag,
    shiftDupGhostIds,
    snapGuides,
    distGuides,
    snapTargets,
    beginDrag,
    beginAnchorDrag,
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowBend,
    beginArrowScale,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  } = useEditorDrag({
    activeTab,
    layerInertIds,
    zoomRef,
    selectedId,
    setSelectedId,
    multiSelectedIds,
    setMultiSelectedIds,
    editingId,
    isReadOnly,
    formatSourceId,
    applyFormatFromSource,
    formatToolActive,
    setFormatSourceId,
    connectSourceId,
    connectArrowTo,
    tick,
    commit,
    markCheckpoint,
    cancelToCheckpoint,
    scheduleElementChangeLog,
    onIconElementDroppedOnShape: editsBlocked ? undefined : dropIconElementOnShape,
    // Click (not drag) on an annotation marker opens its note editor
    // (docs/specs/009-elements/annotations.md). Blocked alongside other edits on a locked / read-only tab.
    onAnnotationClicked: editsBlocked ? undefined : openNote,
    autoRebindArrowsRef,
    styleNewElement: styleMemory.styleNewElement,
    alignmentGuidesRef,
    isPinchingRef,
    // Insert between (docs/specs/021-event-storming/event-storming.md): dragging a note already on the board into a
    // gap, while Alt is held. Same gate the palette drag uses, so both entry
    // points agree about when the gesture is available.
    insertGate: {
      esBoard,
      readOnly: isReadOnly,
      tabLocked: activeTabLocked,
      createBlocked,
    },
  });

  // Copy / paste (in-app element clipboard + OS-clipboard image
  // paste). `copySelection` feeds the keyboard hook below; paste is
  // driven by a native `paste` listener the hook owns. See
  // useClipboard.
  // The pointer's canvas position while it is over the canvas, null
  // otherwise. Written by the canvas host on every pointer move; read by paste
  // (docs/specs/021-event-storming/event-storming.md "Always on a lane": a paste lands at the pointer).
  const canvasPointerRef = useRef<{ x: number; y: number } | null>(null);
  const { copySelection, pasteFromClipboard, dropBoardFile, hasClipboard } = useClipboard({
    isReadOnly,
    embedMode,
    selectedId,
    multiSelectedIds,
    editingId,
    setEditingId,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    addImageFromGallery,
    ownerId: selfParticipant.id,
    documentId,
    toast,
    onPastePhoto: readPhotoFile,
    canvasPointerRef,
    // An Excalidraw copy or file lands through the board-scene insert below (called at paste time).
    insertBoardScene: (scene, at) => void boardSceneInsert.insertScene(scene, at),
  });
  // Board scenes pasted or dropped from another tool (docs/specs/020-import-export/board-scene.md
  // "In the editor"): one commit at the pointer, selected, with its notice.
  const boardSceneInsert = useBoardSceneInsert({
    activeTab,
    drawMode,
    editsBlocked,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    canvasPointerRef,
    getViewportCenter,
    ownerId: selfParticipant.id,
    documentId,
  });
  // Shapes placed from the palette's My shapes (docs/specs/013-workspace/shape-libraries.md): like a
  // paste, one commit, selected.
  const insertLibraryShape = useLibraryShapeInsert({
    activeTab,
    editsBlocked,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    getViewportCenter,
  });

  // Zen / focus mode (docs/specs/007-editor/zen-mode.md). Flips the chrome-hidden flag and emits
  // the toggle telemetry BEFORE the state change (matches the dark-mode /
  // settings pattern so an opt-out still reaches the wire). Shared by the
  // palette enter button, the zoom-dock exit button, and the Z shortcut.
  const toggleZenMode = () => {
    const next = !panelLayout.zenMode;
    track('UI', 'Toggled', next ? 'ZenModeOn' : 'ZenModeOff');
    panelLayout.setZenMode(next);
  };

  // Global keyboard shortcuts (Escape cancels modes / deselects, Delete /
  // Backspace wipes selection, Cmd-Z / Cmd-Shift-Z undo / redo, Cmd-X / -C
  // / -V cut / copy / paste, Cmd-D duplicate, V / H / K canvas-tool switch,
  // Z zen, z-order + fit-to-screen). The full keymap + rationale lives in
  // useEditorKeyboardShortcuts and is catalogued in docs/specs/008-canvas/canvas-and-palette.md.
  useEditorKeyboardShortcuts({
    formatSourceId,
    setFormatSourceId,
    selectedId,
    multiSelectedIds,
    editingId,
    isReadOnly,
    deleteSelected,
    deleteMultiSelected,
    undo,
    redo,
    copySelection,
    setCanvasTool: pickCanvasTool,
    canvasTool,
    addShape,
    addText,
    addSticky,
    addArrow,
    onAddImage: addImage ?? null,
    onBeginFreehand: beginFreehand,
    canGrowMindNode,
    onGrowMindNode: growMindNode,
    onBeginShapePen: beginShapePen,
    onBeginEditSelected: beginEdit,
    onNudgeSelection: nudgeSelection,
    onTypeIntoSelected: typeIntoSelected,
    pendingDraw,
    onCancelDraw: cancelDrawShape,
    onToggleLock: () => {
      if (multiSelectedIds.size > 0) {
        toggleLockMultiSelected();
      } else {
        toggleLockSelected();
      }
    },
    onSelectAll: () => {
      // Hidden / locked layers are excluded from select-all (docs/specs/006-document/layers.md).
      const allIds = new Set(
        activeTab.elements.map((el) => el.id).filter((id) => !layerInertIds.has(id)),
      );
      if (allIds.size === 0) return;
      setSelectedId(null);
      setMultiSelectedIds(allIds);
    },
    onDuplicate: () => {
      if (multiSelectedIds.size > 0) {
        duplicateMultiSelected();
      } else {
        duplicateSelected();
      }
    },
    onCut: () => {
      // Copy to the in-app clipboard, then delete: the two halves the
      // editor already exposes, composed into one undo-friendly action.
      copySelection();
      if (multiSelectedIds.size > 0) {
        deleteMultiSelected();
      } else {
        deleteSelected();
      }
    },
    onBringToFront: bringSelectedToFront,
    onSendToBack: sendSelectedToBack,
    onFitToScreen: fitToScreen,
    onCycleEditorMode: editorModeShortcut(editorMode, announce),
    onDeselect: () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    },
    onZoomIn: () => setViewportZoom((z) => Math.min(5, Math.round((z + 0.1) * 10) / 10)),
    onZoomOut: () => setViewportZoom((z) => Math.max(0.1, Math.round((z - 0.1) * 10) / 10)),
    onZoomReset: () => setViewportZoom(1),
    zenMode: panelLayout.zenMode,
    onToggleZen: toggleZenMode,
    onOpenSearch: () => dialogs.setSearchOpen(true),
    onShortcutUsed: powerUserOffer.onShortcutUsed,
    enabled: keyboardEnabled,
    // A whiteboard's keys are its dock's (docs/specs/023-draw-mode/draw-mode.md "Keyboard shortcuts").
    whiteboard: whiteboardDock.whiteboard
      ? {
          pickSelect: whiteboardDock.pickSelect,
          pickPen: whiteboardDock.pickPen,
          pickEraser: whiteboardDock.pickEraser,
          pickSticky: whiteboardDock.pickSticky,
          pickText: whiteboardDock.pickText,
          pickShape: whiteboardDock.pickShape,
          pickPath: whiteboardDock.pickPath,
          openShapes: whiteboardDock.openShapes,
        }
      : null,
  });

  return {
    // The person's editor mode on the active tab, for the mode switch and the canvas.
    editorMode,
    // The tab menu's Opens in choice for a tab, absent where it is not offered.
    opensInFor: tabOpensIn.choiceFor,
    whiteboardDock,
    // Whether anything edited is still unsaved: the new version prompt reloads only once it is not
    // (docs/specs/016-platform/new-version-prompt.md).
    hasUnsavedChanges,
    // Tab-scoped share session (docs/specs/013-workspace/tab-scoped-share-links.md).
    sessionTabScope,
    isOutOfScope,
    isStructureReadOnly,
    viewPreview,
    canToggleRole,
    toggleViewPreview,
    // The id the dot-vote knows us by (docs/specs/012-collaboration/collab-race-hardening.md): every vote reader compares
    // against this, never the owner id.
    voteSelfId,
    // Re-sweep the team libraries after a team-folder mutation made from
    // the Explorer panel (docs/specs/013-workspace/team-shared-documents.md), and the confirm dialog its delete uses.
    refreshTeamLibraries,
    confirm,
    // Clipboard copy, also exposed to the event-storming note menu (docs/specs/021-event-storming/event-storming.md),
    // plus paste + its enabled flag for the canvas menu's Paste row.
    copySelection,
    pasteFromClipboard,
    dropBoardFile,
    hasClipboard,
    boardSceneInsert,
    insertLibraryShape,
    ...panelLayout,
    // Presenting wears the zen chrome treatment (docs/specs/012-collaboration/presentation-mode.md → docs/specs/007-editor/zen-mode.md): header,
    // tab bar, panels and palette all gone, so a projector shows the document
    // rather than the workbench. An OVERRIDE of the spread above rather than a
    // write to zen state, so exiting a presentation restores whatever zen the
    // user actually had.
    zenMode: panelLayout.zenMode || slideDeck.presentingAt !== null,
    ...dialogs,
    ...uiState,
    ...persistence,
    ...realtime,
    activeTab,
    activeTabLocked,
    // Layers (docs/specs/006-document/layers.md): the normalised stack, the session-scoped active
    // layer, per-layer element counts, the interaction-gate id sets, and
    // the panel / context-menu ops.
    layers,
    activeLayerId,
    activeLayerBlocked,
    // The whole creation gate: a locked tab, a view-only session, or a
    // hidden / locked active layer. The canvas reads it so the
    // insert-between preview (docs/specs/021-event-storming/event-storming.md) never offers a slot the drop
    // would refuse.
    createBlocked,
    quickStyle,
    // Note acts on an event-storming board (docs/specs/021-event-storming/event-storming.md).
    ...noteActions,
    // Photo import (docs/specs/021-event-storming/event-storming.md Phase 8): the draft run, whether the entry
    // points may be offered, and the hidden file input they open.
    photoDraft,
    photoImportAvailable,
    photoImportBlocked,
    openPhotoImport,
    photoPickerRef,
    onPhotoPicked: photoPicker.onChange,
    readPhotoFile,
    layerHiddenIds,
    layerLockedIds,
    layerInertIds,
    layerCounts: layersState.layerCounts,
    setActiveLayer: layersState.setActiveLayer,
    addLayer: layersState.addLayer,
    renameLayer: layersState.renameLayer,
    removeLayer: layersState.removeLayer,
    toggleLayerVisibility: layersState.toggleLayerVisibility,
    toggleLayerLock: layersState.toggleLayerLock,
    reorderLayer: layersState.reorderLayer,
    mergeActiveLayer: layersState.mergeActiveLayer,
    setLayerOpacityLive: layersState.setLayerOpacityLive,
    clearLayer: layersState.clearLayer,
    hideOtherLayersOp: layersState.hideOthers,
    layerPreviewId: layersState.previewLayerId,
    setLayerPreviewId: layersState.setPreviewLayerId,
    // Event-storming workshop views (docs/specs/021-event-storming/event-storming.md).
    esBoard,
    // Menu-facing wrapper: moves the CURRENT selection
    // onto the picked layer.
    moveSelectedToLayer: (layerId: string) =>
      layersState.moveSelectionToLayer(currentSelectionIds(), layerId),
    addArrow,
    addComment,
    replaceCommentId,
    addIcon,
    addSticker,
    addTechIcon,
    connectSourceId,
    connectArrowTo,
    cancelConnect,
    dropIconOnElement,
    removeIconFromElement,
    addImage,
    addImageFromGallery,
    addShape,
    addSticky,
    addTable,
    addAnnotation,
    addLinkCard,
    addVideo,
    addBanner,
    addHero,
    addHeader,
    addCallout,
    addStatRow,
    addProcess,
    addAvatar,
    dropPaletteItem,
    addTab,
    addText,
    aiCapable,
    anyWelcomeOpen,
    applyAiElements,
    applyImageToElement,
    autoAlignTab,
    autoLayoutTab,
    // The facilitator baton (docs/specs/012-collaboration/facilitator.md): who is running this session.
    facilitator,
    previewCleanup,
    endCleanupPreview,
    applyTabFontToAll,
    // Live session tools (docs/specs/012-collaboration/session-tools.md)
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    setTimerDuration,
    extendTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    castVote,
    retractVote,
    beginAnchorDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowBend,
    beginArrowScale,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
    drag,
    beginArrowTranslate,
    beginDrag,
    beginEdit,
    beginEndpointDrag,
    beginFormatPainter,
    beginFreehand,
    beginShapePen,
    beginPolygon,
    bringSelectedToFront,
    broadcastAvatar,
    broadcastAvatarPush,
    avatarShove,
    fireReaction,
    pressFocusButton,
    focusInvite,
    reactionBursts: reactions.bursts,
    clearReactionBurst: reactions.clear,
    broadcastCursor,
    broadcastLaser,
    canvasPointerRef,
    canRedo,
    canUndo,
    cancelDrawShape,
    cancelEdit,
    canvasMainRef,
    canvasTool,
    exitAvatarTool,
    exitFormatTool,
    beginErase,
    chooseTemplate,
    clearActivityForActiveTab,
    clearTabContent,
    clerkDisplayName,
    clerkUserId,
    closeComments,
    closeContextMenu,
    closeImagePicker,
    closeNote,
    commentRows,
    commentThreadOpenId,
    commitDraw,
    commitFreehand,
    commitPolygon,
    commitPath,
    commitPathEdit,
    styleNewElement: styleMemory.styleNewElement,
    commitLabel,
    commitTable,
    commitHeaderSize,
    highlighterColor,
    setHighlighterColor,
    highlighterWidth,
    setHighlighterWidth,
    contextMenu,
    createFolder,
    createShareLink,
    deleteComment,
    deleteDocument,
    deleteFolder,
    deleteMultiSelected,
    deleteSelected,
    deleteTab,
    documentId,
    documentNotFound,
    loadError,
    documentTrashed,
    dismissSharedDocument,
    spawnConnectSelected,
    duplicateDocument,
    duplicateMultiSelected,
    duplicateSelected,
    // Intra-layer z-order for the selection popover (docs/specs/006-document/layers.md).
    stackSelectedFront,
    stackSelectedBack,
    duplicateTab,
    effectiveTemplatePickerMode,
    templateGridOpen,
    embedMode,
    exitFormatPainter,
    extendShareLink,
    rescopeShareLink,
    fitToScreen,
    folders,
    followLink,
    handleActivityRowClick,
    handleCanvasDoubleClick,
    hydrated,
    identityOnlyScreenOpen,
    imageContext,
    imagePickerOpenFor,
    importIntoActiveTab,
    importTextIntoActiveTab,
    importSceneIntoActiveTab,
    importScenesAsNewDocuments,
    isPinchingRef,
    isReadOnly,
    laserTrailRows,
    linkActiveTabTo,
    linkPickerOpenForId,
    linkPickerInitialMode,
    openLinkPicker,
    applyElementLink,
    cellLinkPickerOpenFor,
    setCellLinkPickerOpenFor,
    openCellLinkPicker,
    applyCellLink,
    activeTabLoadState,
    // Slide deck (docs/specs/012-collaboration/presentation-mode.md): the whole surface in one object, like livePoll —
    // nothing outside the panel and the overlay reads into it.
    slideDeck,
    commentMentions,
    // Bring an element into view (the Collaborate panel's jump to a card).
    scrollIntoView,
    // What the presentation is showing, or null. The canvas renders THESE
    // instead of the tab's elements while it is non-null, which is what makes
    // a slide a slide.
    presentingElements,
    livePresence,
    // Live poll (docs/specs/012-collaboration/live-poll.md) — the whole ephemeral surface in one object
    // rather than a dozen flattened keys, since nothing else reads into it.
    livePoll,
    keepPollResults,
    followMe,
    loadAllTabs,
    loadedTabIds,
    loadingDocument,
    makeCopy,
    moveDocumentToFolder,
    moveDocumentTo,
    nameConfirmed,
    voteReview,
    voteResults,
    jumpToVoteResult,
    nextVoteResult,
    prevVoteResult,
    doneVoteReview,
    narrowMultiSelection,
    newDocument,
    noteOpenId,
    openComments,
    openDocument,
    openNote,
    openTemplatePicker,
    participantsByTab,
    pendingDraw,
    pollCollaborators,
    redo,
    refreshRecentImages,
    remoteAvatarRows,
    remoteCursorRows,
    remoteSelectionsByElement,
    removeImageFromElement,
    renameFolder,
    renameTab,
    renameTabFolder,
    moveTabToFolder,
    removeTabFromFolder,
    reorderTabs,
    resetColorsSelected,
    // Style-preset hover preview + click commit (docs/specs/010-palette/style-presets.md).
    clearStylePreview,
    previewShapeColorPreset,
    commitShapeColorPreset,
    previewArrowPreset,
    commitArrowPreset,
    previewAnimation,
    commitAnimation,
    previewArrowFlow,
    commitArrowFlow,
    previewIconAnimation,
    commitIconAnimation,
    // Granular colour / border / rotation hover preview + click commit.
    previewFillColor,
    previewCodeTheme,
    commitCodeTheme,
    previewTablePreset,
    commitTablePreset,
    previewChartPalette,
    commitChartPalette,
    previewLabelFill,
    commitLabelFill,
    previewHeaderFill,
    previewArrowheadColor,
    commitFillColor,
    commitHeaderFill,
    commitArrowheadColor,
    previewStrokeColor,
    commitStrokeColor,
    previewTextColor,
    commitTextColor,
    previewBorderStroke,
    commitBorderStroke,
    previewBorderStyle,
    commitBorderStyle,
    previewBorderRadius,
    commitBorderRadius,
    previewShadow,
    commitShadow,
    previewRotation,
    commitRotation,
    previewShapeKind,
    commitShapeKind,
    previewIconSize,
    commitIconSize,
    previewIconWeight,
    commitIconWeight,
    previewMarker,
    commitMarker,
    previewMarkerSize,
    commitMarkerSize,
    previewTextAlign,
    commitTextAlign,
    previewTextSize,
    commitTextSize,
    previewFont,
    commitFont,
    previewPadding,
    commitPadding,
    previewInlineIcon,
    commitInlineIcon,
    resetElementsToTheme,
    resolveThread,
    retryActiveTabLoad,
    revertChange,
    previewRevert,
    clearRevertPreview,
    revokeShareLink,
    lockedByOther,
    selectElement,
    selectMarquee,
    selfParticipant,
    sendSelectedToBack,
    setArrowEndsSelected,
    setArrowStrokeStyleSelected,
    setArrowRouteBehindSelected,
    setArrowExactStartSelected,
    setArrowStyleSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    setHeaderFillSelected,
    setArrowheadColorSelected,
    setLabelFillSelected,
    setTableHeaderTextColorSelected,
    setBackgroundColor,
    setBackgroundOpacity,
    setBackgroundPatternScale,
    setBackgroundAnimationSpeed,
    setBackgroundPattern,
    setTabFont,
    setTabDefaultTextSize,
    setBorderRadiusSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setMarkerSelected,
    setMarkerSizeSelected,
    setRailCountSelected,
    addRailPointSelected,
    appendTableRowSelected,
    appendTableColumnSelected,
    setRailLabelSelected,
    setCodeSelected,
    setCodeWrapSelected,
    setLegendItemsSelected,
    setMindFlowSelected,
    tidyMindMapSelected,
    toggleChecklistItem,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setWebRowsSelected,
    setHeroCaptionLine,
    setHeroCaptionSelected,
    growMindNode,
    abandonMindNode,
    setChecklistItemsSelected,
    setEntityFieldsSelected,
    setEstimateScaleSelected,
    setAgendaItemsSelected,
    setDecisionStatusSelected,
    setDecisionDateSelected,
    setDecisionDriversSelected,
    setChairFacingSelected,
    setButtonModeSelected,
    setPortalTargetSelected,
    setPortalNameSelected,
    createLinkedPortal,
    setSessionConfigSelected,
    setRevealedSelected,
    setPickerSourceSelected,
    setReactionSelected,
    setPickerOptionsSelected,
    pressSessionButton,
    revealedIds,
    toggleRevealForMe,
    setSessionConfigFor,
    pickerFor,
    collabElements,
    quiz,
    qaBoard,
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartLegendPositionSelected,
    setLineDataSelected,
    resetShapeStyleSelected,
    resetArrowStyleSelected,
    setAnimationSelected,
    setArrowFlowSelected,
    setIconAnimationSelected,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setAnimationSpeedSelected,
    setFlowSpeedSelected,
    setAnimationRepeatSelected,
    setIconAnimationRepeatSelected,
    setFlowRepeatSelected,
    setCanvasTool: pickCanvasTool,
    laserConfig: laserPen.config,
    onChangeLaserField: laserPen.setField,
    eraserConfig: eraserSettings.config,
    onChangeEraserField: eraserSettings.setField,
    formatConfig: formatSettings.config,
    onToggleFormatGroup: formatSettings.toggleGroup,
    onSetFormatMode: formatSettings.setMode,
    pressModeButton,
    setContextMenu,
    setDocumentSharePassword,
    setFillColorSelected,
    setLinkPickerOpenForId,
    setLoadingDocument,
    setNote,
    setOpacitySelected,
    setShadowSelected,
    setPaddingSelected,
    setIconSizeSelected,
    setPatternColor,
    setShapeKindSelected,
    resetAspectRatioSelected,
    setSizeSelected,
    setRotationSelected,
    setShortcutsEnabled,
    setStrokeColorSelected,
    setFontSelected,
    setTextAlignSelected,
    setLaneUprightTitleSelected,
    setTextColorSelected,
    setTextSizeSelected,
    setTheme,
    resetTabsUsingTheme,
    setUserPreferences,
    setViewportOffset,
    setViewportZoom,
    shareUrlFor,
    shortcutsEnabled,
    skipTemplatePicker,
    shiftDupGhostIds,
    snapGuides,
    distGuides,
    snapTargets,
    tabLoadErrors,
    tabs,
    tabSummaries,
    documentTeamId,
    setDocumentTeamId,
    emailEnabled,
    actionPopoverOpenId,
    actionRows,
    assignActionFor,
    assignActionId,
    closeActionPopover,
    closeAssignActionDialog,
    completeAction,
    deleteAction,
    openActionPopover,
    openAssignAction,
    openAssignActionDialog,
    reopenAction,
    saveAction,
    teamFolders,
    teamDocuments,
    teams,
    toggleActiveTabLock,
    toggleZenMode,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    toggleTextStyleSelected,
    undo,
    unresolveThread,
    updateParticipantName,
    userPreferences,
    toggleRecentExclusion,
    favouriteIds,
    toggleFavourite,
    viewportOffset,
    viewportZoom,
    writeUserPreferences,
  };
}
