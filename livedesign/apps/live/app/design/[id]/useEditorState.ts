'use client';

import { onProfileSaved, participantWithProfile } from '@liveworkspace/settings-ui/profile-events';
import { setOwnPictureShown } from '@/lib/own-picture';
import { pageStep } from '@liveworkspace/workbench/lib/page-step';
import { contentAddBlocked } from '@/lib/editor-capabilities';
import { useWorkbenchDesignSession } from '@/components/providers/workbench-session-context';
import { surfaceFlags, type EditorSurface } from './editor-surface';
import { useTabRevisions } from './useTabRevisions';
import { useWorkbenchEnd } from './useWorkbenchEnd';
import { useWorkbenchMessages } from './useWorkbenchMessages';
import { usePublishTabRename } from '@liveworkspace/workbench/hooks/editor/active-tab-name-store';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { useTourSquare } from '@/hooks/editor/useTourSquare';
import { useModeDefaultTool } from '@/hooks/editor/useModeDefaultTool';
import { usePhotoPresence } from '@/hooks/editor/usePhotoPresence';
import { useKeyboardAvoidance } from '@liveworkspace/workbench/hooks/canvas/useKeyboardAvoidance';
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
  stampTabKind,
  isBoxed,
  stampNewElementLayers,
  elementActions,
  type BoxedElement,
  type CommentMention,
  type Element,
  type Tab,
} from '@livedesign/design';

