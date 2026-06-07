'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isBoxed, type BoxedElement, type Element, type Tab } from '@livediagram/diagram';
import { type EditorContextMenuState } from '@/components/EditorContextMenu';
// Lazy-load EditorContextMenu: the right-click menu only renders
// while `contextMenu` is non-null, so the menu's render tree + its
// icon set never need to ship in the editor's initial chunk. Same
// gate pattern as TabLinkPicker, ShortcutsDialog, etc. Visitors
// (view-role) skip it entirely because the parent already gates on
// `!isReadOnly`.
// Lazy-load TabLinkPicker: only mounts when `linkPickerOpenForId`
// is set (the user clicked the link icon on a selected element).
// Most sessions never open it. Same lazy pattern as the dialogs
// below, the picker's tab-grid + diagram-grid stays out of the
// initial chunk.
// Lazy-load CommentThreadPopover for the same reason as
// ExportTabDialog / ShareDialog: it's gated on commentThreadOpenId
// (right-click an element, pick Comments), most sessions never
// open it, and the 305-line popover + its emoji / mention helpers
// don't belong in the editor's initial chunk.
import type { SaveStatus } from '@/components/EditorHeader';

// Lazy-load ExportTabDialog: it pulls in lib/export-tab's canvas
// + PDF renderers (a measurable chunk of bytes), all of which only
// matter the moment the user actually clicks Export. The dialog
// is already gated on `exportOpen`, so swapping the static import
// for next/dynamic doesn't change any render code, just hoists the
// underlying module into its own chunk that loads on demand.
// Lazy-load NotFound: the diagram-404 surface only renders when the
// `diagramNotFound` state flips true, which happens on (a) a guest
// id with no diagrams at that slug, (b) a revoked share code, or
// (c) a bad URL. Every successful editor load (the overwhelming
// majority) renders the canvas + editor chrome and never touches
// NotFound, so eagerly shipping its 69 lines was paying for the
// rare-path branch on every common-path load. Same lazy pattern
// as the dialogs below.
// Lazy-load SharePasswordGate: only a visitor opening a password-
// protected diagram's share link ever sees it (spec/24).
// Lazy-load ShareDialog for the same reason as ExportTabDialog: it
// mounts only when the user clicks Share, and most sessions never
// open it. Hoisting it into its own chunk means the editor's initial
// bundle doesn't ship the dialog's 382 lines + its share-link
// helpers up front.
// Lazy-load NotePopover: only mounts when `noteOpenId !== null`,
// which the user only triggers by right-clicking an element and
// picking "Add note" / "Edit note". Same pattern as the dialogs
// above so the editor's initial chunk doesn't ship the popover's
// auto-resize textarea + close-on-escape wiring up front.
// Lazy-load SearchPanel for the same reason as the other modals
// (ExportTabDialog / ShareDialog / TemplatePicker / CommentThread
// Popover): it's gated on `searchOpen`, which only flips true when
// the user clicks the footer Search button. Most editor sessions
// never open it. The fetch latency on first open is well under
// 100 ms on a warm Next chunk fetch, and the panel is animated in
// (animate-fly-up-in) so the small gap reads as the entrance, not
// a stall.
// Lazy-load ImagePicker: heavy modal that's only mounted while the
// user is actively choosing an image. Same lazy pattern as the other
// modals (ShareDialog, ExportTabDialog, SearchPanel) so the editor's
// initial chunk doesn't ship the picker's gallery grid + upload
// drop-zone until the moment they're needed.
// Lazy-load ShortcutsDialog for the same reason as ExportTabDialog
// and ShareDialog: it mounts only when the user clicks the
// keyboard-shortcut button in the footer, and most editor sessions
// never open it. Hoisting the 138-line dialog plus its full
// shortcut table into its own chunk means the editor's initial
// bundle doesn't ship them up front.
// Lazy-load SettingsDialog: opens only when the user clicks the
// footer gear (spec/20). Same lazy pattern as the other modals.
// AiPanel content is rendered inside Canvas via MovablePanel (spec/25).
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import { useClipboard } from '@/hooks/useClipboard';
import { useDiagramActions } from '@/hooks/useDiagramActions';
import { useDiagramHistory } from '@/hooks/useDiagramHistory';
import { useNudgeSelection } from '@/hooks/useNudgeSelection';
import { useFolders } from '@/hooks/useFolders';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import {
  readUserPreferences,
  fetchUserPreferences,
  writeUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';
import { useActivityLogDebounce } from '@/hooks/useActivityLogDebounce';
import { useActivityLogEmitter } from '@/hooks/useActivityLogEmitter';
import { useEditorBroadcast } from '@/hooks/useEditorBroadcast';
import { useShortcutsEnabled } from '@/hooks/useShortcutsEnabled';
import { useEditorComments } from '@/hooks/useEditorComments';
import { useEditorDrag } from '@/hooks/useEditorDrag';
import { useEditorImages } from '@/hooks/useEditorImages';
import { useEditorNotes } from '@/hooks/useEditorNotes';
import { useElementLinks } from '@/hooks/useElementLinks';
import { useElementSelectionActions } from '@/hooks/useElementSelectionActions';
import { useElementStyle } from '@/hooks/useElementStyle';
import { useShapeDrawing } from '@/hooks/useShapeDrawing';
import { useShareLinks } from '@/hooks/useShareLinks';
import { useTabActions } from '@/hooks/useTabActions';
import { useTabCanvas } from '@/hooks/useTabCanvas';
import { useEditorKeyboardShortcuts } from '@/hooks/useEditorKeyboardShortcuts';
import { useEditorViewport } from '@/hooks/useEditorViewport';
import { useCanvasPinchZoom } from '@/hooks/useCanvasPinchZoom';
import { useCapabilities } from '@/hooks/useCapabilities';
import { type Participant } from '@/lib/identity';
import {
  buildLaserTrailRows,
  buildParticipantsByTab,
  buildRemoteCursorRows,
  buildRemoteSelectionsByElement,
} from '@/lib/presence-rows';
import { markNameConfirmed } from '@/lib/local-identity';
import {
  apiDismissSharedWith,
  apiListDiagrams,
  apiListSharedWith,
  apiSaveSelf,
  connectRoom,
  type ChangeLogEntry,
  type ShareLink,
  type ShareRole,
  type SharedWithItem,
  DIAGRAM_LIST_LOAD_SAFETY_MS,
} from '@/lib/api-client';
import { commentRowsFromElements } from '@/components/CommentsPanel';
import { autoAlignElements } from '@/lib/auto-align';
import { createTab, patchTab } from './editor-page-helpers';
import { useAutosave } from './useAutosave';
import { usePerTabLoad } from './usePerTabLoad';
import { useRoomConnection } from './useRoomConnection';
import { useIdentityBootstrap } from './useIdentityBootstrap';
import { useEditorHistory } from './useEditorHistory';
import { useTemplateFlow } from './useTemplateFlow';
import { usePanelLayout } from './usePanelLayout';
import { usePresenceState } from './usePresenceState';
import { useEditorDialogs } from './useEditorDialogs';
import { useElementHelpers } from './useElementHelpers';
import { useElementCreation } from './useElementCreation';
import { useSelectionEditing } from './useSelectionEditing';

// Activity-log past/future stacks share the cap with the
// state-snapshot stack: we can't undo past what useDiagramHistory
// remembers, so there's no point in tracking more log entries than
// that. Imported from the hook directly so the two stacks can't
// drift (was a literal mirror of `3` here, which is the kind of
// duplication a future HISTORY_LIMIT bump would silently break).

export function useEditorState() {
  const initialTabs: Tab[] = [createTab('Tab 1')];

  // Clerk wiring (token provider + guest→authed migration). One hook
  // does both — see `hooks/useClerkApiBootstrap.ts`. The values it
  // returns are the same ones `useAuth()` would; we read them via the
  // hook so the page has one source of truth.
  const { authLoaded, clerkUserId, clerkDisplayName } = useClerkApiBootstrap();

  const {
    tabs,
    canUndo,
    canRedo,
    commit: commitTabs,
    tick: tickTabs,
    markCheckpoint,
    reset: resetTabs,
    undo: undoHistory,
    redo: redoHistory,
  } = useDiagramHistory(initialTabs);

  const [activeId, setActiveId] = useState<string>(() => initialTabs[0]!.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formatSourceId, setFormatSourceId] = useState<string | null>(null);
  const [groupSourceId, setGroupSourceId] = useState<string | null>(null);
  // Drag state lives inside the useEditorDrag hook, lifted out of
  // this component to keep the page focused on orchestration. The
  // hook is invoked further down (after `tick`, `commit`,
  // `applyFormatFromSource` and the rest of the drag dependencies
  // exist).
  // Floating-panel layout (positions + open/visible flags) is one
  // cohesive slice — see usePanelLayout. requestEditorOpen bumps a
  // counter the Editor accordion watches so external actions (Activity
  // row navigation, tab-context-menu Change Theme / Canvas) can pop it
  // open; the panel resets its collapsed state on each change so
  // navigation always lands on a visible accordion (spec/09).
  // Spread wholesale into the returned view-model (see the return below);
  // only requestEditorOpen is consumed internally, off the slice object.
  const panelLayout = usePanelLayout();
  const dialogs = useEditorDialogs();
  // Tab-section accordion state lifted here so the Activity row
  // click handler can pop the matching accordion (e.g. clicking a
  // "Changed theme to X" entry opens the Theme accordion).
  const [tabAccordionsOpen, setTabAccordionsOpen] = useState<{
    theme: boolean;
    canvas: boolean;
    cleanup: boolean;
  }>({ theme: false, canvas: false, cleanup: false });
  // Canvas tool — Pan (default, drag-on-empty scrolls) vs Select
  // (drag-on-empty marquee-selects). Holding Space always pans
  // regardless. Lives in page so other components (e.g. status bar
  // later) can read it without prop-drilling through Canvas.
  const [canvasTool, setCanvasTool] = useState<'pan' | 'select' | 'laser'>('pan');
  // Picker mode lives here (rather than nearer `chooseTemplate`) so the
  // derived `identityOnlyScreenOpen` below — used to gate page-level
  // chrome for the visitor join flow — can read it. See
  // `openTemplatePicker` / `skipTemplatePicker` for transitions.
  // Note: welcome / "New Diagram" lives on /live/new (spec/14); the
  // 'welcome' value here is only used as a benign reset target.
  const [templatePickerMode, setTemplatePickerMode] = useState<
    'welcome' | 'templates' | 'identity'
  >('welcome');
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
  // Surfaced in the footer (bottom-right of the TabBar). The autosave
  // used to swallow errors silently which made an offline API look
  // identical to a successful save; the indicator below makes the
  // result visible. `savedAt` is the epoch ms of the last successful
  // write — drives the "Saved 2 minutes ago" relative-time string.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [diagramName, setDiagramName] = useState('Untitled diagram');
  // Reflect the diagram name in the browser tab so users with many
  // tabs open can spot the right one. Falls back to the bare brand
  // until hydration lands the real name.
  useEffect(() => {
    document.title = diagramName ? `${diagramName} | livediagram` : 'livediagram';
  }, [diagramName]);
  // Multi-selection bag for marquee box-select. Mutually exclusive with the
  // single `selectedId` above: when `multiSelectedIds.size > 0`, single
  // selection / its popover / its accordion controls are suppressed. Both
  // are cleared together by `onDeselect` and by clicking any single element.
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
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
    deleteComment,
    resolveThread,
    unresolveThread,
  } = useEditorComments({ activeId, tickTabs, selfParticipant });

  // Keyboard-shortcut catalog modal + per-device disable toggle.
  // The toggle gates EVERY shortcut in useEditorKeyboardShortcuts
  // below; the modal opens from a button in the TabBar.
  const { enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled } = useShortcutsEnabled();
  // Viewer-side password gate. Non-null when the visitor's share URL
  // points at a password-protected diagram and they haven't supplied a
  // valid password yet. Declared early so the preferences and capabilities
  // effects below can gate on it.
  const [sharePasswordGate, setSharePasswordGate] = useState<{ invalid: boolean } | null>(null);
  // Per-user editor preferences (spec/20). One localStorage key,
  // applies to every diagram the user opens from this device. Loaded
  // on mount (not gated on diagramId, since preferences aren't
  // diagram-scoped anymore) and mutated through the SettingsDialog.
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  useEffect(() => {
    if (userPreferences.aiAssistanceEnabled) panelLayout.setAiPanelVisible(true);
  }, [userPreferences.aiAssistanceEnabled]);
  // Mirror the auto-rebind flag into its own ref so the drag move
  // handler can read it without re-attaching listeners. Defaults
  // to true (auto-rebind on) so a fresh session keeps today's UX.
  const autoRebindArrowsRef = useRef<boolean>(userPreferences.autoRebindArrows !== false);
  autoRebindArrowsRef.current = userPreferences.autoRebindArrows !== false;

  // Per-element note popover (state + open/close/setNote handlers)
  // lives in useEditorNotes. Invoked further down, after `commit`
  // exists.

  // Right-click context menu state. Tracks the cursor position + the
  // menu's mode (element-scoped vs tab-scoped) so the page can render
  // a single ContextMenu portal that swaps its items based on what
  // was clicked. Null = menu closed.
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);
  const closeContextMenu = () => setContextMenu(null);

  // Element link picker (open + anchor state) and the link read/write
  // handlers live in useElementLinks. Invoked further down, after
  // `openDiagram` + the selection helpers exist.

  // Every diagram in the local store. Used by the Explorer to render its
  // list. Refreshed on hydration and after we save the current diagram
  // (so the Explorer's "Your diagrams" section reflects renames + first
  // saves in real time).
  const [diagramList, setDiagramList] = useState<
    {
      id: string;
      name: string;
      folderId: string | null;
      savedAt: number;
      shareCode: string | null;
    }[]
  >([]);
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
  // True while the very first diagram-list fetch is in flight, so the
  // Explorer can render a skeleton instead of an empty "no diagrams"
  // state. We only flip this off — subsequent refreshes don't reset it
  // because they're triggered by saves and shouldn't blank the list.
  const [diagramListLoading, setDiagramListLoading] = useState(true);
  // Diagrams shared with the current owner. Surfaced in the
  // Explorer's "Shared with you" accordion. Fetched alongside the
  // owned-diagram list and refreshed when the owner opens a new
  // share link in this tab.
  const [sharedDiagrams, setSharedDiagrams] = useState<SharedWithItem[]>([]);
  // Per-diagram audit log surfaced in the Activity Panel. Newest first.
  // Hydrated from the API for existing diagrams; appended to on every
  // commit. See specs/12-activity-and-audit.md.
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [changeLogLoading, setChangeLogLoading] = useState(true);
  // Per-step Undo/Redo memory for the activity log. Each commit
  // pushes its entry onto `past`; undo pops it (deletes from the
  // panel) and moves it onto `future`; redo pops from `future` and
  // re-inserts. Kept in a ref because nothing renders from it and
  // we want a synchronous mutation alongside the matching API call.
  const entryHistoryRef = useRef<{ past: ChangeLogEntry[]; future: ChangeLogEntry[] }>({
    past: [],
    future: [],
  });
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
  // Diagram-list refresh, fired after every autosave so the
  // Explorer's "Updated X ago" timestamps stay fresh. Folders are
  // explicitly NOT refetched here — they only change via folder
  // mutations (create / rename / delete / move) which manage state
  // optimistically themselves. Pulling them every save spammed
  // /api/folders on every edit.
  const refreshDiagramList = (ownerId: string) => {
    const safety = window.setTimeout(
      () => setDiagramListLoading(false),
      DIAGRAM_LIST_LOAD_SAFETY_MS,
    );
    apiListDiagrams(ownerId)
      .then((list) => {
        window.clearTimeout(safety);
        setDiagramList(list);
        setDiagramListLoading(false);
      })
      .catch(() => {
        // Network glitch — the next save will retry. List staleness
        // for a beat is acceptable; we don't want a transient error
        // to wipe the rendered list. Drop the loading flag so the
        // Explorer doesn't spin forever on a dead network.
        window.clearTimeout(safety);
        setDiagramListLoading(false);
      });
    // Shared-with-you is deliberately NOT fetched here. The list
    // only changes when the user opens a NEW share URL (which
    // navigates the page → hydration picks it up) or when the
    // owner revokes shares (which the visitor won't see until
    // their next page load anyway). Fetching it on every
    // autosave-triggered refresh was burning a wasted GET
    // /api/shared per ~500ms of active editing.
  };
  // One-shot shared-list fetch, called from the hydration IIFE
  // alongside refreshDiagramList. Silent failure: the section
  // hides when empty so a network glitch just leaves the
  // accordion absent for this session.
  const refreshSharedList = (ownerId: string) => {
    apiListSharedWith(ownerId)
      .then((items) => setSharedDiagrams(items))
      .catch(() => {});
  };
  const dismissSharedDiagram = async (diagramId: string) => {
    const target = sharedDiagrams.find((d) => d.id === diagramId);
    const ok = await confirm({
      title: `Remove "${target?.name || 'this diagram'}" from your Shared list?`,
      message:
        "It'll vanish from your Shared with you list. You can still open it again from the share link the owner gave you, and that re-adds it here.",
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setSharedDiagrams((prev) => prev.filter((d) => d.id !== diagramId));
    void apiDismissSharedWith(selfParticipant.id, diagramId).catch(() => {});
  };
  // `remoteUpdateRef` blocks the auto-save effect from re-broadcasting
  // a remote update back through the room (which would cause an
  // infinite save/broadcast loop between two connected clients).
  const remoteUpdateRef = useRef(false);
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
  // Single open room connection for the current diagram. Re-opens
  // whenever diagramId changes.
  const roomRef = useRef<ReturnType<typeof connectRoom> | null>(null);
  // Persistent diagram id. `null` until the post-mount hydration step
  // runs; that step reads ?d=<id> from the URL (or mints a fresh id +
  // updates the URL) and pulls any saved tabs + name from localStorage.
  // Saves are gated on `hydrated` so we never overwrite stored data
  // with the empty initial render.
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Sharing state for the current diagram. Mirrors the API row's
  // `shareable` + `shareCode` columns; refreshed on hydration, and
  // after share / unshare. Drives whether realtime (WS room) is
  // active.
  const [diagramShareable, setDiagramShareable] = useState(false);
  // The legacy single share code (back-compat fallback for older
  // diagrams that haven't been migrated to share_links yet, and for
  // visitor arrivals that came in via the legacy URL flow). Modern
  // diagrams populate shareLinks instead.
  const [diagramShareCode, setDiagramShareCode] = useState<string | null>(null);
  // True for the owner of the loaded diagram; false for visitors who
  // arrived via /live/diagram/shared?s=<code>. Drives whether the
  // Share button shows.
  const [isOwner, setIsOwner] = useState(true);
  // The diagram's owner id (from the api fetch). Used to derive the
  // owner badge at the top of the canvas: when the owner is currently
  // in the room their full Participant row is in `livePresence` and we
  // can show avatar + name; otherwise the badge shows just the role
  // strip (Viewing / Editing) and skips the owner row entirely.
  const [diagramOwnerId, setDiagramOwnerId] = useState<string | null>(null);
  // Owner display info from the diagram fetch (api worker joins
  // participants on diagram.ownerId). Lets the top-middle Owner badge
  // render for visitors even when the owner isn't currently in the
  // realtime room — livePresence would otherwise be empty, and the
  // badge would hide.
  const [diagramOwnerName, setDiagramOwnerName] = useState<string | null>(null);
  const [diagramOwnerColor, setDiagramOwnerColor] = useState<string | null>(null);
  // Visitor-side "Make a copy" loading flag. Header button disables
  // itself while the api round-trips so a frantic double-click can't
  // produce two copies under the user's account.
  const [copying, setCopying] = useState(false);
  // Brief error string surfaced by the Import-tab flow when the
  // picked file is malformed or its schema is newer than this
  // editor understands. Rendered as a transient toast under the
  // header — auto-clears after 6 seconds so the user isn't stuck
  // looking at it, and gets cleared on the next import attempt.
  const [importError, setImportError] = useState<string | null>(null);

  // Load the per-user preferences (spec/20) once on mount. The
  // preferences are device-scoped, not diagram-scoped, so this runs
  // independently of which diagram is open. Missing or unparseable
  // entries collapse to `{}`; the per-flag default then depends on
  // the consumer's comparison: `autoRebindArrows` and
  // `telemetryEnabled` read via `!== false` so undefined = on (the
  // historical "everything on" default), while `drawToAdd` and
  // `recogniseShapes` read via `=== true` so undefined = off
  // (matches spec/20's "drop-at-centre" + "raw-sketch" defaults).
  useEffect(() => {
    setUserPreferences(readUserPreferences());
  }, []);

  // Server-side preferences sync (spec/20). Once the owner id
  // resolves (Clerk userId for signed-in users, the per-browser
  // participant id for guests), fetch the row from D1 and merge it
  // over the localStorage cache. Server wins for any key present on
  // both sides. The cache-only read above still fired first so the
  // UI never blocks on this network step; this just reconciles
  // toggles the user made on another device.
  useEffect(() => {
    const ownerId = selfParticipant?.id;
    if (!ownerId || ownerId === 'self') return;
    // Don't sync until the share-link password has been accepted — no
    // point fetching preferences for a visitor who hasn't got in yet.
    if (sharePasswordGate !== null) return;
    let cancelled = false;
    void fetchUserPreferences(ownerId).then((merged) => {
      if (cancelled || merged === null) return;
      setUserPreferences(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [selfParticipant?.id, sharePasswordGate]);

  useEffect(() => {
    if (!importError) return;
    const id = window.setTimeout(() => setImportError(null), 6000);
    return () => window.clearTimeout(id);
  }, [importError]);
  // Every active share link for the current diagram (owner-only). The
  // ShareDialog list renders straight off this array. shareable is
  // derived: shareLinks.length > 0 OR diagramShareable from a freshly
  // loaded row.
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  // The diagram's optional share password (spec/24), owner-only. Null
  // when unset. The ShareDialog shows + edits this in the clear.
  const [sharePassword, setSharePassword] = useState<string | null>(null);
  // `passwordRetry` bumps to re-run the bootstrap once the visitor
  // submits a password (see the bootstrap effect deps).
  const [passwordRetry, setPasswordRetry] = useState(0);
  // The role granted to the current session. Owners always have 'edit';
  // visitors get whatever role their share code carried. Drives the
  // save / op-broadcast gates so view-only visitors can't push edits.
  const [sessionRole, setSessionRole] = useState<ShareRole>('edit');
  const isReadOnly = sessionRole === 'view';
  // Visitors are admitted via a share code in the URL (?s=<code>).
  // Owners arrive via ?d=<id> with no share code. The log endpoints
  // accept the code as a fallback authorisation so edit visitors can
  // persist their own entries; null means "owner — owner check
  // suffices". Tracked separately from `diagramShareCode` (which is
  // the diagram's primary code surfaced for sharing) because a
  // diagram can have many active codes.
  const [sessionShareCode, setSessionShareCode] = useState<string | null>(null);
  // Mirror into a ref so the room-message handler (registered once
  // when the WebSocket opens) can read the LATEST value without
  // re-registering on every change. Specifically, the share-revoked
  // op handler checks "is the revoked code mine?" and needs the
  // up-to-date sessionShareCode rather than the value captured at
  // mount.
  const sessionShareCodeRef = useRef(sessionShareCode);
  sessionShareCodeRef.current = sessionShareCode;

  // The id of the tab we last auto-fit. Drives the "fit on tab load"
  // effect below — fits the first time we land on a tab (or on the
  // tab whose elements just finished lazy-loading) and stays out of
  // the way during subsequent element edits on the same tab.
  const lastFittedTabRef = useRef<string | null>(null);

  // Active tab → URL fragment (#t=<tabId>) so refreshes land on the
  // same tab. replaceState so tab switches don't pollute history.
  // Skipped pre-hydration to avoid writing a placeholder id.
  useEffect(() => {
    if (!hydrated || !activeId || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.hash === `#t=${activeId}`) return;
    url.hash = `t=${activeId}`;
    window.history.replaceState({}, '', url.toString());
  }, [hydrated, activeId]);

  // Per-tab autosave. The previous snapshot lives in a ref so we can
  // diff: any tab whose object reference changed since last save is
  // ours to PUT; tab order / diagram rename hit the metadata PUT.
  // Debounced 600ms — feels responsive without hammering the API.
  // Spec/13 has the design.
  const lastSavedTabsRef = useRef<Tab[]>([]);
  const lastSavedNameRef = useRef<string>('');

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
    remoteUpdateRef,
    roomRef,
    setSaveStatus,
    setSavedAt,
    setDiagramList,
  });

  // Surface a toast when an autosave fails (network / 5xx). The header
  // pill already shows the 'error' status, but a failed save risks lost
  // work — the kind of critical update that warrants the louder bottom-
  // centre toast too. Fires on the transition into 'error'; the toast
  // layer dedupes a streak of retries while one is still on screen.
  useEffect(() => {
    if (saveStatus === 'error') {
      toast.error('Couldn’t save your changes — check your connection.');
    }
  }, [saveStatus, toast]);

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
    selfParticipant,
    isOwner,
    sessionShareCode,
    lastSeenRef,
    selfParticipantRef,
    remoteUpdateRef,
    sessionShareCodeRef,
    roomRef,
    resetTabs,
    setLivePresence,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteTabFocus,
    setRemoteLaserTrails,
    setChangeLog,
    setDiagramName,
    setSelfParticipant,
  });

  // Broadcast local selection changes so peers can render "Tom is
  // working on this element" indicators. Fires whenever `selectedId`
  // changes (including to null). Skipped before the room is open or
  // before hydration; peers learn the initial selection state via
  // their own `select` ops when they happen, not from a snapshot.
  useEffect(() => {
    if (!hydrated || !diagramId || !diagramShareable) return;
    roomRef.current?.send({ kind: 'op', op: { kind: 'select', elementId: selectedId } });
  }, [hydrated, diagramId, diagramShareable, selectedId]);

  // Broadcast the currently active tab so peers can show our avatar
  // on the TabBar entry we're focused on. Fires both on initial room
  // connect (when the dependencies first satisfy) and on every local
  // tab switch.
  useEffect(() => {
    if (!hydrated || !diagramId || !diagramShareable) return;
    roomRef.current?.send({ kind: 'op', op: { kind: 'tab-focus', tabId: activeId } });
  }, [hydrated, diagramId, diagramShareable, activeId]);

  // Lazy fetch the active tab's full payload on first open. See usePerTabLoad.
  usePerTabLoad({
    hydrated,
    diagramId,
    activeId,
    selfId: selfParticipant.id,
    sessionShareCode,
    loadedTabIdsRef,
    setLoadedTabIds,
    remoteUpdateRef,
    resetTabs,
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
    activeId,
    canvasTool,
  });
  // Viewport state (pan offset, zoom, the canvas wrapper ref the
  // measurements read through, and a parallel zoomRef the drag hook
  // reads each pointer-move) lives in useEditorViewport. The hook
  // is invoked further down, once `activeTab` is in scope; it
  // also owns `getViewportCenter` and `fitToScreen`.

  // Latest tabs mirrored to a ref so timer-driven callbacks (e.g.
  // the opacity debounce below) can read the post-debounce state
  // rather than whatever was in scope when the timer was scheduled.
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  // Same trick for selfParticipant — the WS effect intentionally
  // omits selfParticipant from its dep list (re-opening the socket
  // on every name/colour change would be wasteful), so the
  // presence callback would otherwise close over a stale value
  // when reconciling unique colours.

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;

  const {
    viewportOffset,
    setViewportOffset,
    viewportZoom,
    setViewportZoom,
    zoomRef,
    canvasMainRef,
    getViewportCenter,
    fitToScreen,
  } = useEditorViewport({ activeTab });

  // Server capabilities (spec/25). Fetched once at mount; determines
  // whether the AI panel option is shown in Settings and rendered.
  const { aiEnabled: aiCapable } = useCapabilities(sharePasswordGate === null);

  // Pinch-to-zoom on touch screens + trackpad pinch (Ctrl+wheel).
  const { isPinchingRef } = useCanvasPinchZoom({
    canvasMainRef,
    viewportZoom,
    setViewportZoom,
    viewportOffset,
    setViewportOffset,
  });

  // Fit-to-screen on every tab load. Fires when:
  //   - the page hydrates and lands on the first tab
  //   - the user switches to a different tab
  //   - the active tab's elements just finished lazy-loading (the
  //     previous frame fired on an empty tab and bailed)
  // The `lastFittedTabRef` gate means subsequent element edits on
  // the same tab DON'T re-fit (so the user's pan / zoom isn't
  // resnapped every time they add a shape).
  useEffect(() => {
    if (!hydrated) return;
    if (activeTab.elements.length === 0) return;
    if (lastFittedTabRef.current === activeId) return;
    lastFittedTabRef.current = activeId;
    // Defer to the next frame so the canvas wrapper has its final
    // measured size before fitToScreen reads getBoundingClientRect.
    const handle = window.requestAnimationFrame(() => fitToScreen());
    return () => window.cancelAnimationFrame(handle);
    // fitToScreen reads live state via closure; we deliberately only
    // re-evaluate on hydration / tab-id / element-count transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, activeId, activeTab.elements.length]);

  // Per-element remote-selection map. Looks up each participant id
  // against the current `livePresence` so we can render their colour +
  // initials without bringing the participant blob along in every
  // `select` op. Self is filtered out — we don't need a "you're here"
  // badge on top of our own selection ring.
  const livePresenceById = useMemo(
    () => new Map(livePresence.map((p) => [p.id, p] as const)),
    [livePresence],
  );
  // Group participants by the tab they're currently focused on, so
  // each TabBar entry can render the right avatar dots. Always
  // includes the local participant on their active tab — that way
  // the feature is visible even for solo / unshared sessions, and
  // remote peers see their own dot pop onto the tab they switch to
  // before any pointer movement. Remote entries come from the
  // tab-focus RoomOp; only those whose sender is still present
  // (livePresence has them) survive.
  //
  // Status is per-viewer: a participant on the viewer's active tab
  // is 'online' (green ring), a participant on any other tab is
  // 'away' (orange ring). Cheap signal that someone's not where you
  // are right now without leaving the TabBar.
  const participantsByTab = buildParticipantsByTab({
    diagramShareable,
    activeId,
    selfParticipant,
    tabs,
    remoteTabFocus,
    livePresence,
    livePresenceById,
    lastSeen: lastSeenRef.current,
    now: Date.now(),
  });
  // Cursor rows joined with presence so we get a fresh colour + name on
  // every render and don't have to denormalise them into each `cursor`
  // op payload. Filter to the active tab so cursors of teammates
  // looking at a different tab don't bleed onto this one.
  const remoteCursorRows = useMemo(
    () => buildRemoteCursorRows(remoteCursors, livePresenceById, selfParticipant.id, activeId),
    [remoteCursors, livePresenceById, selfParticipant.id, activeId],
  );
  // Laser trails for the LaserOverlay — local first, then any peers
  // whose latest sample is on the active tab and whose participant
  // entry is still live. The overlay handles fade + cleanup; we just
  // assemble per-tab visibility here.
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

  const laserTrailRows = useMemo(
    () =>
      buildLaserTrailRows({
        localLaserTrail,
        remoteLaserTrails,
        livePresenceById,
        selfId: selfParticipant.id,
        selfColor: selfParticipant.color,
        activeId,
      }),
    [
      localLaserTrail,
      remoteLaserTrails,
      livePresenceById,
      selfParticipant.id,
      selfParticipant.color,
      activeId,
    ],
  );
  const remoteSelectionsByElement = useMemo(
    () => buildRemoteSelectionsByElement(remoteSelections, livePresenceById, selfParticipant.id),
    [remoteSelections, livePresenceById, selfParticipant.id],
  );
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
  // Join screen for visitors landing on an existing diagram who haven't
  // confirmed their identity yet. Same chrome-hide rule as the old
  // welcome modal — focus the user on the name input before they
  // start editing.
  const joinScreenOpen =
    hydrated && loadedExistingDiagram && !nameConfirmed && templatePickerMode === 'identity';
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
  const { emitChange, emitTabMeta } = useActivityLogEmitter({
    diagramId,
    selfParticipant,
    setChangeLog,
    entryHistoryRef,
    sessionShareCode,
    roomRef,
  });

  // A locked tab refuses every element mutation. Commit /
  // tick / element-add helpers all consult this early-return guard
  // so a single check covers drag, edit, paint, delete, etc.
  const activeTabLocked = activeTab.locked === true;
  // A view-only session (a 'view' share role) is read-only in exactly
  // the same way a locked tab is: no element or tab mutation may land.
  // Folding both flags into one guard means every mutation helper
  // below stays blocked with a single check, and the interaction
  // starters (beginDrag, beginEdit, ...) layer on their own isReadOnly
  // checks so a viewer can still select and inspect.
  const editsBlocked = activeTabLocked || isReadOnly;

  const commit = (mapElements: (els: Element[]) => Element[]) => {
    if (editsBlocked) return;
    const before = activeTab.elements;
    const after = mapElements(before);
    commitTabs((ts) => patchTab(ts, activeId, { elements: after }));
    emitChange(activeId, before, after);
  };

  // Apply AI-returned elements as a single undo block (spec/25).
  // Generate handles both modifications and additions in one pass:
  //   - Elements whose ID matches an existing element → replace in place
  //   - Elements with a new ID → append; deduplicate if the AI reused a
  //     short ID (e.g. "ai-001") from a previous generation, remapping
  //     arrow endpoints to keep connections intact.
  // Clean always gets the full element list back so it replaces everything.
  const applyAiElements = (elements: Element[], mode: 'generate' | 'clean') => {
    commit((existingEls) => {
      const existingById = new Map(existingEls.map((e) => [e.id, e]));

      // Partition: which returned elements modify existing ones vs add new.
      const modifications = elements.filter((e) => existingById.has(e.id));
      const additions = elements.filter((e) => !existingById.has(e.id));

      // Deduplicate addition IDs that clash with each other or with
      // existing elements (the AI reuses short IDs like "ai-001").
      const allIds = new Set(existingEls.map((e) => e.id));
      const idMap = new Map<string, string>();
      for (const el of additions) {
        if (allIds.has(el.id)) {
          idMap.set(el.id, crypto.randomUUID());
        } else {
          allIds.add(el.id);
        }
      }
      const deduped: Element[] = additions.map((el) => {
        const newId = idMap.get(el.id) ?? el.id;
        if (el.type === 'arrow') {
          const from =
            el.from.kind === 'pinned' && idMap.has(el.from.elementId)
              ? { ...el.from, elementId: idMap.get(el.from.elementId)! }
              : el.from;
          const to =
            el.to.kind === 'pinned' && idMap.has(el.to.elementId)
              ? { ...el.to, elementId: idMap.get(el.to.elementId)! }
              : el.to;
          return { ...el, id: newId, from, to };
        }
        return { ...el, id: newId };
      });

      if (mode === 'clean') {
        // Clean returns ALL elements. Merge AI changes onto existing elements
        // so properties the AI never sees (fillColor, strokeColor, textColor,
        // images, etc.) are preserved rather than silently wiped.
        const modById = new Map(modifications.map((e) => [e.id, e]));
        return autoAlignElements([
          ...existingEls.map((el) =>
            modById.has(el.id) ? ({ ...el, ...(modById.get(el.id) as Element) } as Element) : el,
          ),
          ...deduped,
        ]);
      }

      // Generate: apply modifications in place, append new elements.
      const modById = new Map(modifications.map((e) => [e.id, e]));
      return autoAlignElements([
        ...existingEls.map((el) => (modById.has(el.id) ? (modById.get(el.id) as Element) : el)),
        ...deduped,
      ]);
    });
  };

  // Click handler for Activity rows (Revert has its own button that
  // stops propagation). Element-related entries select the affected
  // element on the right tab; tab-meta entries pop the matching
  // accordion in the Editor panel so the user can see what changed
  // and tweak it again.
  // Activity log + undo/redo handlers. See useEditorHistory.
  const { handleActivityRowClick, clearActivityForActiveTab, revertChange, tick, undo, redo } =
    useEditorHistory({
      activeId,
      diagramId,
      selfId: selfParticipant.id,
      sessionShareCode,
      tabs,
      editsBlocked,
      canUndo,
      canRedo,
      requestEditorOpen: panelLayout.requestEditorOpen,
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
        setTabAccordionsOpen,
        setChangeLog,
        setFormatSourceId,
        setGroupSourceId,
      },
    });
  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  // Selection + placement + format/group helpers. See useElementHelpers.
  const {
    addBoxed,
    memberIdsOf,
    currentSelectionIds,
    selectionPrimary,
    exitFormatPainter,
    exitGroupMode,
    applyFormatFromSource,
    completeGrouping,
  } = useElementHelpers({
    selectedId,
    activeId,
    activeTab,
    editsBlocked,
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
    importTabFromFile,
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

  // Diagram-level lifecycle + navigation (delete / duplicate /
  // move-to-folder / delete-folder, and the new / open / make-a-copy
  // full-page-load helpers). Operates on whole diagrams + the Explorer
  // list, distinct from per-tab lifecycle in useTabActions. See
  // useDiagramActions.
  const {
    deleteDiagram,
    deleteFolder,
    moveDiagramToFolder,
    duplicateDiagram,
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

  // Share-dialog actions (create / revoke link, build the visitor URL,
  // save the participant name). The share-link list + shareable flags
  // stay as page state since the hydration / save effects also write
  // them; the hook reconciles via the setters. See useShareLinks.
  const {
    updateParticipantName,
    createShareLink,
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

  // Open one of the Tab section accordions inside the Editor panel,
  // popping the panel back if it was minimised. Both context-menu
  // actions ("Change Theme", "Change Canvas") route here rather than
  const openTabAccordion = (which: 'theme' | 'canvas') => {
    panelLayout.requestEditorOpen();
    setTabAccordionsOpen({
      theme: which === 'theme',
      canvas: which === 'canvas',
      cleanup: false,
    });
  };

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
    setBackgroundPattern,
    setTheme,
    resetElementsToTheme,
    setBackgroundColor,
    setBackgroundOpacity,
    setPatternColor,
  } = useTabCanvas({
    editsBlocked,
    activeId,
    activeTab,
    commit,
    commitTabs,
    emitTabMeta,
    scheduleTabMetaLog,
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
  const {
    pendingDraw,
    beginDrawIfEnabled,
    commitDraw,
    cancelDrawShape,
    beginFreehand,
    commitFreehand,
  } = useShapeDrawing({
    drawToAdd: userPreferences.drawToAdd === true,
    editsBlocked,
    canvasTool,
    setCanvasTool,
    activeTab,
    activeId,
    commit,
    commitTabs,
    patchTab,
    emitChange,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    openImagePickerFor,
    zoomRef,
  });

  // Palette element-creation handlers. See useElementCreation.
  const { addShape, addIcon, addTable, addText, addSticky, addArrow, handleCanvasDoubleClick } =
    useElementCreation({
      editsBlocked,
      activeId,
      activeTab,
      getViewportCenter,
      commitTabs,
      emitChange,
      setSelectedId,
      setEditingId,
      addBoxed,
      beginDrawIfEnabled,
    });

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
    duplicateSelected,
    duplicateConnectSelected,
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
    toggleTextStyleSelected,
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setOpacitySelected,
    setPaddingSelected,
    setArrowEndsSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setArrowStyleSelected,
    setArrowStrokeStyleSelected,
    setShapeKindSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setBorderRadiusSelected,
    resetColorsSelected,
  } = useElementStyle({
    currentSelectionIds,
    selectionPrimary,
    selectedId,
    activeTab,
    activeId,
    editsBlocked,
    commit,
    commitTabs,
    scheduleElementChangeLog,
  });

  // Element link picker state + the link read/write/follow handlers.
  // See useElementLinks.
  const {
    linkPickerOpenForId,
    setLinkPickerOpenForId,
    linkPickerAnchorEl,
    setLinkSelected,
    setDiagramLinkSelected,
    clearLinkSelected,
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
    commitCells,
    cancelEdit,
    typeIntoSelected,
    selectElement,
    toggleInMultiSelect,
  } = useSelectionEditing({
    selectedId,
    isReadOnly,
    formatSourceId,
    groupSourceId,
    multiSelectedIds,
    diagramName,
    tabs,
    activeTab,
    commit,
    commitTabs,
    applyFormatFromSource,
    set: {
      setFormatSourceId,
      setGroupSourceId,
      setSelectedId,
      setEditingId,
      setMultiSelectedIds,
      setDiagramName,
    },
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
    beginDrag,
    beginRotate,
    beginAnchorDrag,
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowElbowDrag,
  } = useEditorDrag({
    activeTab,
    zoomRef,
    selectedId,
    setSelectedId,
    multiSelectedIds,
    editingId,
    isReadOnly,
    formatSourceId,
    applyFormatFromSource,
    groupSourceId,
    completeGrouping,
    tick,
    commit,
    markCheckpoint,
    autoRebindArrowsRef,
    isPinchingRef,
  });

  // Copy / paste (in-app element clipboard + OS-clipboard image
  // paste). `copySelection` feeds the keyboard hook below; paste is
  // driven by a native `paste` listener the hook owns. See
  // useClipboard.
  const { copySelection } = useClipboard({
    isReadOnly,
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
    toast,
  });

  // Global keyboard shortcuts (Escape cancels modes, Delete /
  // Backspace wipes selection, Cmd-Z / Cmd-Shift-Z undo / redo,
  // Cmd-C / Cmd-V copy / paste, V / H / L canvas-tool switch).
  // Lives in useEditorKeyboardShortcuts.
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
    setCanvasTool,
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
      const allIds = new Set(activeTab.elements.map((el) => el.id));
      if (allIds.size === 0) return;
      setSelectedId(null);
      setMultiSelectedIds(allIds);
    },
    onZoomIn: () => setViewportZoom((z) => Math.min(5, Math.round((z + 0.1) * 10) / 10)),
    onZoomOut: () => setViewportZoom((z) => Math.max(0.1, Math.round((z - 0.1) * 10) / 10)),
    onZoomReset: () => setViewportZoom(1),
    enabled: shortcutsEnabled,
  });

  return {
    ...panelLayout,
    ...dialogs,
    activeId,
    activeTab,
    activeTabLocked,
    addArrow,
    addComment,
    addIcon,
    addImage,
    addImageFromGallery,
    addShape,
    addSticky,
    addTable,
    addTab,
    addText,
    aiCapable,
    anyWelcomeOpen,
    applyAiElements,
    applyImageToElement,
    autoAlignTab,
    beginAnchorDrag,
    beginArrowCurveDrag,
    beginArrowElbowDrag,
    beginArrowTranslate,
    beginDrag,
    beginEdit,
    beginEndpointDrag,
    beginFormatPainter,
    beginFreehand,
    beginGroup,
    beginRotate,
    bringSelectedToFront,
    broadcastCursor,
    broadcastLaser,
    canRedo,
    canUndo,
    cancelDrawShape,
    cancelEdit,
    canvasMainRef,
    canvasTool,
    changeLog,
    changeLogLoading,
    chooseTemplate,
    clearActivityForActiveTab,
    clearLinkSelected,
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
    commitCells,
    contextMenu,
    copying,
    createFolder,
    createShareLink,
    deleteComment,
    deleteDiagram,
    deleteFolder,
    deleteMultiSelected,
    deleteSelected,
    deleteTab,
    diagramId,
    diagramList,
    diagramListLoading,
    diagramName,
    diagramNotFound,
    loadError,
    diagramOwnerColor,
    diagramOwnerId,
    diagramOwnerName,
    diagramShareable,
    dismissSharedDiagram,
    duplicateConnectSelected,
    duplicateDiagram,
    duplicateMultiSelected,
    duplicateSelected,
    duplicateTab,
    editingId,
    effectiveTemplatePickerMode,
    exitFormatPainter,
    exitGroupMode,
    fitToScreen,
    folders,
    followLink,
    formatSourceId,
    groupMultiSelected,
    groupSourceId,
    handleActivityRowClick,
    handleCanvasDoubleClick,
    hydrated,
    identityOnlyScreenOpen,
    imageContext,
    imagePickerOpenFor,
    importError,
    importTabFromFile,
    isOwner,
    isPinchingRef,
    isReadOnly,
    laserTrailRows,
    linkActiveTabTo,
    linkPickerAnchorEl,
    linkPickerOpenForId,
    livePresence,
    loadedTabIds,
    loadingDiagram,
    makeCopy,
    moveDiagramToFolder,
    multiSelectedIds,
    nameConfirmed,
    newDiagram,
    noteOpenId,
    openComments,
    openDiagram,
    openNote,
    openTabAccordion,
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
    reorderTabs,
    resetColorsSelected,
    resetElementsToTheme,
    resolveThread,
    revertChange,
    revokeShareLink,
    saveStatus,
    savedAt,
    selectElement,
    selectMarquee,
    selectedId,
    selfParticipant,
    sendSelectedToBack,
    sessionRole,
    sessionShareCode,
    setActiveId,
    setArrowEndsSelected,
    setArrowStrokeStyleSelected,
    setArrowStyleSelected,
    setArrowThicknessSelected,
    setArrowheadSizeSelected,
    setArrowheadShapeSelected,
    setBackgroundColor,
    setBackgroundOpacity,
    setBackgroundPattern,
    setBorderRadiusSelected,
    setBorderStrokeSelected,
    setBorderStyleSelected,
    setCanvasTool,
    setContextMenu,
    setDiagramLinkSelected,
    setDiagramName,
    setDiagramSharePassword,
    setEditingId,
    setFillColorSelected,
    setFormatSourceId,
    setGroupSourceId,
    setLinkPickerOpenForId,
    setLinkSelected,
    setLoadingDiagram,
    setMultiSelectedIds,
    setNote,
    setOpacitySelected,
    setPaddingSelected,
    setPasswordRetry,
    setPatternColor,
    setSelectedId,
    setShapeKindSelected,
    setSharePasswordGate,
    setShortcutsEnabled,
    setStrokeColorSelected,
    setTabAccordionsOpen,
    setTextAlignSelected,
    setTextColorSelected,
    setTextSizeSelected,
    setTheme,
    setUserPreferences,
    setViewportOffset,
    setViewportZoom,
    shareLinks,
    sharePassword,
    sharePasswordGate,
    shareUrlFor,
    sharedDiagrams,
    shortcutsEnabled,
    skipTemplatePicker,
    tabAccordionsOpen,
    tabs,
    toggleActiveTabLock,
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
