'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  isBoxed,
  stampNewElementLayers,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/diagram';

import { useCanvasEraser } from '@/hooks/canvas/useCanvasEraser';
import { useCanvasTool } from '@/hooks/canvas/useCanvasTool';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { useCellLinkPicker } from '@/hooks/canvas/useCellLinkPicker';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { useClipboard } from '@/hooks/canvas/useClipboard';
import { useDiagramActions } from '@/hooks/canvas/useDiagramActions';
import { useEditorContextMenu } from '@/hooks/canvas/useEditorContextMenu';
import { useEditorPreferences } from '@/hooks/persistence/useEditorPreferences';
import { useDiagramHistory } from '@/hooks/canvas/useDiagramHistory';
import { useCanvasA11y } from '@/hooks/canvas/useCanvasA11y';
import { useNudgeSelection } from '@/hooks/canvas/useNudgeSelection';
import { useFolders } from '@/hooks/persistence/useFolders';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { writeUserPreferences } from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';
import { useActivityLogDebounce } from '@/hooks/collab/useActivityLogDebounce';
import { useActivityLogEmitter } from '@/hooks/collab/useActivityLogEmitter';
import { useEditorBroadcast } from '@/hooks/collab/useEditorBroadcast';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { useEditorComments } from '@/hooks/collab/useEditorComments';
import { useEditorDrag } from '@/hooks/canvas/useEditorDrag';
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
import { useCanvasPinchZoom } from '@/hooks/canvas/useCanvasPinchZoom';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { type Participant } from '@/lib/identity';
import { markNameConfirmed } from '@/lib/local-identity';
import { apiNotifyActionAssigned, apiSaveSelf, type ChangeLogEntry } from '@/lib/api-client';
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
import { usePerTabLoad } from './usePerTabLoad';
import { useRoomConnection } from './useRoomConnection';
import { useIdentityBootstrap } from './useIdentityBootstrap';
import { useEditorHistory } from './useEditorHistory';
import { useRevertPreview } from './useRevertPreview';
import { useTemplateFlow } from './useTemplateFlow';
import { usePanelLayout } from './usePanelLayout';
import { usePresenceRows } from './usePresenceRows';
import { usePresenceState } from './usePresenceState';
import { useEditorDialogs } from './useEditorDialogs';
import { useElementHelpers } from './useElementHelpers';
import { useElementCreation } from './useElementCreation';
import { useLayersState } from './useLayersState';
import { useInlineIconMutators } from './useInlineIconMutators';
import { usePresenceBroadcast } from './usePresenceBroadcast';
import { useSelectionEditing } from './useSelectionEditing';
import { useTabEntryEffects } from './useTabEntryEffects';
import { useEditorUiState } from './editor-ui-state';
import { useEditorPersistence } from './editor-persistence';
import { useEditorRealtime } from './editor-realtime';

// Activity-log past/future stacks share the cap with the
// state-snapshot stack: we can't undo past what useDiagramHistory
// remembers, so there's no point in tracking more log entries than
// that. Imported from the hook directly so the two stacks can't
// drift (was a literal mirror of `3` here, which is the kind of
// duplication a future HISTORY_LIMIT bump would silently break).