import { useMarkerPens } from '@/hooks/canvas/useMarkerPens';
import { heldMarker } from '@/lib/whiteboard-tool';
import { usePathCommits } from '@/hooks/canvas/usePathCommits';
import { useCanvasEraser } from '@/hooks/canvas/useCanvasEraser';
import { useCanvasTool } from '@/hooks/canvas/useCanvasTool';
import { useCommentMentions } from '@/hooks/collab/useCommentMentions';
import { useLaserConfig } from '@/hooks/canvas/useLaserConfig';
import { useEraserConfig } from '@/hooks/canvas/useEraserConfig';
import { useFormatConfig } from '@/hooks/canvas/useFormatConfig';
import { useStyleMemory } from '@/hooks/canvas/useStyleMemory';
import type { QuickStyleDeps } from '@/hooks/canvas/useQuickStyle';
import { useSwatchOverrides } from '@/hooks/canvas/useSwatchOverrides';
import { getTheme } from '@/lib/themes';
import { DEFAULT_SCHEME_ID, checklistDeltaFor } from '@livedesign/design';
import { settleChipsInTabs } from '@/lib/settle-tabs';
import { useEditorMode } from '@/hooks/editor/useEditorMode';
import { selectAllIds } from '@/lib/select-all-ids';
import { currentPageIdNow } from '@/lib/current-page-kind';
import { usePagesMode } from '@/hooks/editor/usePagesMode';
import { usePhotoEditor } from '@/hooks/editor/usePhotoEditor';
import { useLogoEditor } from '@/hooks/editor/useLogoEditor';
import { useAddCustomColour } from '@/hooks/editor/useAddCustomColour';
import { useTagColourSetter } from '@/hooks/editor/useTagColourSetter';
import { useFollowMe } from '@/hooks/collab/useFollowMe';
import { useShowFollowersMyView } from '@liveworkspace/workbench/hooks/collab/useShowFollowersMyView';
import { useReleaseSelectionLock } from '@/hooks/collab/useReleaseSelectionLock';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useCellLinkPicker } from '@/hooks/canvas/useCellLinkPicker';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useClipboard } from '@/hooks/canvas/useClipboard';
import { useDesignActions } from '@/hooks/canvas/useDesignActions';
import { useEditorContextMenu } from '@/hooks/canvas/useEditorContextMenu';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { previewAdderKey, useViewPreview } from './useViewPreview';
import { useParticipantSession } from './useParticipantSession';
import { usePowerUserOffer } from '@/hooks/ui/usePowerUserOffer';
import { useDesignHistory } from '@/hooks/canvas/useDesignHistory';
import { useCanvasA11y } from '@/hooks/canvas/useCanvasA11y';
import { useBurstCheckpoint } from '@liveworkspace/workbench/hooks/canvas/useBurstCheckpoint';
import { useNudgeSelection } from '@/hooks/canvas/useNudgeSelection';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { commitUserPreferences, writeUserPreferences } from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';
import { useApplyStyleToAllTabs } from '@liveworkspace/workbench/hooks/editor/useApplyStyleToAllTabs';
import { withStyleOfTab } from '@/lib/tab-theme-apply';
import { useEditorBroadcast } from '@/hooks/collab/useEditorBroadcast';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { useEditorComments } from '@/hooks/collab/useEditorComments';
import { useCommentReactionScope } from '@/hooks/collab/useCommentReactionScope';
import { useEditorDrag } from '@/hooks/canvas/useEditorDrag';
import { useEditorImages } from '@/hooks/canvas/useEditorImages';
import { useEditorNotes } from '@/hooks/canvas/useEditorNotes';
import { useElementLinks } from '@/hooks/canvas/useElementLinks';
import { useElementSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { useElementStyle } from '@/hooks/canvas/useElementStyle';
import { useStylePreview } from '@/hooks/canvas/useStylePreview';
import { useCleanupPreview } from '@/hooks/canvas/useCleanupPreview';
import { useShapeDrawing } from '@/hooks/canvas/useShapeDrawing';
import { useTabActions } from '@/hooks/persistence/useTabActions';
import { useTabFolders } from '@/hooks/persistence/useTabFolders';
import { useTabCanvas } from '@/hooks/canvas/useTabCanvas';
import { useEditorKeyboardShortcuts } from '@/hooks/canvas/useEditorKeyboardShortcuts';
import { useEditorViewport } from '@/hooks/canvas/useEditorViewport';
import { useCanvasPinchZoom } from '@/hooks/canvas/useCanvasPinchZoom';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { participantKey, type Participant } from '@/lib/identity';
import { markNameConfirmed } from '@/lib/local-identity';
import { apiNotifyActionAssigned, apiSaveSelf } from '@/lib/api-client';
import { ROOM_FULL_NOTICE } from '@/lib/api/room';
import { useDesignList } from '@/hooks/persistence/useDesignList';
import { useDesignShareState } from '@/hooks/persistence/useDesignShareState';
import { useTokenTeams } from '@/lib/explorer-host';
import {
  actionRowsFromElements,
  commentRowsFromElements,
} from '@/components/panels/CollaboratePanel';

import { useEditorActions } from '@/hooks/collab/useEditorActions';
import { autosaveReadOnly, createTab, deriveTabLoadState, patchTab } from './editor-page-helpers';
import { useSyncInPlace } from './useSyncInPlace';
import { useTakeOfflineInPlace } from './useTakeOfflineInPlace';
import { useAutosave } from './useAutosave';
import { useDesignTrashed } from './useDesignTrashed';
import { createRemoteOpJournal, type RemoteOpJournal } from './save-baseline';
import { useElementDeltas } from '@/hooks/collab/useElementDeltas';
import { usePerTabLoad } from './usePerTabLoad';
import { useRoomConnection } from './useRoomConnection';
import { useRoomResync } from './useRoomResync';
import { useIdentityBootstrap } from './useIdentityBootstrap';
import { useEditorHistory } from './useEditorHistory';
import { useTemplateFlow } from './useTemplateFlow';
import { createOwnElementWrites, type OwnElementWrites } from './own-element-writes';
import { usePanelLayout } from './usePanelLayout';
import { usePresenceRows } from './usePresenceRows';
import { usePresenceState } from './usePresenceState';
import { useEditorDialogs } from './useEditorDialogs';
import { useElementHelpers } from './useElementHelpers';
import { usePruneInertSelection } from '@liveworkspace/workbench/hooks/canvas/usePruneInertSelection';
import { useElementCreation } from './useElementCreation';
import { useLayersState } from './useLayersState';
import { useInlineIconMutators } from './useInlineIconMutators';
import { usePresenceBroadcast } from './usePresenceBroadcast';
import { useSelectionEditing } from './useSelectionEditing';
import { useFormatTool } from './useFormatTool';
import { useTabEntryEffects } from './useTabEntryEffects';
import { useCollabDeepLink, useCollabDeepLinkCapture } from './useCollabDeepLink';
import { useEditorUiState } from './editor-ui-state';
import { useTabScope } from './useTabScope';
import { useEditorPersistence } from './editor-persistence';
import { useEditorRealtime } from './editor-realtime';
import { useAssignRef, useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { announcePageLocked, guardLockedPagesIn, type PageLockGuard } from '@/lib/page-lock-guard';
import { usePageLockedIds } from '@/hooks/editor/usePageLockedIds';
import { boundsOfElements } from '@/lib/changeset-reveals';
import { useChangesetFeed } from './useChangesetFeed';
import { activeElementsCommit } from './active-elements-commit';
import { useDragPreviewBroadcast } from '@/hooks/collab/useDragPreviewBroadcast';

export function useEditorState(opts: { surface?: EditorSurface } = {}) {
  // Where the editor runs (editor-surface.ts). The read-only embed view (docs/specs/013-workspace/
  // embeds.md) forces view behaviour regardless of the share role, suppresses the visitor identity
  // screen, and EditorView swaps the chrome for the embed badge + tab switcher. A workbench
  // (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a workbench") is signed in
  // by its session and drops the app's surroundings and everything beyond its one design.
  // Constant for the lifetime of the page (it comes from which route mounted us), so it's safe in
  // derived consts.
  const surface = opts.surface ?? 'app';
  const { embedMode, workbenchMode, appChrome } = surfaceFlags(surface);
  const workbench = useWorkbenchDesignSession();
  const initialTabs: Tab[] = [createTab('Tab 1')];

  // Embed page-view telemetry (docs/specs/013-workspace/embeds.md) is emitted by editor-page.tsx —
  // exactly one site, so an embed render can't be double-counted.

  // Sign-in wiring (token provider + guest→authed migration). One hook
  // does both — see `hooks/useAccountBootstrap.ts`. The values it
  // returns are the same ones `useAuth()` would; we read them via the
  // hook so the page has one source of truth.
  const { authLoaded, accountUserId, accountDisplayName } = useAccountBootstrap();

  const {
    tabs,
    canUndo: canTabUndo,
    canRedo: canTabRedo,
    commit: rawCommitTabs,
    tick: rawTickTabs,
    markCheckpoint: rawMarkCheckpoint,
    cancelToCheckpoint: rawCancelToCheckpoint,
    reset: rawResetTabs,
    applyRemote: applyRemoteTabs,
    applyRemoteOp,
    undo: tabUndo,
    redo: tabRedo,
    // The history's place, which a photo page's History reads (docs/specs/031-photo/photo-pages.md).
    depth: historyDepth,
  } = useDesignHistory(initialTabs);
  const canHistoryUndo = canTabUndo;
  const canHistoryRedo = canTabRedo;
  const undoHistory = tabUndo;
  const redoHistory = tabRedo;

  // Set once Pages mode's pages are known (below): the tab the lock guard applies to, and how
  // it says something was held back.
  const pageLockGuardRef = useRef<PageLockGuard | null>(null);
  // A tick (a drag landing, a nudge, a resize, a slider) passes the same lock guard as a commit.
  // Stable, as the history's own tick is: effects and loaders depend on its identity.
  const tickTabs = useCallback(
    (mapTabs: (ts: Tab[]) => Tab[]) =>
      rawTickTabs((ts) =>
        guardLockedPagesIn(ts, settleChipsInTabs(ts, mapTabs(ts)), pageLockGuardRef.current),
      ),
    [rawTickTabs],
  );
  const commitTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    // Layer stamping (docs/specs/006-design/layers.md): elements APPEARING in this commit without
    // a valid layerId land on the active layer. One choke point, so no
    // individual creation path (draw, paste, template) carries layer logic. stampNewElementLayers no-ops on tabs
    // that never materialised `layers`, and on undo/remote applies (which
    // bypass commitTabs entirely).
    rawCommitTabs((ts) => {
      // Tab kind: a committed tab says what KIND of board it
      // is, rather than leaving a reader to know that absence means
      // 'diagram'. Same choke point as the layer stamp below, and
      // `stampTabKind` returns the tab unchanged when it already has one,
      // so an untouched tab keeps its identity for the memoised views. Only the tabs this commit changed or added
      // are stamped: an untouched tab may be a placeholder whose content has not loaded, and stamping it would make
      // it look edited to the autosave (docs/specs/006-design/per-tab-storage.md).
      const before = new Set<Tab>(ts);
      const mapped = mapTabs(ts).map((t) => (before.has(t) ? t : stampTabKind(t)));
      // Locked pages (docs/specs/007-editor/pages-mode.md "Locking a page"): in Pages
      // mode nothing is added to, moved onto, changed on or taken off a locked page.
      // Badges and step numbers (docs/specs/009-elements/badge.md "Attachment"), after the commit moved their hosts.
      const next = guardLockedPagesIn(ts, settleChipsInTabs(ts, mapped), pageLockGuardRef.current);
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
  };
  const markCheckpoint = rawMarkCheckpoint;
  // Stable identity: usePerTabLoad takes this, and an identity that changed
  // every render once turned a failed tab load into a refetch on every
  // re-render (the 30s presence tick included), each one an Error report.
  const resetTabs = rawResetTabs;
  // Escape-cancel for an in-flight drag: restore the gesture's
  // checkpoint and DISCARD the step (no redo entry, a cancelled drag
  // never happened).
  const cancelToCheckpoint = rawCancelToCheckpoint;

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
    readSelection,
    selectionStore,
    setSelectedId,
    editingId,
    setEditingId,
    setEditCursorAtEnd,
    formatSourceId,
    setFormatSourceId,
    setMultiSelectedIds,
    identityPromptOpen,
    setIdentityPromptOpen,
  } = uiState;
  // Drag state lives inside the useEditorDrag hook, lifted out of
  // this component to keep the page focused on orchestration. The
  // hook is invoked further down (after `tick`, `commit`,
  // `applyFormatFromSource` and the rest of the drag dependencies
  // exist).
  // Panel layout (positions + open/visible flags) is one
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
  const { canvasTool, setCanvasTool, selectCanvasTool } = useCanvasTool({
    defaultPan: embedMode,
  });

  // Persistent Format painter tool (docs/specs/008-canvas/canvas-and-palette.md): the mode-boundary reset +
  // the exit that restores the pre-Format tool. See useFormatTool.
  const { formatToolActive, exitFormatTool } = useFormatTool({
    canvasTool,
    setCanvasTool,
    setFormatSourceId,
  });
  // identityPromptOpen (from useEditorUiState) gates the derived
  // `identityOnlyScreenOpen` chrome flag; it closes through useTemplateFlow's
  // `confirmIdentity` / `cancelIdentity`.
  // Whether the participant has explicitly confirmed their identity in a
  // modal at least once (either Create Design on the welcome flow, Skip,
  // or Join Design on the join flow). Persisted via localStorage so a
  // returning visitor isn't re-prompted. Brand new visitors landing on a
  // pre-existing design see the join flow until they confirm.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  // True after hydration if we successfully loaded a saved design from
  // the API (i.e. the user is joining someone else's design, not
  // starting a fresh one). Drives the join-screen trigger.
  const [loadedExistingDesign, setLoadedExistingDesign] = useState(false);
  // True when the URL points at a design that the API didn't return
  // (deleted, never existed, or owned by someone else). Renders the
  // NotFound surface instead of the editor + welcome modal.
  const [designNotFound, setDesignNotFound] = useState(false);
  // Distinct from designNotFound (a clean 404): the load call itself
  // FAILED (network down / 5xx), which is retryable. Drives ApiErrorPage.
  const [loadError, setLoadError] = useState(false);
  // Loading screen is the default — every first paint shows the
  // spinner, including SSG output, so users hitting a `?d=` / `?s=`
  // URL never glimpse the empty canvas and assume their data is gone.
  // The hydration useLayoutEffect flips it to false either immediately
  // (no URL params → straight to welcome modal) or once the API call
  // resolves (params → load the design first).
  const [loadingDesign, setLoadingDesign] = useState(true);
  // User-facing tool picker. Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is a non-editing presenter
  // mode, so entering it clears any selection: an element selected beforehand
  // would otherwise keep its handles (dimmed under the shroud) and pop back
  // on exit. Wraps the tracked selectCanvasTool so every entry point (palette
  // dropdown, keyboard) routes through it; internal auto-switches keep using
  // the raw setCanvasTool and are unaffected.
  const pickCanvasTool = (tool: CanvasTool) => {
    // Eraser / Format / Laser / Spotlight all act on existing
    // content, so they're unavailable on an empty canvas — the palette greys
    // them out, and this guards the keyboard-shortcut path to match. Select +
    // Hand stay available.
    const tabForTool = tabs.find((t) => t.id === activeId) ?? tabs[0];
    if (
      tabForTool &&
      tabForTool.elements.length === 0 &&
      (tool === 'eraser' || tool === 'format' || tool === 'laser' || tool === 'spotlight')
    ) {
      return;
    }
    // Spotlight is a non-editing presenter mode, so it clears the selection on entry.
    if (tool === 'spotlight') {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    }
    selectCanvasTool(tool);
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
    designShareable,
    setDesignShareable,
    designTeamId,
    setDesignTeamId,
    setDesignShareCode,
    setIsOwner,
    setDesignOwnerId,
    setDesignOwnerName,
    setDesignOwnerColor,
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
    // A Community visitor reads the design, never its conversation (docs/specs/025-community/community.md).
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
  // `openDesign` + the selection helpers exist.

  const confirm = useConfirm();
  const toast = useToast();
  // Persistence-facing state: autosave status pill + savedAt, design
  // name (mirrored to the tab title), the Explorer's owned + shared
  // design lists, and the transient import-error toast — plus the two list-refresh helpers the hydration
  // + autosave paths call. See editor-persistence; the slice is spread
  // into the returned view-model below, so the explicit return doesn't
  // re-list these.
  const persistence = useEditorPersistence({ toast });
  const { setSaveStatus, setSavedAt, designName, setDesignName, setImportError } = persistence;
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
  // further down once the WS gates (roomRef, designShareable...)
  // are in scope. Editor-page still reads it for the laserTrailRows
  // aggregator that Canvas consumes.
  // Dismissing a "shared with you" row lives in useDesignListActions
  // (via useDesignActions below), shared with /explorer and /new.
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
  // placeholder and have the autosave wipe the real server row (docs/specs/006-design/per-tab-storage.md).
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
  // Persistent design id. `null` until the post-mount hydration step
  // runs; that step reads ?d=<id> from the URL (or mints a fresh id +
  // updates the URL) and pulls any saved tabs + name from localStorage.
  // Saves are gated on `hydrated` so we never overwrite stored data
  // with the empty initial render.
  const [designId, setDesignId] = useState<string | null>(null);
  // The design's links are the index's: the badge and the presence stack read them from there.
  useDesignShareState({
    designId,
    serverStored: realtime.designServerStored,
    sessionShareCode,
    shareDialogOpen: dialogs.shareDialogOpen,
    setShareable: setDesignShareable,
  });
  const [hydrated, setHydrated] = useState(false);
  // The person's designs, for the pickers that name another design: read from the index once the design is open and the
  // browser idle (useDesignList), never inside a workbench, which reaches its one design only.
  const { designList, refreshDesignList } = useDesignList(
    hydrated && !workbenchMode && !embedMode,
    selfParticipant.id,
  );
  // The deleted state (docs/specs/013-workspace/trash.md): the design is in
  // the Trash. Set by the load, the room and the autosave.
  const designTrashed = useDesignTrashed({
    designId,
    viaShareLink: sessionShareCode !== null,
  });
  // Sharing / session / owner / share-link state + the room refs all now
  // live in useEditorRealtime, destructured above. Embeds honour the share
  // code's role (docs/specs/013-workspace/embeds.md): a view code renders a read-only viewer, an edit
  // code an editable embed. The api enforces the role on every write, so
  // this is presentation-side only.
  // The role pill's local read-only preview (docs/specs/007-editor/live-app.md#role-pill).
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
  // The design's structure (tabs, their order and folders, the name) is
  // read-only for a view link and for any tab-scoped link: a scoped
  // edit link edits its one tab's content, nothing around it
  // (docs/specs/013-workspace/tab-scoped-share-links.md).
  const isStructureReadOnly = isReadOnly || sessionTabScope !== null;
  // The once-ever power user mode offer (docs/specs/007-editor/power-user-mode.md). Its shortcut
  // counter rides the keyboard hook below.
  const powerUserOffer = usePowerUserOffer({
    prefs: userPreferences,
    settled: prefsSettled,
    editable: hydrated && !isReadOnly,
    embed: !appChrome,
    zen: panelLayout.zenMode,
    apply: (next) => {
      // Built on this render's preferences: moved onto the freshest before the whole blob is written.
      setUserPreferences(commitUserPreferences(userPreferences, next, selfParticipant.id));
    },
    offer: toast.offer,
  });

  // Per-tab autosave. The previous snapshot lives in a ref so we can
  // diff: any tab whose object reference changed since last save is
  // ours to PUT; tab order / design rename hit the metadata PUT.
  // Debounced 600ms — feels responsive without hammering the API.
  // docs/specs/006-design/per-tab-storage.md has the design.
  const lastSavedTabsRef = useRef<Tab[]>([]);
  const lastSavedNameRef = useRef<string>('');
  // Peer ops that land while a save is in flight (docs/specs/012-collaboration/collab-race-hardening.md); see save-baseline.
  const remoteOpJournalRef = useRef<RemoteOpJournal>(createRemoteOpJournal());
  // This editor's element writes the room has not sequenced yet (own-element-writes.ts): one stable object.
  const [ownWrites] = useState<OwnElementWrites>(createOwnElementWrites);
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
  // A layout effect, so it is current before any passive effect: a child's effects run before this hook's, and a tab
  // window asking for its tab on the commit the tabs arrive found none of them, settled at once and never asked again.
  const tabsRef = useRef(tabs);
  useLayoutEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  // Per-tab autosave (debounced + beforeunload flush). See useAutosave;
  // the last-saved mirror refs above are seeded by the hydration effect.
  // The last revision known per tab, for the workbench's selection reference.
  const tabRevisions = useTabRevisions(realtime.changesetSeen.seen);
  const { hasUnsavedChanges } = useAutosave({
    hydrated,
    designId,
    // A Participant saves too, its own way (participant below).
    isReadOnly: autosaveReadOnly({
      canEdit: canEdit || participant.participating,
      loadError,
      designNotFound,
    }),
    participant: participant.participating,
    tabs,
    designName,
    selfId: selfParticipant.id,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    remoteOpJournalRef,
    ownWrites,
    opsApplied,
    previewingRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    onDesignTrashed: () => designTrashed.setDesignTrashed(true),
    changesetSeen: realtime.changesetSeen.seen,
    noteTabRevision: tabRevisions.noteSaved,
  });
  // Sync Design from the Share dialog, with no reload (docs/specs/006-design/offline-mode.md "Syncing
  // in place").
  const syncToCloud = useSyncInPlace({
    designId,
    ownerId: selfParticipant.id,
    hasUnsavedChanges,
    resetTabs,
    lastSavedTabsRef,
    setDesignServerStored: realtime.setDesignServerStored,
    refreshDesignList: () => refreshDesignList(),
  });
  // Take Offline in place, for the start screen's switch (docs/specs/006-design/offline-mode.md "Taking offline in place").
  const takeOfflineInPlace = useTakeOfflineInPlace({
    designId,
    ownerId: selfParticipant.id,
    hasUnsavedChanges,
    setDesignServerStored: realtime.setDesignServerStored,
    refreshDesignList: () => refreshDesignList(),
  });

  // Persist self only when name or color actually changed. Without
  // this guard the hydration GET → state set → effect fire chain
  // produced a useless PUT echoing the same values back to the
  // server. Status is in-memory only (the API doesn't store it) so
  // it doesn't count as a change.
  const lastPersistedSelfRef = useRef<{ name: string; color: string } | null>(null);

  // One-shot identity + design hydration. See useIdentityBootstrap.
  // Placed after the last-saved/loaded refs so they're declared before
  // being passed in.
  useIdentityBootstrap({
    authLoaded,
    passwordRetry,
    hydrated,
    accountUserId,
    accountDisplayName,
    embed: embedMode,
    workbench,
    activeId,
    selfParticipant,
    resetTabs,
    refs: {
      lastPersistedSelfRef,
      lastSavedTabsRef,
      lastSavedNameRef,
      loadedTabIdsRef,
      noteChangesetSeen: realtime.changesetSeen.noteSeen,
    },
    set: {
      setActiveId,
      setDesignId,
      setDesignName,
      setDesignNotFound,
      setLoadError,
      setDesignTrashed: designTrashed.setDesignTrashed,
      setDesignOwnerColor,
      setDesignOwnerId,
      setDesignOwnerName,
      setDesignShareable,
      setDesignShareCode,
      setDesignTeamId,
      setDesignServerStored: realtime.setDesignServerStored,
      setHydrated,
      setIsOwner,
      setLoadedExistingDesign,
      setLoadedTabIds,
      setLoadingDesign,
      setNameConfirmed,
      setSelfParticipant,
      setSessionRole,
      setSessionShareCode,
      setSessionCommunity: realtime.setSessionCommunity,
      setSessionTabScope,
      setSharePasswordGate,
      setIdentityPromptOpen,
    },
  });
  useEffect(() => {
    // The editor in a workbench never writes the participant record (I9). Nor does the placeholder:
    // a design in This Browser opens before the reader is known (docs/specs/006-design/offline-mode.md
    // "Instant open"), and 'self' is nobody's row.
    if (!hydrated || workbenchMode || selfParticipant.id === 'self') return;
    const prev = lastPersistedSelfRef.current;
    if (prev && prev.name === selfParticipant.name && prev.color === selfParticipant.color) {
      return;
    }
    lastPersistedSelfRef.current = { name: selfParticipant.name, color: selfParticipant.color };
    apiSaveSelf(selfParticipant).catch(() => {});
  }, [hydrated, selfParticipant, workbenchMode]);

  const selfParticipantRef = useRef(selfParticipant);
  useEffect(() => {
    selfParticipantRef.current = selfParticipant;
  }, [selfParticipant]);
  // A name or colour saved in Settings › Profile (docs/specs/007-editor/user-preferences.md, "This app or All") is
  // this editor's own at once: its cursor, name tag and presence avatar in the room follow it, with no reload. It is
  // already stored, so the participant write above is not sent again for it.
  useEffect(
    () =>
      onProfileSaved((saved) => {
        // Show My Google Picture (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): the room hears it at once
        // (useRoomConnection's identity update), whoever this editor is.
        if (saved.showPicture !== undefined) setOwnPictureShown(saved.showPicture);
        const current = selfParticipantRef.current;
        if (current.id === 'self') return;
        const next = participantWithProfile(current, saved);
        if (!next) return;
        lastPersistedSelfRef.current = { name: next.name, color: next.color };
        setSelfParticipant(next);
      }),
    [],
  );
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
  } = useEditorViewport({ activeTab, readSelection });
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
  const revealChangesetRef = useLatest((tabId: string, ids: readonly string[]) => {
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

  // Derived realtime presence rows (avatars per tab, remote cursors,
  // laser trails, per-element selections) and the concurrent-selection
  // lock (docs/specs/007-editor/live-app.md). Pure derivation over the usePresenceState values +
  // the local laser trail. See usePresenceRows.
  const {
    participantsByTab,
    remoteCursorRows,
    laserTrailRows,
    remoteSelectionsByElement,
    agentFocusByElement,
    lockedByOther,
  } = usePresenceRows({
    designShareable,
    designTeamId,
    activeId,
    selfParticipant,
    tabs,
    livePresence,
    liveAgents,
    presenceClock,
    remoteTabFocus,
    remoteCursors,
    remoteSelections,
    remoteLaserTrails,
    localLaserTrail,
    selfLaserConfig: laserPen.config,
  });
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
  // re-verifies team membership + design access server-side.
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
    wontDoAction,
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
    // The signed-in account, or the hydrated guest participant identity
    // (guests may self-assign, docs/specs/012-collaboration/assigned-actions.md §2). Null only pre-hydration.
    self: {
      userId: accountUserId ?? (hydrated ? selfParticipant.id : null),
      name: accountDisplayName ?? (hydrated ? selfParticipant.name : null),
    },
    notify: (input) => {
      if (!accountUserId || !designId) return;
      void apiNotifyActionAssigned(accountUserId, designId, {
        teamId: input.teamId,
        assigneeUserId: input.assigneeUserId,
        assigneeMemberId: input.assigneeMemberId,
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
    return actionRowsFromElements(boxed, accountUserId ?? selfParticipant.id);
  }, [activeTab.elements, accountUserId, selfParticipant.id]);

  // The visitor name prompt drives the chrome hide rule (palette / explorer / dock / tab bar all suppressed so the
  // visitor's focus is on it). Gated on `hydrated` so it only shows once the post-mount useLayoutEffect has replaced
  // the placeholder participant with the loaded / freshly minted one; otherwise IdentityPrompt's
  // `useState(participant.name)` would capture the SSG placeholder "Guest".
  //
  // Join screen for visitors landing on an existing design who haven't
  // confirmed their identity yet. Same chrome-hide rule as the old
  // welcome modal — focus the user on the name input before they
  // start editing.
  //
  // View-role visitors get this too: their name is broadcast to other
  // participants (cursor label, presence stack, comments), so they need
  // a chance to set it before joining rather than appearing under a
  // default. The identity card only writes the participant's OWN row
  // (PUT /api/participants/:id, gated on owner === id, not design
  // edit), so a viewer can confirm a name without any 403.
  //
  // Embeds skip the prompt entirely (docs/specs/013-workspace/embeds.md): a "what's your name"
  // card inside a README iframe is wrong, so embed sessions keep
  // their default guest identity silently.
  const joinScreenOpen =
    !embedMode &&
    !workbenchMode &&
    hydrated &&
    loadedExistingDesign &&
    !nameConfirmed &&
    identityPromptOpen;
  const identityOnlyScreenOpen = joinScreenOpen;
  // Combined gate for chrome-hide. Only the join-existing flow lives
  // on this route now; the historical new-design welcome lives on
  // /live/new.
  const anyWelcomeOpen = identityOnlyScreenOpen;
  // --- Element-scoped history helpers (active-tab aware) -------------------

  // Pages mode's pages: their edits, and the view centred on them.
  const pagesMode = usePagesMode({
    activeTab,
    canEdit: !isReadOnly,
    tabLoaded: loadedTabIds.has(activeId),
    commitTabs,
    canvasMainRef,
    setViewportZoom,
    setViewportOffset,
    getViewport: () => ({ zoom: zoomRef.current, offset: viewportOffsetRef.current }),
    clearSelection: () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    },
    toastInfo: toast.info,
    frameFirstPageRef,
    designId: designId ?? undefined,
    viewport,
    snapSuspended: () => followingRef.current !== null,
  });
  // What a locked page holds is inert, as on a locked layer.
  const pageLockedIds = usePageLockedIds(activeTab.elements, pagesMode.pages);
  const canvasInertIds = pageLockedIds;
  useAssignRef(pageLockGuardRef, {
    tabId: activeId,
    // Said after the commit: the guard runs inside a state update, where no toast may be set.
    onBlocked: () => queueMicrotask(() => announcePageLocked(toast.info)),
  });

  // A locked tab refuses every element mutation. Commit /
  // tick / element-add helpers all consult this early-return guard
  // so a single check covers drag, edit, paint, delete, etc.
  const activeTabLocked = activeTab.locked === true;
  // Lazy per-tab load gate (docs/specs/006-design/per-tab-storage.md). Until the active tab's content has
  // landed it's an empty placeholder, NOT its real server row. The canvas
  // shows a blocking overlay over this state — but that overlay only
  // captures POINTER events; window/design keyboard + paste listeners
  // (shape shortcuts, Cmd+V) sail past it. So an edit could land on the
  // placeholder, which then (a) makes the lazy fetch discard the real
  // server content as "user already edited" and (b) re-arms the autosave
  // to PUT the near-empty body over the real row — wiping it. Folding the
  // load state into editsBlocked blocks EVERY commit-based mutator
  // (keyboard, paste, import, clear) at one chokepoint, not just the
  // pointer paths the overlay covers. 'ready' is the only editable state
  // (a loaded tab, a locally-created/peer-delivered tab with content, or
  // a dismissed template picker — see deriveTabLoadState).
  const activeTabLoadState = deriveTabLoadState({
    hydrated,
    hasDesign: !!designId,
    loaded: loadedTabIds.has(activeId),
    errored: tabLoadErrors.has(activeId),
    elementsLength: activeTab.elements.length,
    templateChosen: activeTab.templateChosen === true,
  });
  // A view-only session (a 'view' share role) is read-only in exactly
  // the same way a locked tab is: no element or tab mutation may land.
  // Folding the flags into one guard means every mutation helper
  // below stays blocked with a single check, and the interaction
  // starters (beginDrag, beginEdit, ...) layer on their own isReadOnly
  // checks so a viewer can still select and inspect.
  // A Participant commits too: every one of its commits passes participant.guardCommit.
  const editsBlocked =
    activeTabLocked || (isReadOnly && !participant.participating) || activeTabLoadState !== 'ready';
  // Everything but a Participant's own gestures stays shut to it (docs/specs/013-workspace/share-roles.md): the hooks
  // that write the tab's structure, or write without passing commit's guard, take this instead of editsBlocked.
  const structureBlocked = editsBlocked || isReadOnly;

  // An Inbox row opened this design at one element (docs/specs/013-workspace/inbox.md
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
    // A Participant's edit is checked against the live tab before it lands (guardCommit may refuse it with a
    // notice, so it runs once, here, not inside the update).
    if (participant.participating) {
      const liveTab = tabsRef.current.find((t) => t.id === activeId) ?? activeTab;
      const allowed = participant.guardCommit(liveTab, {
        ...liveTab,
        elements: mapElements(liveTab.elements),
      });
      if (!allowed) return;
      commitTabs((ts) => patchTab(ts, activeId, { elements: allowed.elements }));
      return;
    }
    // Mapped inside the update, from the tab as it is then (activeElementsCommit): a
    // drag's landed result or a peer's op queued after the last render is built on,
    // never written back over.
    commitTabs(activeElementsCommit(activeId, mapElements));
  };

  // Tab-level history commit scoped to the ACTIVE tab, for mutations
  // that touch more than the elements array — the layer ops and the
  // layer-aware Bring to Front / Send to Back also restack
  // `tab.layers`. Reads the LIVE tab (same rationale as `commit`).
  const commitActiveTab = (mapTab: (t: Tab) => Tab) => {
    if (editsBlocked) return;
    const liveTab = tabsRef.current.find((t) => t.id === activeId) ?? activeTab;
    const next = mapTab(liveTab);
    if (next === liveTab) return;
    if (participant.participating && !participant.guardCommit(liveTab, next)) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? mapTab(t) : t)));
  };

  // Style memory (docs/specs/008-canvas/quick-style-panel.md): what the panel or the context menu last
  // chose per element kind, applied to the next element the user draws. The
  // style hooks below get `commit` / `tickTabs` wrapped to record into it.
  const activeTheme = getTheme(activeTab.theme);
  const styleMemory = useStyleMemory({
    designId,
    theme: activeTheme,
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

  // Layers domain slice (docs/specs/006-design/layers.md): the active layer, the panel /
  // context-menu ops, and the hidden / locked element-id sets every
  // interaction gate below reads.
  const layersState = useLayersState({
    activeId,
    activeTab,
    editsBlocked: structureBlocked,
    commitActiveTab,
    tickTabs,
    markCheckpoint,
    toastInfo: toast.info,
    extraInertIds: canvasInertIds,
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
  // Active-layer stamp for the commit choke point below (docs/specs/006-design/layers.md). A ref
  // (not state): commitTabs is defined before the layers slice computes,
  // so the slice refreshes this every render and the closure reads the
  // latest value at commit time.
  const activeLayerStampRef = useLatest<{ tabId: string; layerId: string } | null>({
    tabId: activeId,
    layerId: activeLayerId,
  });

  // Element creation lands on the active layer, so it's additionally
  // blocked while that layer is hidden or locked (docs/specs/006-design/layers.md).
  const createBlocked = editsBlocked || activeLayerBlocked;
  // As structureBlocked, for the hooks that take createBlocked: shut to a Participant.
  const structureCreateBlocked = createBlocked || isReadOnly;

  // A layer turning hidden or locked drops its elements from the live selection (layers.md).
  usePruneInertSelection(layerInertIds, selectionStore);

  // The tour's own square, with no history (TourHost).
  const tourSquare = useTourSquare({ activeId, tickTabs });

  // Undo / redo handlers. See useEditorHistory.
  const editorHistory = useEditorHistory({
    activeId,
    editsBlocked,
    canUndo: canHistoryUndo,
    canRedo: canHistoryRedo,
    tabLocked: activeTabLocked,
    tickTabs,
    undoHistory,
    redoHistory,
    set: { setSelectedId, setEditingId, setFormatSourceId },
  });
  const { tick, undo, redo, canUndo, canRedo } = editorHistory;
  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  // Selection + placement + format helpers. See useElementHelpers.
  const { addBoxed, addBoxedAt, currentSelectionIds, selectionPrimary, applyFormatFromSource } =
    useElementHelpers({
      readSelection,
      activeId,
      activeTab,
      // Creation-only helpers: additionally blocked while the active layer
      // is hidden / locked (docs/specs/006-design/layers.md). Open to a Participant that may add content
      // (docs/specs/013-workspace/share-roles.md): a sticky, text or image dragged from its palette lands through
      // addBoxedAt, and every commit it makes still passes participant.guardCommit.
      editsBlocked: contentAddBlocked({
        participating: participant.participating,
        canAddContent: participant.can.addContent,
        blocked: createBlocked,
        structureBlocked: structureCreateBlocked,
      }),
      formatSourceId,
      formatConfig: formatSettings.config,
      getViewportCenter,
      commit,
      commitTabs,
      setSelectedId,
      setEditingId,
      setFormatSourceId,
    });

  // --- Tab actions ---------------------------------------------------------

  // Tab-lifecycle actions (add / import / rename / duplicate / delete /
  // reorder, active-tab lock, link-into-design, clear content). They
  // touch history, selection, telemetry, confirm / toast and the
  // design list; see
  // useTabActions. Design-level lifecycle + the template flow stay in
  // the page below.
  const {
    addTab,
    importIntoActiveTab,
    importTextIntoActiveTab,
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
    canEditStructure: !isStructureReadOnly,
    designList,
    ownerId: selfParticipant.id,
    designId,
    createTab,
    commit,
    commitTabs,
    markTabLoaded,
    isTabLoaded: (id: string) => loadedTabIdsRef.current.has(id),
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setImportError,
    requestFit,
    refreshDesignList: () => refreshDesignList(),
    confirm,
    toast,
  });
  // The menu box renames the open tab on a click on its name (active-tab-name-store).
  usePublishTabRename(activeId, renameTab, !isStructureReadOnly);

  // Tab-folder membership (docs/specs/006-design/tab-folders.md), kept separate from the busy
  // useTabActions. Menu-only: drag-reorder lives above.
  const {
    moveTabToFolder,
    removeTabFromFolder,
    renameFolder: renameTabFolder,
  } = useTabFolders({
    tabs,
    commitTabs,
  });

  // Design-level lifecycle + navigation (delete / duplicate /
  // move-to-folder / delete-folder, and the new / open / make-a-copy
  // full-page-load helpers). Operates on whole designs + the Explorer
  // list, distinct from per-tab lifecycle in useTabActions. See
  // useDesignActions.
  const { deleteDesign, newDesign, openDesign, makeCopy } = useDesignActions({
    designId,
    designName,
    confirm,
    copying,
    setCopying,
    sessionShareCode,
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

  // Name the open design: its own name, and its row in the Explorer panel's in-memory list, which would otherwise
  // show the old name until a reload (autosave persists the name). Shared by the header's rename and a template naming
  // a still-untitled design after itself.
  const nameDesign = (name: string) => {
    setDesignName(name);
  };

  // Template and identity actions. See useTemplateFlow. confirmName
  // stays in the page (also wired into useShareLinks) and is passed in.
  // The draw slice comes later in this hook, so the template flow reaches its cancel through a ref.
  const putToolDownRef = useRef<() => void>(() => {});
  const { chooseTemplate, confirmIdentity, cancelIdentity } = useTemplateFlow({
    activeId,
    tabs,
    selfParticipant,
    designName,
    nameDesign,
    getViewportCenter,
    commitTabs,
    confirmName,
    setSelectedId,
    setEditingId,
    setSelfParticipant,
    setIdentityPromptOpen,
    requestFit,
    putToolDown: () => putToolDownRef.current(),
    markTabLoaded,
  });

  // One undo step per burst of a continuous control: the background
  // sliders (useTabCanvas) and the element colour / opacity pickers
  // (useElementStyle). See useBurstCheckpoint.
  const checkpointBurst = useBurstCheckpoint(markCheckpoint);

  // Tab-level appearance + layout actions (theme switch, background
  // pattern / colour / opacity / pattern-colour, reset-to-theme,
  // auto-align). All mutate the active tab; see useTabCanvas.
  const {
    autoAlignTab,
    autoLayoutTab,
    setTabFinish,
    applyTabLook,
    setTabFont,
    setTabDefaultTextSize,
    setBackgroundPattern,
    setTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
    setBackgroundPatternScale,
    setBackgroundAnimationSpeed,
  } = useTabCanvas({
    notify: (message) => toast.info(message),
    editsBlocked: structureBlocked,
    activeId,
    activeTab,
    commit,
    commitTabs,
    tickTabs,
    checkpointBurst,
  });

  // Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md): the open tab's style on every tab, as one
  // undo step, an Editor's of the whole design only.
  const { applyToAllTabs: applyStyleToAllTabs, applying: applyingStyleToAllTabs } =
    useApplyStyleToAllTabs<Tab>({
      canApply: !structureBlocked && !isStructureReadOnly,
      activeId,
      loadAllTabs,
      isTabLoaded: (id) => loadedTabIdsRef.current.has(id),
      commitTabs,
      restyle: withStyleOfTab,
      notify: (message) => toast.info(message),
      onApplied: () => track('Tab', 'Changed', 'AllTabs'),
    });

  // A checklist tick is a room press like an answer (docs/specs/012-collaboration/collab-race-hardening.md): applied here
  // and sent to the room as a delta, never undoable. Box ticks deliberately don't track: high-frequency, low-signal.
  const toggleChecklistItem = (elementId: string, index: number) => {
    if (editsBlocked) return;
    const element = activeTab.elements.find((el) => el.id === elementId);
    const delta = element ? checklistDeltaFor(element, index) : null;
    if (delta) applyElementDelta(elementId, delta);
  };

  // Image domain (picker state, recent-images list, placement + fill
  // handlers). Lives in its own hook so the page no longer carries
  // that state or its six handlers — see useEditorImages + docs/specs/009-elements/images.md.
  const {
    imagePickerOpenFor,
    imageContext,
    addImageFromGallery,
    applyImageToElement,
    removeImageFromElement,
    refreshRecentImages,
    closeImagePicker,
  } = useEditorImages({
    // A Participant places images and swaps their pictures (docs/specs/013-workspace/share-roles.md).
    editsBlocked: contentAddBlocked({
      participating: participant.participating,
      canAddContent: participant.can.addContent,
      blocked: editsBlocked,
      structureBlocked,
    }),
    isReadOnly: isReadOnly && !(participant.participating && participant.can.addContent),
    embedMode,
    // Upload only in a workbench: no gallery read.
    galleryHidden: workbenchMode,
    getViewportCenter,
    commit,
    setSelectedId,
    designId,
    ownerId: selfParticipant.id,
    sessionShareCode,
  });

  // Per-element note popover (single plain-text paragraph; see
  // packages/design BoxedElement.note). State + handlers in
  // useEditorNotes.
  const { noteOpenId, openNote, closeNote, setNote } = useEditorNotes({ commit });

  // --- Element CRUD --------------------------------------------------------

  // Draw-to-size + freehand pen tooling (pendingDraw state machine +
  // commit handlers). beginDrawIfEnabled short-circuits the palette
  // adds below into draw mode; the rest is consumed by the Canvas +
  // keyboard hook. See useShapeDrawing.
  // Logo pages (docs/specs/007-editor/logo-pages.md): the mirror-aware draw commit, the logo tools,
  // previews, Combine and the keyline snaps. See useLogoEditor.
  const logo = useLogoEditor({
    pagesModeView: pagesMode,
    pages: pagesMode.pages,
    activeTab,
    commit,
    currentSelectionIds,
    setSelectedId,
    setMultiSelectedIds,
    prefs: userPreferences,
    setPrefs: setUserPreferences,
    selfId: selfParticipant.id,
    toast,
    readOnly: isReadOnly,
    getZoom: () => zoomRef.current,
  });
  const { canCombine, combineSelected, canTidyUp, tidyUpSelected } = logo;
  // Photo pages (docs/specs/031-photo/photo-pages.md): the page in focus, its editing session, the
  // History and the previews. See usePhotoEditor.
  const photoEditor = usePhotoEditor({
    pagesModeView: logo.view,
    pages: pagesMode?.pages ?? null,
    activeTab,
    commitTabs,
    tickTabs,
    markCheckpoint,
    cancelToCheckpoint,
    undo: undoHistory,
    redo: redoHistory,
    depth: historyDepth,
    visibleRect: getViewportCanvasRect,
    viewport,
    scope: imageContext ?? null,
    canEdit: participant.can.photoEdit && !isReadOnly,
    canInspect: participant.can.photoInspect,
    presence: photoPresence.presence,
    toast,
  });
  const {
    pendingDraw,
    beginDraw,
    commitDraw,
    cancelDrawShape,
    beginFreehand,
    beginHighlighter,
    beginMarker,
    beginShapePen,
    beginPolygon,
    beginPath,
    commitFreehand,
    commitPolygon,
    highlighter,
  } = useShapeDrawing({
    editsBlocked: createBlocked,
    readSelection,
    canvasTool,
    setCanvasTool,
    activeTab,
    commit: logo.drawCommit,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    zoomRef,
    styleNewElement: styleMemory.styleNewElement,
  });
  useEffect(() => {
    putToolDownRef.current = () => {
      cancelDrawShape();
      setCanvasTool('select');
    };
  });
  // The Path tool (docs/specs/023-draw-mode/path-tool.md): a drawn path, a continued one, an edit.
  const { commitPath, commitPathEdit } = usePathCommits({
    editsBlocked: structureCreateBlocked,
    commit: logo.drawCommit,
    elements: () => activeTab.elements,
    styleNewElement: styleMemory.styleNewElement,
    setSelectedId,
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
    readSelection,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxed,
    addBoxedAt,
    beginDraw,
    styleNewElement: styleMemory.styleNewElement,
    pages: pagesMode.pages,
  });

  // Inline-icon attach/detach mutators (a shape's single inline icon).
  // Cohesive slice extracted to useInlineIconMutators: editsBlocked, commit and the elements.
  const { dropIconOnElement, removeIconFromElement, dropIconElementOnShape } =
    useInlineIconMutators({ editsBlocked, commit, tick, elements: activeTab.elements });

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
    readSelection,
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

  // The three markers' colours and widths (docs/specs/023-draw-mode/drawing-tools.md "Markers"),
  // device-local, for a logo page's Draw and the quick style panel's pen rows.
  const markerPens = useMarkerPens();

  // Eraser canvas tool (docs/specs/008-canvas/canvas-and-palette.md): press / drag to delete any element the
  // pointer touches, as a single-undo gesture. Canvas calls beginErase
  // from its capture-phase pointerdown. See useCanvasEraser.
  const { beginErase } = useCanvasEraser({
    config: eraserSettings.config,
    editsBlocked: structureBlocked,
    layerInertIds,
    activeId,
    activeTab,
    tick,
    markCheckpoint,
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
    burstSelectedStyle,
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
    appendTableRowSelected,
    appendTableColumnSelected,
    setCodeSelected,
    setCodeWrapSelected,
    setLegendItemsSelected,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setWebRowsSelected,
    setHeroCaptionLine,
    setHeroCaptionSelected,
    setChecklistItemsSelected,
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartValuesSelected,
    setChartAxisSelected,
    setChartRightAxisSelected,
    setChartLegendPositionSelected,
    setChartTypeSelected,
    setLineDataSelected,
    sankey,
    resetShapeStyleSelected,
    resetArrowStyleSelected,
    clearAnimationsSelected,
    setArrowFlowSelected,
    setIconAnimationSelected,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setSetAnimationSpeedSelected,
    setFlowSpeedSelected,
    setSetAnimationRepeatSelected,
    setIconAnimationRepeatSelected,
    setFlowRepeatSelected,
    resetColorsSelected,
  } = useElementStyle({
    currentSelectionIds,
    selectionPrimary,
    readSelection,
    activeTab,
    activeId,
    editsBlocked,
    // Every style setter the context menu reaches records into style memory.
    commit: rememberingCommit,
    commitActiveTab,
    tickTabs: rememberingTickTabs,
    checkpointBurst,
  });

  // The quick style panel (docs/specs/008-canvas/quick-style-panel.md): its view of the selection and one
  // action per choice. The panel itself decides where and whether it shows.
  const swatchOverrides = useSwatchOverrides({
    themeId: activeTab.theme ?? DEFAULT_SCHEME_ID,
    userPreferences,
    setUserPreferences,
    writeUserPreferences,
    ownerId: selfParticipant.id,
  });
  // Every input of the Quick Style view but the selection, which QuickStyleHost reads from the store.
  const quickStyleDeps: QuickStyleDeps = {
    activeTab,
    theme: activeTheme,
    editsBlocked: structureBlocked,
    canStyle: participant.participating ? participant.can.recolour : undefined,
    liveElements: liveActiveElements,
    commit,
    memory: styleMemory,
    swatchOverrides,
    pen: {
      held: heldMarker(pendingDraw, markerPens.prefs),
      update: markerPens.updatePen,
    },
    highlighter,
    toolIntent: pendingDraw,
  };

  // Hover-to-preview for the style-preset tiles (docs/specs/010-palette/style-presets.md): hovering a preset on
  // a desktop pointer shows it live; the change only sticks on click. See
  // useStylePreview — preview/revert go through tickTabs (no history), the
  // commit restores the original first so undo snapshots the true pre-hover
  // state.
  const {
    clearPreview: clearStylePreview,
    previewElementStyle,
    commitElementStyle,
    previewShapeColorPreset,
    commitShapeColorPreset,
    previewArrowPreset,
    commitArrowPreset,
    previewSetAnimation,
    commitSetAnimation,
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
    previewFinish,
    commitFinish,
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
    previewWordmark,
    commitWordmark,
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
    previewingRef,
    onCommitted: styleMemory.recordEdit,
  });

  // The same idea one level up (docs/specs/008-canvas/layout-cleanup.md "Hover to see it first"):
  // hovering a Tidy Up tile lays the whole tab out behind the popover, and it only sticks on press.
  const { previewCleanup, endCleanupPreview, assessCleanupKind } = useCleanupPreview({
    editsBlocked: structureBlocked,
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
    openDesign,
  });

  // Selection-editing handlers (label edit, type-to-edit,
  // single + shift-click select). See useSelectionEditing.
  const {
    beginEdit,
    commitLabel,
    commitTable,
    cancelEdit,
    typeIntoSelected,
    selectElement,
    toggleInMultiSelect,
  } = useSelectionEditing({
    readSelection,
    isReadOnly,
    tabLocked: activeTabLocked,
    canWriteText: participant.can.writeText,
    layerInertIds,
    adoptLayerName: layersState.adoptLayerNameFromLabel,
    formatSourceId,
    formatToolActive,
    designName,
    tabs,
    activeTab,
    editingId,
    commit,
    discardLastStep: cancelToCheckpoint,
    tickTabs,
    applyFormatFromSource,
    lockedByOther,
    set: {
      setFormatSourceId,
      setSelectedId,
      setEditingId,
      setEditCursorAtEnd,
      setMultiSelectedIds,
      setDesignName,
      setContextMenu,
    },
  });

  // Canvas accessibility baseline (docs/specs/004-interface-design/canvas-accessibility.md): Tab / Shift+Tab element
  // traversal while the canvas surface is focused, plus SR live-region
  // announcements on selection changes. See useCanvasA11y.
  useCanvasA11y({
    enabled: shortcutsEnabled,
    elements: activeTab.elements,
    selection: selectionStore,
    editingId,
    selectElement,
    lockedByOther,
    layerInertIds,
    scrollIntoView,
  });

  // Keyboard nudge (docs/specs/008-canvas/canvas-and-palette.md Move). See useNudgeSelection for the
  // burst-coalescing + auto-rebind behaviour; this hook also owns
  // the timer-cleanup-on-unmount that the prior inline version
  // didn't have.
  const nudgeSelection = useNudgeSelection({
    isReadOnly,
    readSelection,
    activeTab,
    markCheckpoint,
    tick,
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
    snapGuideStore,
    beginDrag,
    beginAnchorDrag,
    pressArmedAction,
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
    readSelection,
    setSelectedId,
    setMultiSelectedIds,
    editingId,
    isReadOnly,
    canMove: participant.can.move,
    canResize: participant.can.resize,
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
    onIconElementDroppedOnShape: editsBlocked ? undefined : dropIconElementOnShape,
    autoRebindArrowsRef,
    styleNewElement: styleMemory.styleNewElement,
    alignmentGuidesRef,
    // Every page's edges and margin, and a logo page's keylines (useLogoEditor).
    pageSnapBoxes: logo.snapBoxes,
    pagesMode: pagesMode.pages,
    isPinchingRef,
  });

  // Copy / paste (in-app element clipboard + OS-clipboard image
  // paste). `copySelection` feeds the keyboard hook below; paste is
  // driven by a native `paste` listener the hook owns. See
  // useClipboard.
  // The pointer's canvas position while it is over the canvas, null
  // otherwise. Written by the canvas host on every pointer move; read by paste
  //.
  const canvasPointerRef = useRef<{ x: number; y: number } | null>(null);
  const { copySelection, pasteFromClipboard, dropBoardFile, hasClipboard } = useClipboard({
    isReadOnly,
    createBlocked,
    explainCreateBlocked: layersState.explainCreateBlocked,
    embedMode,
    readSelection,
    editingId,
    setEditingId,
    activeTab,
    layerLockedIds,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    addImageFromGallery,
    ownerId: selfParticipant.id,
    designId,
    toast,
    getViewportCanvasRect,
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
    readSelection,
    editingId,
    isReadOnly,
    participant: participant.participating,
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
    onBeginShapePen: beginShapePen,
    onBeginEditSelected: beginEdit,
    onNudgeSelection: nudgeSelection,
    onStepPage: (dir) => {
      const to = pageStep(pagesMode.pages, currentPageIdNow(), dir);
      if (to) pagesMode.focusPage(to);
      return !!to;
    },
    onTypeIntoSelected: typeIntoSelected,
    pendingDraw,
    onCancelDraw: cancelDrawShape,
    onToggleLock: () => {
      if (readSelection().multiSelectedIds.size > 0) {
        toggleLockMultiSelected();
      } else {
        toggleLockSelected();
      }
    },
    onSelectAll: () => {
      // Hidden / locked layers are left out; in Pages mode, every page but the one someone is on.
      const allIds = selectAllIds(activeTab, editorMode.mode, layerInertIds, currentPageIdNow());
      if (allIds.size === 0) return;
      setSelectedId(null);
      setMultiSelectedIds(allIds);
    },
    onDuplicate: () => {
      if (readSelection().multiSelectedIds.size > 0) {
        duplicateMultiSelected();
      } else {
        duplicateSelected();
      }
    },
    onCut: () => {
      // Copy to the in-app clipboard, then delete: the two halves the
      // editor already exposes, composed into one undo-friendly action.
      copySelection({ cut: true });
      if (readSelection().multiSelectedIds.size > 0) {
        deleteMultiSelected();
      } else {
        deleteSelected();
      }
    },
    onBringToFront: bringSelectedToFront,
    onSendToBack: sendSelectedToBack,
    // Fit frames the page you are nearest, not the whole tab.
    onFitToScreen: pagesMode.fitPageInView,
    onDeselect: () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    },
    onZoomIn: () => setViewportZoom((z) => Math.min(5, Math.round((z + 0.1) * 10) / 10)),
    onZoomOut: () => setViewportZoom((z) => Math.max(0.1, Math.round((z - 0.1) * 10) / 10)),
    onZoomReset: () => setViewportZoom(1),
    zenMode: panelLayout.zenMode,
    onToggleZen: toggleZenMode,
    onOpenSearch: () => openSearchWithPrefetch(dialogs.setSearchOpen, loadAllTabs),
    onShortcutUsed: powerUserOffer.onShortcutUsed,
    enabled: shortcutsEnabled,
  });

  // The workbench's side of the conversation, and the ends the editor learns of.
  useWorkbenchMessages({
    workbench,
    hydrated,
    designId,
    designName,
    tabs,
    activeId,
    sessionRole,
    selection: selectionStore,
    revOf: tabRevisions.revOf,
    revealInView: (tabId, ids) => revealChangesetRef.current?.(tabId, ids),
    reveals: changesetFeed.reveals,
    selfColor: selfParticipant.color,
  });
  useWorkbenchEnd(workbench, designTrashed.trashed);

  return {
    surface,
    tourSquare,
    addCustomColour,
    setTagColour,
    workbenchMode,
    appChrome,
    workbench,
    // The outlines relayed changesets draw (useChangesetFeed), for the canvas overlay.
    changesetReveals: changesetFeed.reveals,
    // What the agents present name in focus on the active tab, for the focus rings.
    agentFocusByElement,
    // The person's editor mode on the active tab, for the mode switch and the canvas.
    editorMode,
    pagesMode: photoEditor.view,
    canCombine,
    combineSelected,
    canTidyUp,
    tidyUpSelected,
    // Arms a draw tool: the Logo palette's markers, from the live pen (PaletteLogoTab).
    beginDraw,
    markerPens,
    // Whether anything edited is still unsaved: the new version prompt reloads only once it is not
    // (docs/specs/016-platform/new-version-prompt.md).
    hasUnsavedChanges,
    syncToCloud,
    takeOfflineInPlace,
    // Whether sign-in has answered, so the start screen's switch never words a signed-in person as a guest.
    authLoaded,
    // Tab-scoped share session (docs/specs/013-workspace/tab-scoped-share-links.md).
    sessionTabScope,
    isOutOfScope,
    isStructureReadOnly,
    viewPreview,
    canToggleRole,
    toggleViewPreview,
    confirm,
    // Clipboard copy, plus paste + its enabled flag for the canvas menu's Paste row.
    copySelection,
    pasteFromClipboard,
    dropBoardFile,
    hasClipboard,
    ...panelLayout,
    ...dialogs,
    ...uiState,
    ...persistence,
    ...realtime,
    activeTab,
    activeTabLocked,
    // Layers (docs/specs/006-design/layers.md): the normalised stack, the session-scoped active
    // layer, per-layer element counts, the interaction-gate id sets, and
    // the panel / context-menu ops.
    layers,
    activeLayerId,
    activeLayerBlocked,
    // The whole creation gate: a locked tab, a view-only session, or a
    // hidden / locked active layer.
    createBlocked,
    quickStyleDeps,
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
    // The empty Plan tab's board picker places its board in the middle of the view.
    getViewportCenter,
    addTab,
    addText,
    anyWelcomeOpen,
    applyImageToElement,
    autoAlignTab,
    autoLayoutTab,
    previewCleanup,
    endCleanupPreview,
    assessCleanupKind,
    // Free an element somebody else is holding (docs/specs/007-editor/live-app.md lock).
    releaseSelectionLock,
    setTabFinish,
    applyTabLook,
    applyStyleToAllTabs,
    applyingStyleToAllTabs,
    canApplyStyleToAllTabs: !isStructureReadOnly,
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
    pressArmedAction,
    beginEdit,
    beginEndpointDrag,
    beginFreehand,
    beginHighlighter,
    beginMarker,
    beginShapePen,
    beginPolygon,
    beginPath,
    bringSelectedToFront,
    broadcastCursor,
    broadcastLaser,
    canvasPointerRef,
    canRedo,
    canUndo,
    cancelDrawShape,
    cancelEdit,
    canvasMainRef,
    // Side by side (docs/specs/007-editor/split-view.md) hands the editor a tab already aimed.
    skipTabFitRef,
    canvasTool,
    exitFormatTool,
    beginErase,
    chooseTemplate,
    clearTabContent,
    accountDisplayName,
    accountUserId,
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
    contextMenu,
    deleteComment,
    deleteDesign,
    deleteMultiSelected,
    deleteSelected,
    deleteTab: deleteTab,
    designId,
    designNotFound,
    loadError,
    designTrashed,
    spawnConnectSelected,
    duplicateMultiSelected,
    duplicateSelected,
    // Intra-layer z-order for the selection popover (docs/specs/006-design/layers.md).
    stackSelectedFront,
    stackSelectedBack,
    duplicateTab,
    embedMode,
    fitToScreen,
    followLink,
    handleCanvasDoubleClick,
    hydrated,
    identityOnlyScreenOpen,
    imageContext,
    imagePickerOpenFor,
    importIntoActiveTab,
    importTextIntoActiveTab,
    isPinchingRef,
    isReadOnly,
    // What this session may do (docs/specs/013-workspace/share-roles.md): a Participant's content gestures.
    can: participant.can,
    participating: participant.participating,
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
    commentMentions,
    commentReactions,
    // Bring an element into view (the Collaborate panel's jump to a card).
    scrollIntoView,
    livePresence,
    followMe,
    loadAllTabs,
    loadedTabIds,
    loadingDesign,
    makeCopy,
    nameConfirmed,
    narrowMultiSelection,
    newDesign,
    noteOpenId,
    openComments,
    openDesign,
    openNote,
    participantsByTab,
    pendingDraw,
    redo,
    refreshRecentImages,
    remoteCursorRows,
    remoteSelectionsByElement,
    removeImageFromElement,
    renameTab,
    renameTabFolder,
    moveTabToFolder,
    removeTabFromFolder,
    reorderTabs,
    resetColorsSelected,
    // Style-preset hover preview + click commit (docs/specs/010-palette/style-presets.md).
    clearStylePreview,
    previewElementStyle,
    commitElementStyle,
    // A whole-tab write in one history step, for menu controls that change many elements at once (renumbering
    // steps, Play in Order): lib/element-style-ops.ts.
    commitElements: commit,
    previewShapeColorPreset,
    commitShapeColorPreset,
    previewArrowPreset,
    commitArrowPreset,
    previewSetAnimation,
    commitSetAnimation,
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
    previewFinish,
    commitFinish,
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
    previewWordmark,
    commitWordmark,
    commitTextSize,
    previewFont,
    commitFont,
    previewPadding,
    commitPadding,
    previewInlineIcon,
    commitInlineIcon,
    resolveThread,
    retryActiveTabLoad,
    lockedByOther,
    selectElement,
    selectMarquee,
    selfParticipant,
    // The Share dialog's "Sharing as" renames a guest.
    setSelfParticipant,
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
    burstSelectedStyle,
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
    appendTableRowSelected,
    appendTableColumnSelected,
    setCodeSelected,
    setCodeWrapSelected,
    setLegendItemsSelected,
    toggleChecklistItem,
    setPageHeading,
    setWebRows,
    appendWebRowTo,
    setWebRowsSelected,
    setHeroCaptionLine,
    setHeroCaptionSelected,
    setChecklistItemsSelected,
    setRatingSelected,
    setRatingAnimSelected,
    setRatingAnimSpeedSelected,
    setRatingAnimRepeatSelected,
    setPieDataSelected,
    setPieAnimSelected,
    setPieAnimSpeedSelected,
    setPieAnimRepeatSelected,
    setChartLegendSelected,
    setChartValuesSelected,
    setChartAxisSelected,
    setChartRightAxisSelected,
    setChartLegendPositionSelected,
    setChartTypeSelected,
    setLineDataSelected,
    sankey,
    resetShapeStyleSelected,
    resetArrowStyleSelected,
    clearAnimationsSelected,
    setArrowFlowSelected,
    setIconAnimationSelected,
    setIconAnimationSpeedSelected,
    setProgressSelected,
    setProgressAnimSelected,
    setProgressAnimSpeedSelected,
    setProgressAnimRepeatSelected,
    setSetAnimationSpeedSelected,
    setFlowSpeedSelected,
    setSetAnimationRepeatSelected,
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
    setContextMenu,
    setFillColorSelected,
    setLinkPickerOpenForId,
    setLoadingDesign,
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
    setTextColorSelected,
    setTextSizeSelected,
    setTheme,
    setUserPreferences,
    setViewportOffset,
    setViewportZoom,
    shortcutsEnabled,
    confirmIdentity,
    cancelIdentity,
    nameDesign,
    shiftDupGhostIds,
    snapGuideStore,
    tabLoadErrors,
    tabs,
    tabSummaries,
    designTeamId,
    setDesignTeamId,
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
    wontDoAction,
    saveAction,
    teams,
    designList,
    toggleActiveTabLock,
    toggleZenMode,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    toggleTextStyleSelected,
    undo,
    unresolveThread,
    userPreferences,
    // The server copy merged in (or failed to arrive): a once-ever offer (the tours) waits for it, so a
    // returning user on a new device is not offered what another device already answered.
    prefsSettled,
    viewport,
    writeUserPreferences,
  };
}