export function useEditorState(opts: { embed?: boolean } = {}) {
  // Read-only embed view (spec/33). The flag forces view behaviour
  // regardless of the share role, suppresses the visitor identity
  // screen, and EditorView swaps the chrome for the embed badge +
  // tab switcher. Constant for the lifetime of the page (it comes
  // from which route mounted us), so it's safe in derived consts.
  const embedMode = opts.embed === true;
  const initialTabs: Tab[] = [createTab('Tab 1')];

  // Embed page-view telemetry (spec/33) is emitted by editor-page.tsx —
  // exactly one site, so an embed render can't be double-counted.

  // Clerk wiring (token provider + guest→authed migration). One hook
  // does both — see `hooks/useClerkApiBootstrap.ts`. The values it
  // returns are the same ones `useAuth()` would; we read them via the
  // hook so the page has one source of truth.
  const { authLoaded, clerkUserId, clerkDisplayName } = useClerkApiBootstrap();

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
  } = useDiagramHistory(initialTabs);

  // Per-step Undo/Redo memory for the activity log (spec/12): one
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
  // Active-layer stamp for the commit choke point below (spec/74). A ref
  // (not state): commitTabs is defined before the layers slice computes,
  // so the slice refreshes this every render and the closure reads the
  // latest value at commit time.
  const activeLayerStampRef = useRef<{ tabId: string; layerId: string } | null>(null);
  const commitTabs = (mapTabs: (ts: Tab[]) => Tab[]): number => {
    const token = ++historyTokenRef.current;
    entryHistoryRef.current = entryHistoryPush(entryHistoryRef.current, token);
    // Layer stamping (spec/74): elements APPEARING in this commit without
    // a valid layerId land on the active layer. One choke point, so no
    // individual creation path (draw, paste, AI, template, Mermaid
    // import) carries layer logic. stampNewElementLayers no-ops on tabs
    // that never materialised `layers`, and on undo/remote applies (which
    // bypass commitTabs entirely).
    rawCommitTabs((ts) => {
      const next = mapTabs(ts);
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
    const token = ++historyTokenRef.current;
    entryHistoryRef.current = entryHistoryPush(entryHistoryRef.current, token);
    rawMarkCheckpoint();
    return token;
  };
  const resetTabs = (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => {
    // reset clears the snapshot stacks (context switch), so the
    // markers must go with them or the pairing skews.
    entryHistoryRef.current = emptyEntryHistory();
    rawResetTabs(tabs);
  };
  // Escape-cancel for an in-flight drag: restore the gesture's
  // checkpoint and DISCARD the step (no redo entry — a cancelled drag
  // never happened), popping its marker in step.
  const cancelToCheckpoint = () => {
    entryHistoryRef.current = entryHistoryCancel(entryHistoryRef.current);
    rawCancelToCheckpoint();
  };

  // Stable id + name projection of the tabs for link-badge tooltips
  // (spec/09): keyed on a signature so it only changes when a tab is
  // added / removed / renamed, NOT on every element edit, keeping the
  // memoised element views from re-rendering as the user types.
  const tabSig = tabs.map((t) => `${t.id} ${t.name}`).join('');
  const tabSummaries = useMemo(
    () => tabs.map((t) => ({ id: t.id, name: t.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabSig],
  );

  // Ephemeral selection / edit UI (active tab, single + multi selection,
  // edit + format/group sources, the two transient picker flags). See
  // editor-ui-state. Destructured here because the body references these
  // names directly throughout; the whole slice is spread into the
  // returned view-model below (the `...panelLayout` / `...dialogs`
  // convention), so the explicit return doesn't re-list these.
  const uiState = useEditorUiState(initialTabs[0]!.id);
  const {
    activeId,
    setActiveId,
    selectedId,
    setSelectedId,
    soloSelectedId,
    setSoloSelectedId,
    editingId,
    setEditingId,
    setEditCursorAtEnd,
    formatSourceId,
    setFormatSourceId,
    groupSourceId,
    setGroupSourceId,
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
  const { canvasTool, setCanvasTool, selectCanvasTool } = useCanvasTool({ defaultPan: embedMode });
  // Persistent Format painter tool (spec/09). Active while the palette's
  // Format tool is picked: clicking elements arms a source then paints its
  // style onto each subsequent click (see useEditorDrag). Leaving the tool
  // disarms the source so a stale source never drives the single-shot
  // toolbar banner; entering it starts clean. A ref tracks the previous
  // tool so the reset fires only on the format-tool boundary (a blanket
  // `canvasTool !== 'format'` clear would wipe the single-shot painter the
  // instant it armed, since that path runs with the Select tool active).
  const formatToolActive = canvasTool === 'format';
  const prevCanvasToolRef = useRef(canvasTool);
  // The tool that was active when Format was entered, so wrapping up the
  // Format tool returns the user to what they were doing (spec/09) rather
  // than always dropping to Select.
  const preFormatToolRef = useRef<typeof canvasTool>('select');
  useEffect(() => {
    const wasFormat = prevCanvasToolRef.current === 'format';
    if (wasFormat !== formatToolActive) setFormatSourceId(null);
    if (!wasFormat && formatToolActive) preFormatToolRef.current = prevCanvasToolRef.current;
    prevCanvasToolRef.current = canvasTool;
  }, [canvasTool, formatToolActive, setFormatSourceId]);
  // Wrap up the Format tool (the mode banner's "Done", or a click on the
  // empty canvas): restore the tool that was active before Format, falling
  // back to Select (the boundary effect above clears the armed source).
  const exitFormatTool = () => {
    const prev = preFormatToolRef.current;
    setCanvasTool(prev === 'format' ? 'select' : prev);
  };
  // templatePickerMode (from useEditorUiState) gates the derived
  // `identityOnlyScreenOpen` chrome flag; transitions live in
  // `openTemplatePicker` / `skipTemplatePicker` / `chooseTemplate`.
  // Whether the participant has explicitly confirmed their identity in a
  // modal at least once (either Create Diagram on the welcome flow, Skip,
  // or Join Diagram on the join flow). Persisted via localStorage so a
  // returning visitor isn't re-prompted. Brand new visitors landing on a
  // pre-existing diagram see the join flow until they confirm.
  const [nameConfirmed, setNameConfirmed] = useState(false);
  // True after hydration if we successfully loaded a saved diagram from
  // the API (i.e. the user is joining someone else's diagram, not
  // starting a fresh one). Drives the join-screen trigger.
  const [loadedExistingDiagram, setLoadedExistingDiagram] = useState(false);
  // True when the URL points at a diagram that the API didn't return
  // (deleted, never existed, or owned by someone else). Renders the
  // NotFound surface instead of the editor + welcome modal.
  const [diagramNotFound, setDiagramNotFound] = useState(false);
  // Distinct from diagramNotFound (a clean 404): the load call itself
  // FAILED (network down / 5xx), which is retryable. Drives ApiErrorPage.
  const [loadError, setLoadError] = useState(false);
  // Loading screen is the default — every first paint shows the
  // spinner, including SSG output, so users hitting a `?d=` / `?s=`
  // URL never glimpse the empty canvas and assume their data is gone.
  // The hydration useLayoutEffect flips it to false either immediately
  // (no URL params → straight to welcome modal) or once the API call
  // resolves (params → load the diagram first).
  const [loadingDiagram, setLoadingDiagram] = useState(true);
  // User-facing tool picker. Spotlight (spec/09) is a non-editing presenter
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
        tool === 'isometric')
    ) {
      return;
    }
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
  // Comment-thread state + handlers. The open-id drives the
  // dynamic <CommentThreadPopover> JSX gate further down; the
  // action callbacks bind to the selection popover + the popover
  // itself. Mutations bypass the history hook (no Ctrl+Z eats a
  // half-typed comment), see apps/live/hooks/useEditorComments.ts.
  const {
    commentThreadOpenId,
    openComments,
    closeComments,
    addComment,
    replaceCommentId,
    deleteComment,
    resolveThread,
    unresolveThread,
  } = useEditorComments({ activeId, tickTabs, selfParticipant });

  // Keyboard-shortcut catalog modal + per-device disable toggle.
  // The toggle gates EVERY shortcut in useEditorKeyboardShortcuts
  // below; the modal opens from a button in the TabBar.
  const { enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled } = useShortcutsEnabled();
  // Sharing, session-permission and realtime-room infrastructure: the
  // shareable / team / share-code flags that gate the WS room, owner +
  // owner-badge info, the share-link list + password, the granted
  // session role + session share code, and the room / echo-guard refs.
  // See editor-realtime. Declared early so the preferences + capabilities
  // gates below can read `sharePasswordGate`. The slice is spread into
  // the returned view-model below, so the explicit return doesn't
  // re-list these.
  const realtime = useEditorRealtime();
  const {
    remoteUpdateRef,
    roomRef,
    diagramShareable,
    setDiagramShareable,
    diagramTeamId,
    setDiagramTeamId,
    diagramShareCode,
    setDiagramShareCode,
    setIsOwner,
    setDiagramOwnerId,
    setDiagramOwnerName,
    setDiagramOwnerColor,
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
  // Per-user editor preferences (spec/20): the state, the ref mirrors
  // the drag hook reads, and the localStorage read + D1 sync effects.
  // See useEditorPreferences.
  const { userPreferences, setUserPreferences, autoRebindArrowsRef, alignmentGuidesRef } =
    useEditorPreferences({
      ownerId: selfParticipant.id,
      passwordGated: sharePasswordGate !== null,
      setAiPanelVisible: panelLayout.setAiPanelVisible,
    });

  // Per-element note popover (state + open/close/setNote handlers)
  // lives in useEditorNotes. Invoked further down, after `commit`
  // exists.

  // Right-click context menu state (cursor position + element-scoped
  // vs tab-scoped mode). See useEditorContextMenu.
  const { contextMenu, setContextMenu, closeContextMenu } = useEditorContextMenu();

  // Element link picker (open + anchor state) and the link read/write
  // handlers live in useElementLinks. Invoked further down, after
  // `openDiagram` + the selection helpers exist.

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
  // Persistence-facing state: autosave status pill + savedAt, diagram
  // name (mirrored to the tab title), the Explorer's owned + shared
  // diagram lists, the activity/audit change log, and the transient
  // import-error toast — plus the two list-refresh helpers the hydration
  // + autosave paths call. See editor-persistence; the slice is spread
  // into the returned view-model below, so the explicit return doesn't
  // re-list these.
  const persistence = useEditorPersistence({ toast });
  const {
    setSaveStatus,
    setSavedAt,
    diagramName,
    setDiagramName,
    diagramList,
    setDiagramList,
    sharedDiagrams,
    setSharedDiagrams,
    setChangeLog,
    setChangeLogLoading,
    setImportError,
    refreshDiagramList,
    refreshSharedList,
  } = persistence;
  // Realtime presence state (who's connected + their cursors / selections
  // / laser trails / tab focus). See usePresenceState; the room writes it
  // via the setters, the presence-row builders read the values.
  const {
    livePresence,
    setLivePresence,
    lastSeenRef,
    remoteTabFocus,
    setRemoteTabFocus,
    remoteSelections,
    setRemoteSelections,
    remoteCursors,
    setRemoteCursors,
    remoteLaserTrails,
    setRemoteLaserTrails,
  } = usePresenceState();
  // Local laser trail — held in state so the overlay re-renders when
  // we append a point, but mutations stay cheap by always producing a
  // bounded array.
  // `localLaserTrail` now comes from useEditorBroadcast, declared
  // further down once the WS gates (roomRef, diagramShareable...)
  // are in scope. Editor-page still reads it for the laserTrailRows
  // aggregator that Canvas consumes.
  // Dismissing a "shared with you" row lives in useDiagramListActions
  // (via useDiagramActions below), shared with /explorer and /new.
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
  // placeholder and have the autosave wipe the real server row (spec/13).
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
  // Persistent diagram id. `null` until the post-mount hydration step
  // runs; that step reads ?d=<id> from the URL (or mints a fresh id +
  // updates the URL) and pulls any saved tabs + name from localStorage.
  // Saves are gated on `hydrated` so we never overwrite stored data
  // with the empty initial render.
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Sharing / session / owner / share-link state + the room refs all now
  // live in useEditorRealtime, destructured above. Embeds honour the share
  // code's role (spec/33): a view code renders a read-only viewer, an edit
  // code an editable embed. The api enforces the role on every write, so
  // this is presentation-side only.
  const isReadOnly = sessionRole === 'view';

  // Per-tab autosave. The previous snapshot lives in a ref so we can
  // diff: any tab whose object reference changed since last save is
  // ours to PUT; tab order / diagram rename hit the metadata PUT.
  // Debounced 600ms — feels responsive without hammering the API.
  // Spec/13 has the design.
  const lastSavedTabsRef = useRef<Tab[]>([]);
  const lastSavedNameRef = useRef<string>('');

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
  useAutosave({
    hydrated,
    diagramId,
    isReadOnly,
    tabs,
    diagramName,
    selfId: selfParticipant.id,
    sessionShareCode,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    remoteUpdateRef,
    previewingRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    setDiagramList,
  });

  // Persist self only when name or color actually changed. Without
  // this guard the hydration GET → state set → effect fire chain
  // produced a useless PUT echoing the same values back to the
  // server. Status is in-memory only (the API doesn't store it) so
  // it doesn't count as a change.
  const lastPersistedSelfRef = useRef<{ name: string; color: string } | null>(null);

  // One-shot identity + diagram hydration. See useIdentityBootstrap.
  // Placed after the last-saved/loaded refs so they're declared before
  // being passed in.
  useIdentityBootstrap({
    authLoaded,
    passwordRetry,
    hydrated,
    clerkUserId,
    clerkDisplayName,
    activeId,
    selfParticipant,
    refreshDiagramList,
    refreshSharedList,
    resetTabs,
    refs: { lastPersistedSelfRef, lastSavedTabsRef, lastSavedNameRef, loadedTabIdsRef },
    set: {
      setActiveId,
      setChangeLog,
      setChangeLogLoading,
      setDiagramId,
      setDiagramName,
      setDiagramNotFound,
      setLoadError,
      setDiagramOwnerColor,
      setDiagramOwnerId,
      setDiagramOwnerName,
      setDiagramShareable,
      setDiagramShareCode,
      setDiagramTeamId,
      setHydrated,
      setIsOwner,
      setLoadedExistingDiagram,
      setLoadedTabIds,
      setLoadingDiagram,
      setNameConfirmed,
      setSelfParticipant,
      setSessionRole,
      setSessionShareCode,
      setSharedDiagrams,
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
  // Realtime room: WebSocket per shared diagram (presence + ops). See
  // useRoomConnection.
  useRoomConnection({
    hydrated,
    diagramId,
    diagramShareable,
    diagramTeamId,
    selfParticipant,
    sessionShareCode,
    lastSeenRef,
    selfParticipantRef,
    remoteUpdateRef,
    sessionShareCodeRef,
    roomRef,
    applyRemoteTabs,
    setLivePresence,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteTabFocus,
    setRemoteLaserTrails,
    setChangeLog,
    setDiagramName,
    setSelfParticipant,
  });

  // Broadcast local selection + active-tab focus to peers (presence
  // indicators + TabBar avatars). See usePresenceBroadcast.
  usePresenceBroadcast({
    hydrated,
    diagramId,
    diagramShareable,
    diagramTeamId,
    selectedId,
    activeId,
    roomRef,
  });

  // Lazy fetch the active tab's full payload on first open, plus the
  // search panel's load-everything prefetch. See usePerTabLoad.
  const { loadAllTabs } = usePerTabLoad({
    hydrated,
    diagramId,
    activeId,
    selfId: selfParticipant.id,
    sessionShareCode,
    tabsRef,
    loadedTabIdsRef,
    setLoadedTabIds,
    setTabLoadErrors,
    retryNonce: tabLoadRetryNonce,
    remoteUpdateRef,
    resetTabs,
  });

  // Teams the signed-in user belongs to (spec/32), surfaced in the
  // search panel. Fetched lazily the first time search opens so
  // guest sessions and non-searching sessions never pay the request;
  // guests can't have teams, so the gate also requires a Clerk id.
  // Signed-in only (guests can't have teams). Loaded for the whole
  // session, not just while search is open, because the floating
  // Explorer panel now surfaces teams + their diagrams (a Teams
  // accordion, team rows in Recent, the current team diagram —
  // spec/35), so the data has to be present whenever the panel is.
  const { teams } = useTeams(clerkUserId ?? null, {
    enabled: !!clerkUserId,
  });
  // Their libraries (spec/35): one sweep per team. Feeds the search
  // panel's folder group AND the floating Explorer panel (team folder
  // tree + team diagrams in Recent + the current team diagram).
  const {
    teamFolders,
    teamDiagrams,
    refresh: refreshTeamLibraries,
  } = useTeamLibrariesSweep(clerkUserId ?? null, teams, {
    enabled: !!clerkUserId,
  });

  // Outbound realtime broadcasters (cursor + laser) and the local
  // laser-trail buffer live in useEditorBroadcast. Same throttle,
  // same gates, same trail-clears-on-tool-change behaviour as
  // before, just out of the page file.
  const { broadcastCursor, broadcastLaser, localLaserTrail } = useEditorBroadcast({
    roomRef,
    hydrated,
    diagramId,
    diagramShareable,
    diagramTeamId,
    activeId,
    canvasTool,
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

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;

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
    scrollIntoView,
  } = useEditorViewport({ activeTab, selectedId });

  // Server capabilities (spec/25). Fetched once at mount; determines
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

  // Tab-entry side effects (URL #t= pin + fit-to-screen once per tab
  // entry). See useTabEntryEffects.
  useTabEntryEffects({
    hydrated,
    activeId,
    elementCount: activeTab.elements.length,
    fitToScreen,
  });

  // Derived realtime presence rows (avatars per tab, remote cursors,
  // laser trails, per-element selections) and the concurrent-selection
  // lock (spec/07). Pure derivation over the usePresenceState values +
  // the local laser trail. See usePresenceRows.
  const {
    participantsByTab,
    remoteCursorRows,
    laserTrailRows,
    remoteSelectionsByElement,
    lockedByOther,
  } = usePresenceRows({
    diagramShareable,
    diagramTeamId,
    activeId,
    selfParticipant,
    tabs,
    livePresence,
    lastSeenRef,
    remoteTabFocus,
    remoteCursors,
    remoteSelections,
    remoteLaserTrails,
    localLaserTrail,
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

  // Assigned-action state + handlers (spec/68), the comments hook's
  // sibling: the popover open-id, the Assign Action dialog target, and
  // the save / complete / reopen / delete mutations. Mutations bypass
  // history like comments (Cmd+Z must never silently unassign work).
  // The email notify is fire-and-forget through the api worker, which
  // re-verifies team membership + diagram access server-side.
  const {
    actionPopoverOpenId,
    openActionPopover,
    closeActionPopover,
    assignActionFor,
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
    getAction: (elementId) => {
      const el = activeTab.elements.find((e) => e.id === elementId);
      return el && isBoxed(el) ? el.action : undefined;
    },
    // The signed-in account, or the hydrated guest participant identity
    // (guests may self-assign, spec/68 §2). Null only pre-hydration.
    self: {
      userId: clerkUserId ?? (hydrated ? selfParticipant.id : null),
      name: clerkDisplayName ?? (hydrated ? selfParticipant.name : null),
    },
    notify: (input) => {
      if (!clerkUserId || !diagramId) return;
      void apiNotifyActionAssigned(clerkUserId, input.teamId, {
        assigneeUserId: input.assigneeUserId,
        assigneeMemberId: input.assigneeMemberId,
        diagramId,
        actionName: input.actionName,
        ...(input.description ? { description: input.description } : {}),
      }).catch(() => {});
    },
  });

  // Action rows (open AND done — the panel filters between Outstanding
  // and Completed) for the floating Actions panel (spec/68), the
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
  // Welcome ("New Diagram") lives on /live/new post-spec/14, so any
  // time the picker fires on the editor route it's the per-tab
  // "Pick a template" variant. Identity (visitor join) keeps its
  // own mode.
  const effectiveTemplatePickerMode =
    templatePickerMode === 'identity' ? ('identity' as const) : ('templates' as const);
  // The Quick Start (template grid) only opens on an EXPLICIT request — adding
  // a tab (useTabActions.addTab) or the empty-canvas button, both of which set
  // templatePickerMode='templates'. It no longer auto-opens just because a tab
  // is empty, so a freshly-created (truly blank) diagram lands on the canvas.
  const templateGridOpen = templatePickerMode === 'templates';
  // Join screen for visitors landing on an existing diagram who haven't
  // confirmed their identity yet. Same chrome-hide rule as the old
  // welcome modal — focus the user on the name input before they
  // start editing.
  //
  // View-role visitors get this too: their name is broadcast to other
  // participants (cursor label, presence stack, comments), so they need
  // a chance to set it before joining rather than appearing under a
  // default. The identity card only writes the participant's OWN row
  // (PUT /api/participants/:id, gated on owner === id, not diagram
  // edit), so a viewer can confirm a name without any 403. EditorView
  // lets the IDENTITY mode of the picker through for read-only while
  // still blocking the template-choosing mode.
  //
  // Embeds skip the prompt entirely (spec/33): a "what's your name"
  // card inside a README iframe is wrong, so embed sessions keep
  // their default guest identity silently.
  const joinScreenOpen =
    !embedMode &&
    hydrated &&
    loadedExistingDiagram &&
    !nameConfirmed &&
    templatePickerMode === 'identity';
  const identityOnlyScreenOpen = joinScreenOpen;
  // Combined gate for chrome-hide. Only the join-existing flow lives
  // on this route now; the historical new-diagram welcome lives on
  // /live/new.
  const anyWelcomeOpen = identityOnlyScreenOpen;

  // --- Element-scoped history helpers (active-tab aware) -------------------

  // Single emission point for activity-log entries. Every editorial
  // change goes through here — both element commits and surgical
  // reverts — so the audit stays honest. See
  // specs/12-activity-and-audit.md. Optimistic: we prepend the entry
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
  const changeLogRef = useRef(persistence.changeLog);
  changeLogRef.current = persistence.changeLog;
  const { emitChange, emitTabMeta } = useActivityLogEmitter({
    diagramId,
    selfParticipant,
    setChangeLog,
    entryHistoryRef,
    sessionShareCode,
    roomRef,
    changeLogRef,
  });

  // A locked tab refuses every element mutation. Commit /
  // tick / element-add helpers all consult this early-return guard
  // so a single check covers drag, edit, paint, delete, etc.
  const activeTabLocked = activeTab.locked === true;
  // Lazy per-tab load gate (spec/13). Until the active tab's content has
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
    hasDiagram: !!diagramId,
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
  const editsBlocked = activeTabLocked || isReadOnly || activeTabLoadState !== 'ready';

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

  // Layers domain slice (spec/74): the active layer, the panel /
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
  activeLayerStampRef.current = { tabId: activeId, layerId: activeLayerId };
  // Element creation lands on the active layer, so it's additionally
  // blocked while that layer is hidden or locked (spec/74).
  const createBlocked = editsBlocked || activeLayerBlocked;

  // A layer turning hidden or locked (locally or by a peer) drops its
  // elements from any live selection — the same guarantee delete gives.
  useEffect(() => {
    if (layerInertIds.size === 0) return;
    if (selectedId && layerInertIds.has(selectedId)) setSelectedId(null);
    if ([...multiSelectedIds].some((id) => layerInertIds.has(id))) {
      setMultiSelectedIds(new Set([...multiSelectedIds].filter((id) => !layerInertIds.has(id))));
    }
    // Selection state is read, not watched: this only needs to run when
    // the inert set itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerInertIds]);

  // Apply AI-returned elements as a single undo block (spec/25).
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
  // Hover-to-preview for the Activity rows' Revert (spec/12): resting
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
    diagramId,
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
      setGroupSourceId,
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
  // Selection + placement + format/group helpers. See useElementHelpers.
  const {
    addBoxed,
    addBoxedAt,
    memberIdsOf,
    currentSelectionIds,
    selectionPrimary,
    exitFormatPainter,
    exitGroupMode,
    applyFormatFromSource,
    completeGrouping,
  } = useElementHelpers({
    selectedId,
    soloSelectedId,
    activeId,
    activeTab,
    // Creation-only helpers: additionally blocked while the active layer
    // is hidden / locked (spec/74).
    editsBlocked: createBlocked,
    multiSelectedIds,
    formatSourceId,
    groupSourceId,
    getViewportCenter,
    commit,
    commitTabs,
    emitChange,
    setSelectedId,
    setFormatSourceId,
    setGroupSourceId,
  });

  // --- Tab actions ---------------------------------------------------------

  // Tab-lifecycle actions (add / import / rename / duplicate / delete /
  // reorder, active-tab lock, link-into-diagram, clear content). They
  // touch history, the activity log, selection, telemetry, confirm /
  // toast, the change-log panel and the diagram list — see
  // useTabActions. Diagram-level lifecycle + the template flow stay in
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
    diagramList,
    ownerId: selfParticipant.id,
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
    setGroupSourceId,
    setTemplatePickerMode,
    setImportError,
    setChangeLog,
    refreshDiagramList,
    confirm,
    toast,
  });

  // Tab-folder membership (spec/30), kept separate from the busy
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

  // Diagram-level lifecycle + navigation (delete / duplicate /
  // move-to-folder / delete-folder, and the new / open / make-a-copy
  // full-page-load helpers). Operates on whole diagrams + the Explorer
  // list, distinct from per-tab lifecycle in useTabActions. See
  // useDiagramActions.
  const {
    deleteDiagram,
    deleteFolder,
    moveDiagramToFolder,
    moveDiagramTo,
    duplicateDiagram,
    dismissSharedDiagram,
    newDiagram,
    openDiagram,
    makeCopy,
  } = useDiagramActions({
    diagramId,
    diagramName,
    diagramList,
    setDiagramList,
    confirm,
    ownerId: selfParticipant.id,
    hookDeleteFolder,
    sharedDiagrams,
    setSharedDiagrams,
    copying,
    setCopying,
    sessionShareCode,
    refreshTeamLibraries,
    refreshDiagramList: () => refreshDiagramList(selfParticipant.id),
    // Keep the header's Private / Team badge honest when the OPEN diagram
    // changes scope via the move picker (spec/35).
    onDiagramScopeChanged: (id, teamId) => {
      if (id === diagramId) setDiagramTeamId(teamId);
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
    revokeShareLink,
    setDiagramSharePassword,
    shareUrlFor,
  } = useShareLinks({
    diagramId,
    selfParticipant,
    setSelfParticipant,
    setShareLinks,
    setSharePassword,
    setDiagramShareable,
    setDiagramShareCode,
    diagramShareCode,
    confirmName,
  });

  // Template / identity modal actions. See useTemplateFlow. confirmName
  // stays in the page (also wired into useShareLinks) and is passed in.
  const { openTemplatePicker, skipTemplatePicker, chooseTemplate } = useTemplateFlow({
    activeId,
    templatePickerMode,
    selfParticipant,
    getViewportCenter,
    commitTabs,
    confirmName,
    setSelectedId,
    setEditingId,
    setSelfParticipant,
    setTemplatePickerMode,
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

  // Live session tools (spec/39): facilitator timer + dot-voting handlers.
  // State lives on the tab (`activeTab.timer` / `activeTab.vote`), so the
  // UI reads it straight off the tab; these are just the mutators.
  const {
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    castVote,
    retractVote,
  } = useTabSession({
    editsBlocked,
    activeId,
    activeTab,
    // The non-history mutator, per spec/39: starting a timer or
    // placing a dot isn't undoable (and mustn't evict real edits
    // from the bounded undo stack).
    commitTabs: tickTabs,
    emitTabMeta,
    selfId: selfParticipant.id,
  });

  // Image domain (picker state, recent-images list, placement + fill
  // handlers). Lives in its own hook so the page no longer carries
  // that state or its six handlers — see useEditorImages + spec/19.
  const {
    imagePickerOpenFor,
    imageContext,
    addImage,
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
    diagramId,
    ownerId: selfParticipant.id,
    sessionShareCode,
  });

  // Per-element note popover (single plain-text paragraph; see
  // packages/diagram BoxedElement.note). State + handlers in
  // useEditorNotes.
  const { noteOpenId, openNote, closeNote, setNote } = useEditorNotes({ commit });

  // --- Element CRUD --------------------------------------------------------

  // Draw-to-size + freehand pen tooling (pendingDraw state machine +
  // commit handlers). beginDrawIfEnabled short-circuits the palette
  // adds below into draw mode; the rest is consumed by the Canvas +
  // keyboard hook. See useShapeDrawing.
  const { pendingDraw, beginDraw, commitDraw, cancelDrawShape, beginFreehand, commitFreehand } =
    useShapeDrawing({
      editsBlocked: createBlocked,
      selectedId,
      canvasTool,
      setCanvasTool,
      activeTab,
      commit,
      setSelectedId,
      setMultiSelectedIds,
      setEditingId,
      openImagePickerFor,
      zoomRef,
    });

  // Palette element-creation handlers. See useElementCreation.
  const {
    addShape,
    addIcon,
    addTechIcon,
    addTable,
    addAnnotation,
    addLinkCard,
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
    activeId,
    activeTab,
    selectedId,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxed,
    addBoxedAt,
    beginDraw,
  });

  // Inline-icon attach/detach mutators (a shape's single inline icon).
  // Cohesive slice extracted to useInlineIconMutators — closes over only
  // editsBlocked + commit.
  const { dropIconOnElement, removeIconFromElement, dropIconElementOnShape } =
    useInlineIconMutators({ editsBlocked, commit });

  // Per-cell table links (spec/09). Which cell's link picker is open +
  // the history-committed write into that cell's style. See
  // useCellLinkPicker; the shared LinkPickerDialog renders against it
  // in EditorView.
  const { cellLinkPickerOpenFor, setCellLinkPickerOpenFor, openCellLinkPicker, applyCellLink } =
    useCellLinkPicker({ editsBlocked, commit });

  // Structural element operations (delete, marquee commit, group /
  // ungroup, and the duplicate family). They change the element set
  // and/or the selection rather than element fields; see
  // useElementSelectionActions.
  const {
    deleteSelected,
    selectMarquee,
    groupMultiSelected,
    toggleLockMultiSelected,
    duplicateMultiSelected,
    deleteMultiSelected,
    narrowMultiSelection,
    duplicateSelected,
    spawnConnectSelected,
    ungroupSelected,
  } = useElementSelectionActions({
    currentSelectionIds,
    memberIdsOf,
    selectedId,
    multiSelectedIds,
    activeTab,
    commit,
    setSelectedId,
    setEditingId,
    setMultiSelectedIds,
    setFormatSourceId,
    setGroupSourceId,
    lockedByOther,
    layerLockedIds,
    layerInertIds,
  });

  // Eraser canvas tool (spec/09): press / drag to delete any element the
  // pointer touches, as a single-undo gesture. Canvas calls beginErase
  // from its capture-phase pointerdown. See useCanvasEraser.
  const { beginErase } = useCanvasEraser({
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
    setFontSelected,
    toggleTextStyleSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setOpacitySelected,
    setPaddingSelected,
    setIconSizeSelected,
    setArrowEndsSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    setTableHeaderFillSelected,
    setTableHeaderTextColorSelected,
    setArrowStyleSelected,
    setArrowStrokeStyleSelected,
    setShapeKindSelected,
    resetAspectRatioSelected,
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
    commit,
    commitActiveTab,
    tickTabs,
    markCheckpoint,
    scheduleElementChangeLog,
  });

  // Hover-to-preview for the style-preset tiles (spec/48): hovering a preset on
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
    commitFillColor,
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
    previewRotation,
    commitRotation,
    previewShapeKind,
    commitShapeKind,
    previewIconSize,
    commitIconSize,
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
    setGroupSourceId,
    openDiagram,
  });

  // Selection-editing handlers (format/group modes, label edit, type-to-
  // edit, single + shift-click select). See useSelectionEditing.
  const {
    beginFormatPainter,
    beginGroup,
    beginEdit,
    commitLabel,
    commitTable,
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
    groupSourceId,
    multiSelectedIds,
    diagramName,
    tabs,
    activeTab,
    commit,
    tickTabs,
    applyFormatFromSource,
    lockedByOther,
    set: {
      setFormatSourceId,
      setGroupSourceId,
      setSelectedId,
      setSoloSelectedId,
      setEditingId,
      setEditCursorAtEnd,
      setMultiSelectedIds,
      setDiagramName,
      setContextMenu,
    },
  });

  // Canvas accessibility baseline (spec/71): Tab / Shift+Tab element
  // traversal while the canvas surface is focused, plus SR live-region
  // announcements on selection changes. See useCanvasA11y.
  useCanvasA11y({
    enabled: shortcutsEnabled,
    elements: activeTab.elements,
    selectedId,
    multiSelectedIds,
    editingId,
    selectElement,
    lockedByOther,
    layerInertIds,
    scrollIntoView,
  });

  // Vote-results review (spec/39): the local walkthrough of revealed top
  // picks — focus highlight + Previous / Next / Done in the vote banner.
  const { voteReview, nextVoteResult, prevVoteResult, doneVoteReview } = useVoteReview({
    activeTab,
    scrollIntoView,
    clearVote,
  });

  // Keyboard nudge (spec/09 Move). See useNudgeSelection for the
  // burst-coalescing + auto-rebind behaviour; this hook also owns
  // the timer-cleanup-on-unmount that the prior inline version
  // didn't have.
  const nudgeSelection = useNudgeSelection({
    isReadOnly,
    multiSelectedIds,
    selectedId,
    activeTab,
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
    addCurvePoint,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  } = useEditorDrag({
    activeTab,
    layerInertIds,
    zoomRef,
    selectedId,
    setSelectedId,
    soloSelectedId,
    setSoloSelectedId,
    multiSelectedIds,
    setMultiSelectedIds,
    editingId,
    isReadOnly,
    formatSourceId,
    applyFormatFromSource,
    formatToolActive,
    setFormatSourceId,
    groupSourceId,
    completeGrouping,
    connectSourceId,
    connectArrowTo,
    tick,
    commit,
    markCheckpoint,
    cancelToCheckpoint,
    scheduleElementChangeLog,
    onIconElementDroppedOnShape: editsBlocked ? undefined : dropIconElementOnShape,
    // Click (not drag) on an annotation marker opens its note editor
    // (spec/38). Blocked alongside other edits on a locked / read-only tab.
    onAnnotationClicked: editsBlocked ? undefined : openNote,
    autoRebindArrowsRef,
    alignmentGuidesRef,
    isPinchingRef,
  });

  // Copy / paste (in-app element clipboard + OS-clipboard image
  // paste). `copySelection` feeds the keyboard hook below; paste is
  // driven by a native `paste` listener the hook owns. See
  // useClipboard.
  const { copySelection } = useClipboard({
    isReadOnly,
    embedMode,
    selectedId,
    multiSelectedIds,
    editingId,
    memberIdsOf,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    addImageFromGallery,
    ownerId: selfParticipant.id,
    diagramId,
    toast,
  });

  // Zen / focus mode (spec/26). Flips the chrome-hidden flag and emits
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
  // useEditorKeyboardShortcuts and is catalogued in spec/09.
  useEditorKeyboardShortcuts({
    formatSourceId,
    setFormatSourceId,
    groupSourceId,
    setGroupSourceId,
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
    onBeginEditSelected: beginEdit,
    onNudgeSelection: nudgeSelection,
    onTypeIntoSelected: typeIntoSelected,
    pendingDraw,
    onCancelDraw: cancelDrawShape,
    onGroupOrUngroup: () => {
      if (multiSelectedIds.size > 1) {
        groupMultiSelected();
      } else {
        ungroupSelected();
      }
    },
    onToggleLock: () => {
      if (multiSelectedIds.size > 0) {
        toggleLockMultiSelected();
      } else {
        toggleLockSelected();
      }
    },
    onSelectAll: () => {
      // Hidden / locked layers are excluded from select-all (spec/74).
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
    enabled: shortcutsEnabled,
  });

  return {
    ...panelLayout,
    ...dialogs,
    ...uiState,
    ...persistence,
    ...realtime,
    activeTab,
    activeTabLocked,
    // Layers (spec/74): the normalised stack, the session-scoped active
    // layer, per-layer element counts, the interaction-gate id sets, and
    // the panel / context-menu ops.
    layers,
    activeLayerId,
    activeLayerBlocked,
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
    // Menu-facing wrapper: moves the CURRENT selection (group-expanded)
    // onto the picked layer.
    moveSelectedToLayer: (layerId: string) =>
      layersState.moveSelectionToLayer(currentSelectionIds(), layerId),
    addArrow,
    addComment,
    replaceCommentId,
    addIcon,
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
    applyTabFontToAll,
    // Live session tools (spec/39)
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
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
    addCurvePoint,
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
    beginGroup,
    bringSelectedToFront,
    broadcastCursor,
    broadcastLaser,
    canRedo,
    canUndo,
    cancelDrawShape,
    cancelEdit,
    canvasMainRef,
    canvasTool,
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
    commitLabel,
    commitTable,
    contextMenu,
    createFolder,
    createShareLink,
    deleteComment,
    deleteDiagram,
    deleteFolder,
    deleteMultiSelected,
    deleteSelected,
    deleteTab,
    diagramId,
    diagramNotFound,
    loadError,
    dismissSharedDiagram,
    spawnConnectSelected,
    duplicateDiagram,
    duplicateMultiSelected,
    duplicateSelected,
    duplicateTab,
    effectiveTemplatePickerMode,
    templateGridOpen,
    embedMode,
    exitFormatPainter,
    exitGroupMode,
    extendShareLink,
    fitToScreen,
    folders,
    followLink,
    groupMultiSelected,
    handleActivityRowClick,
    handleCanvasDoubleClick,
    hydrated,
    identityOnlyScreenOpen,
    imageContext,
    imagePickerOpenFor,
    importIntoActiveTab,
    importTextIntoActiveTab,
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
    livePresence,
    loadAllTabs,
    loadedTabIds,
    loadingDiagram,
    makeCopy,
    moveDiagramToFolder,
    moveDiagramTo,
    nameConfirmed,
    voteReview,
    nextVoteResult,
    prevVoteResult,
    doneVoteReview,
    narrowMultiSelection,
    newDiagram,
    noteOpenId,
    openComments,
    openDiagram,
    openNote,
    openTemplatePicker,
    participantsByTab,
    pendingDraw,
    redo,
    refreshRecentImages,
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
    // Style-preset hover preview + click commit (spec/48).
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
    commitFillColor,
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
    previewRotation,
    commitRotation,
    previewShapeKind,
    commitShapeKind,
    previewIconSize,
    commitIconSize,
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
    setArrowStyleSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setTableHeaderRowSelected,
    setTableHeaderColumnSelected,
    setTableZebraSelected,
    setTableHeaderFillSelected,
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
    setContextMenu,
    setDiagramSharePassword,
    setFillColorSelected,
    setLinkPickerOpenForId,
    setLoadingDiagram,
    setNote,
    setOpacitySelected,
    setPaddingSelected,
    setIconSizeSelected,
    setPatternColor,
    setShapeKindSelected,
    resetAspectRatioSelected,
    setRotationSelected,
    setShortcutsEnabled,
    setStrokeColorSelected,
    setFontSelected,
    setTextAlignSelected,
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
    diagramTeamId,
    setDiagramTeamId,
    emailEnabled,
    actionPopoverOpenId,
    actionRows,
    assignActionFor,
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
    teamDiagrams,
    teams,
    toggleActiveTabLock,
    toggleZenMode,
    toggleAspectLockSelected,
    toggleInMultiSelect,
    toggleLockMultiSelected,
    toggleLockSelected,
    toggleTextStyleSelected,
    undo,
    ungroupSelected,
    unresolveThread,
    updateParticipantName,
    userPreferences,
    viewportOffset,
    viewportZoom,
    writeUserPreferences,
  };
}
