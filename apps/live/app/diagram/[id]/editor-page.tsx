'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createShape,
  createSticky,
  createText,
  isBoxed,
  joinGroups,
  selectionMembers,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type ShapeKind,
  type Tab,
} from '@livediagram/diagram';
import dynamic from 'next/dynamic';
import { Canvas } from '@/components/Canvas';
import { type EditorContextMenuState } from '@/components/EditorContextMenu';
// Lazy-load EditorContextMenu: the right-click menu only renders
// while `contextMenu` is non-null, so the menu's render tree + its
// icon set never need to ship in the editor's initial chunk. Same
// gate pattern as TabLinkPicker, ShortcutsDialog, etc. Visitors
// (view-role) skip it entirely because the parent already gates on
// `!isReadOnly`.
const EditorContextMenu = dynamic(() =>
  import('@/components/EditorContextMenu').then((m) => m.EditorContextMenu),
);
// Lazy-load TabLinkPicker: only mounts when `linkPickerOpenForId`
// is set (the user clicked the link icon on a selected element).
// Most sessions never open it. Same lazy pattern as the dialogs
// below, the picker's tab-grid + diagram-grid stays out of the
// initial chunk.
const TabLinkPicker = dynamic(() =>
  import('@/components/TabLinkPicker').then((m) => m.TabLinkPicker),
);
// Lazy-load CommentThreadPopover for the same reason as
// ExportTabDialog / ShareDialog: it's gated on commentThreadOpenId
// (right-click an element, pick Comments), most sessions never
// open it, and the 305-line popover + its emoji / mention helpers
// don't belong in the editor's initial chunk.
const CommentThreadPopover = dynamic(() =>
  import('@/components/CommentThreadPopover').then((m) => m.CommentThreadPopover),
);
import { DiagramLoading } from '@/components/DiagramLoading';
import { EditorHeader, type SaveStatus } from '@/components/EditorHeader';

// Lazy-load ExportTabDialog: it pulls in lib/export-tab's canvas
// + PDF renderers (a measurable chunk of bytes), all of which only
// matter the moment the user actually clicks Export. The dialog
// is already gated on `exportOpen`, so swapping the static import
// for next/dynamic doesn't change any render code, just hoists the
// underlying module into its own chunk that loads on demand.
const ExportTabDialog = dynamic(() =>
  import('@/components/ExportTabDialog').then((m) => m.ExportTabDialog),
);
import { Explorer } from '@/components/Explorer';
// Lazy-load NotFound: the diagram-404 surface only renders when the
// `diagramNotFound` state flips true, which happens on (a) a guest
// id with no diagrams at that slug, (b) a revoked share code, or
// (c) a bad URL. Every successful editor load (the overwhelming
// majority) renders the canvas + editor chrome and never touches
// NotFound, so eagerly shipping its 69 lines was paying for the
// rare-path branch on every common-path load. Same lazy pattern
// as the dialogs below.
const NotFound = dynamic(() => import('@/components/NotFound').then((m) => m.NotFound));
// Lazy-load SharePasswordGate: only a visitor opening a password-
// protected diagram's share link ever sees it (spec/24).
const SharePasswordGate = dynamic(() =>
  import('@/components/SharePasswordGate').then((m) => m.SharePasswordGate),
);
// Lazy-load ShareDialog for the same reason as ExportTabDialog: it
// mounts only when the user clicks Share, and most sessions never
// open it. Hoisting it into its own chunk means the editor's initial
// bundle doesn't ship the dialog's 382 lines + its share-link
// helpers up front.
const ShareDialog = dynamic(() => import('@/components/ShareDialog').then((m) => m.ShareDialog));
// Lazy-load NotePopover: only mounts when `noteOpenId !== null`,
// which the user only triggers by right-clicking an element and
// picking "Add note" / "Edit note". Same pattern as the dialogs
// above so the editor's initial chunk doesn't ship the popover's
// auto-resize textarea + close-on-escape wiring up front.
const NotePopover = dynamic(() => import('@/components/NotePopover').then((m) => m.NotePopover));
// Lazy-load SearchPanel for the same reason as the other modals
// (ExportTabDialog / ShareDialog / TemplatePicker / CommentThread
// Popover): it's gated on `searchOpen`, which only flips true when
// the user clicks the footer Search button. Most editor sessions
// never open it. The fetch latency on first open is well under
// 100 ms on a warm Next chunk fetch, and the panel is animated in
// (animate-fly-up-in) so the small gap reads as the entrance, not
// a stall.
const SearchPanel = dynamic(() => import('@/components/SearchPanel').then((m) => m.SearchPanel));
// Lazy-load ImagePicker: heavy modal that's only mounted while the
// user is actively choosing an image. Same lazy pattern as the other
// modals (ShareDialog, ExportTabDialog, SearchPanel) so the editor's
// initial chunk doesn't ship the picker's gallery grid + upload
// drop-zone until the moment they're needed.
const ImagePicker = dynamic(() => import('@/components/ImagePicker').then((m) => m.ImagePicker));
// Lazy-load ShortcutsDialog for the same reason as ExportTabDialog
// and ShareDialog: it mounts only when the user clicks the
// keyboard-shortcut button in the footer, and most editor sessions
// never open it. Hoisting the 138-line dialog plus its full
// shortcut table into its own chunk means the editor's initial
// bundle doesn't ship them up front.
const ShortcutsDialog = dynamic(() =>
  import('@/components/ShortcutsDialog').then((m) => m.ShortcutsDialog),
);
// Lazy-load SettingsDialog: opens only when the user clicks the
// footer gear (spec/20). Same lazy pattern as the other modals.
const SettingsDialog = dynamic(() =>
  import('@/components/SettingsDialog').then((m) => m.SettingsDialog),
);
import { TabBar } from '@/components/TabBar';
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import { useClipboard } from '@/hooks/useClipboard';
import { useDiagramActions } from '@/hooks/useDiagramActions';
import { HISTORY_LIMIT, useDiagramHistory } from '@/hooks/useDiagramHistory';
import { useNudgeSelection } from '@/hooks/useNudgeSelection';
import { trimLaserBuffer, type LaserPoint } from '@/lib/laser-buffer';
import { useFolders } from '@/hooks/useFolders';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import {
  readUserPreferences,
  fetchUserPreferences,
  writeUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';
import { track, titleCaseType } from '@/lib/telemetry';
import { paintableArrowFields, paintableBoxedFields } from '@/lib/format-painter';
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
import {
  nextFreeColor,
  randomColor,
  randomName,
  statusFromIdleMs,
  type Participant,
} from '@/lib/identity';
import { ensureGuestSelfId, hasConfirmedName, markNameConfirmed } from '@/lib/local-identity';
import {
  apiAppendChangeLogEntry,
  apiDeleteChangeLogEntry,
  apiDeleteChangeLogForTab,
  apiDeleteTab,
  apiListChangeLog,
  apiDismissSharedWith,
  apiListDiagrams,
  apiListSharedWith,
  apiListShareLinks,
  apiLoadDiagram,
  apiLoadSelf,
  apiLoadShared,
  apiLoadTab,
  apiSaveDiagramMeta,
  apiSaveSelf,
  apiAddComment,
  apiSaveTab,
  connectRoom,
  getSessionSharePassword,
  readCachedSharePassword,
  setSessionSharePassword,
  writeCachedSharePassword,
  type ChangeLogEntry,
  type RoomHandlers,
  type ShareLink,
  type ShareRole,
  type SharedWithItem,
} from '@/lib/api-client';
import { applyRevert } from '@/lib/change-log';
import { commentRowsFromElements } from '@/components/CommentsPanel';
import { templateCanvasOverrides, type TemplateKind } from '@/lib/templates';
import {
  deriveNewBoxedColours,
  getTheme,
  recolourElementForTheme,
  THEMES,
  type ThemeId,
} from '@/lib/themes';

function createTab(name: string): Tab {
  return { id: crypto.randomUUID(), name, elements: [] };
}

// Build the lazy-load placeholder tabs from a diagram's tab summaries.
// A diagram should always carry at least one tab; if the API ever
// returns zero summaries (a partial delete, a seeding bug, or a race
// that stripped the last tab) we materialise a fresh Tab 1 rather than
// leaving `tabs` empty. An empty tabs array makes `activeTab` (which
// falls back to `tabs[0]`) undefined, and the editor crashes on the
// first `activeTab.elements` read. The seeded tab autosaves back to the
// API on the next save cycle, healing the diagram.
function placeholdersFromSummaries(summaries: { id: string; name: string }[]): Tab[] {
  if (summaries.length === 0) return [createTab('Tab 1')];
  return summaries.map((summary) => ({ id: summary.id, name: summary.name, elements: [] }));
}

// Patch one tab in a Tab[] by id, spreading `patch` over its fields.
// Tabs whose id doesn't match are returned by reference, so callers
// that diff by-identity (notably the autosave's `prevTabById !== t`
// check) still skip the unchanged ones. Replaces every inline
// `ts.map((t) => (t.id === ... ? { ...t, ... } : t))` site whose
// patch is a static Partial<Tab>. Two sites that build their patch
// from the prior tab's elements (mapElements / [...t.elements, el])
// stay inline since the static-patch shape doesn't fit them.
function patchTab(ts: Tab[], id: string, patch: Partial<Tab>): Tab[] {
  return ts.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

// Activity-log past/future stacks share the cap with the
// state-snapshot stack: we can't undo past what useDiagramHistory
// remembers, so there's no point in tracking more log entries than
// that. Imported from the hook directly so the two stacks can't
// drift (was a literal mirror of `3` here, which is the kind of
// duplication a future HISTORY_LIMIT bump would silently break).

export default function LivePage() {
  const initialTabs: Tab[] = [createTab('Tab 1')];

  // Clerk wiring (token provider + guest→authed migration). One hook
  // does both — see `hooks/useClerkApiBootstrap.ts`. The values it
  // returns are the same ones `useAuth()` would; we read them via the
  // hook so the page has one source of truth.
  const { authLoaded, isSignedIn, clerkUserId, clerkDisplayName } = useClerkApiBootstrap();

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
  const [palettePosition, setPalettePosition] = useState<{ x: number; y: number } | null>(null);
  const [explorerPosition, setExplorerPosition] = useState<{ x: number; y: number } | null>(null);
  // Editor / Context panel (Selected Element + Current Tab). Sits
  // under the Palette by default.
  const [contextPosition, setContextPosition] = useState<{ x: number; y: number } | null>(null);
  // Counter bumped whenever an external action wants the Editor banner
  // expanded (Activity row navigation, tab-context-menu Change Theme /
  // Canvas). MovablePanel watches this and resets its local collapsed
  // state to false on each change, so navigation always lands on a
  // visible accordion. See the spec/09 "Collapse to banner" section.
  const [editorExpandSignal, setEditorExpandSignal] = useState(0);
  const requestEditorOpen = () => setEditorExpandSignal((n) => n + 1);
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

  // Global search panel state. Triggered from a footer button;
  // searches the user's diagram + folder list always, and (when
  // open inside a diagram) the current diagram's tabs + elements.
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard-shortcut catalog modal + per-device disable toggle.
  // The toggle gates EVERY shortcut in useEditorKeyboardShortcuts
  // below; the modal opens from a button in the TabBar.
  const { enabled: shortcutsEnabled, setEnabled: setShortcutsEnabled } = useShortcutsEnabled();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Per-user editor preferences (spec/20). One localStorage key,
  // applies to every diagram the user opens from this device. Loaded
  // on mount (not gated on diagramId, since preferences aren't
  // diagram-scoped anymore) and mutated through the SettingsDialog.
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    { id: string; name: string; folderId: string | null; savedAt: number }[]
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
  const [activityPosition, setActivityPosition] = useState<{ x: number; y: number } | null>(null);
  // Comments panel position. The panel itself is only mounted when
  // the active tab has at least one element carrying a thread,
  // computed below via commentRowsFromElements.
  const [commentsPanelPosition, setCommentsPanelPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // Activity defaults to minimised: most users only want to peek at
  // it occasionally. The dock button stays visible so it's one click
  // to open.
  const [activityMinimized, setActivityMinimized] = useState(true);
  // Live presence: the participants connected to this diagram's
  // Durable Object room right now. Includes ourselves once our `hello`
  // round-trips. Rendered in the editor header avatar stack.
  const [livePresence, setLivePresence] = useState<Participant[]>([]);
  // Wall-clock timestamp of each peer's last observed interaction.
  // Seeded on presence arrival; bumped on every incoming op from
  // that peer (cursor / selection / tab op). Drives the
  // online/away/offline derivation + the "Active X ago" tooltip.
  // Lives in a ref because the bump-on-op needs to be O(1) and we
  // don't want to re-render the whole tree on every cursor packet
  // just to update an idle timestamp.
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  // Re-derive presence statuses on a 30s tick. Without this, a peer
  // who fell idle would keep showing "online" until something else
  // re-rendered the editor.
  const [, setIdleTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIdleTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  // Which tab each remote participant is currently looking at. Driven
  // by the room's 'tab-focus' op; updated on every active-tab change
  // and on initial room connect. Used to render avatar dots on the
  // matching TabBar entries so collaborators can see at a glance
  // where everyone is working.
  const [remoteTabFocus, setRemoteTabFocus] = useState<Map<string, string>>(new Map());
  // Per-participant selection: which element each remote participant
  // currently has focused (null means deselected). Cleared for any
  // participant who drops out of presence. Drives the on-element badges
  // in BoxedElementView so users can see in real time what others are
  // working on.
  const [remoteSelections, setRemoteSelections] = useState<Map<string, string | null>>(new Map());
  // Live cursor positions for every remote participant. Stored in
  // canvas-coords (pre-transform) so they pan / zoom correctly with
  // the canvas. `null` cursor means the participant moved off the
  // canvas surface; we keep the entry around (vs deleting) so the
  // last-seen position can still inform analytics later if needed.
  const [remoteCursors, setRemoteCursors] = useState<
    Map<string, { tabId: string; x: number; y: number } | null>
  >(new Map());
  // Per-participant laser-pointer trails, keyed by participant id.
  // Each entry is a buffer of recent points; the LaserOverlay filters
  // them by age and renders the fading line. Trail buffers are
  // bounded both by time (LIFETIME_MS in the overlay) and by a hard
  // cap of 60 points in the receive handler so a flood can't grow the
  // buffer without bound. Scoped per tab in the op itself.
  const [remoteLaserTrails, setRemoteLaserTrails] = useState<
    Map<string, { tabId: string; points: LaserPoint[] }>
  >(new Map());
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
    const safety = window.setTimeout(() => setDiagramListLoading(false), 10000);
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
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  // Visitor-side "Make a copy" loading flag. Header button disables
  // itself while the api round-trips so a frantic double-click can't
  // produce two copies under the user's account.
  const [copying, setCopying] = useState(false);
  // Export-tab overlay (item #10). Open / closed only; the picker
  // surface lives in components/ExportTabDialog.
  const [exportOpen, setExportOpen] = useState(false);
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
    if (!ownerId) return;
    let cancelled = false;
    void fetchUserPreferences(ownerId).then((merged) => {
      if (cancelled || merged === null) return;
      setUserPreferences(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [selfParticipant?.id]);

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
  // Viewer-side password gate. Non-null when the visitor's share URL
  // points at a password-protected diagram and they haven't supplied a
  // valid password yet; `invalid` flags a wrong attempt so the gate
  // shows an error. `passwordRetry` bumps to re-run the bootstrap once
  // the visitor submits a password (see the bootstrap effect deps).
  const [sharePasswordGate, setSharePasswordGate] = useState<{ invalid: boolean } | null>(null);
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

  useLayoutEffect(() => {
    if (hydrated) return;
    // Wait for Clerk to determine the auth state before bootstrapping.
    // Otherwise a signed-in user lands here with `clerkUserId === null`
    // briefly, we mint a guest id, and the participant record + every
    // subsequent diagram load uses the wrong owner. With this gate
    // the effect re-runs once `authLoaded` flips true.
    if (!authLoaded) return;
    // The post-mount hydration is async (the API is HTTP) so we run it
    // inside an IIFE. UI stays at the placeholder during the fetch;
    // the welcome modal is gated on `hydrated` so it doesn't flash the
    // Guest placeholder name into the input.
    //
    // Path scheme (spec/14): `/live/diagram/<id>` is the owner URL.
    // The static export ships a single placeholder file at
    // `out/diagram/placeholder/index.html`; the live worker rewrites
    // `/diagram/<anything>` → that file so the browser receives the
    // editor HTML. The client router still fires notFound() for
    // every non-`placeholder` id, but `apps/live/app/not-found.tsx`
    // rescues that by rendering the editor in the not-found slot —
    // see the file comment there. Either way this component mounts
    // with the real id still in `window.location.pathname`, which
    // we parse out here.
    const initialUrl = new URL(window.location.href);
    const pathMatch = initialUrl.pathname.match(/\/live\/diagram\/([^/?#]+)/);
    const rawPathId = pathMatch ? pathMatch[1]! : null;
    // `placeholder` is the static-export build artefact, not a real
    // diagram id — ignore it so the IIFE doesn't try to fetch it.
    const initialId = rawPathId && rawPathId !== 'placeholder' ? rawPathId : null;
    const initialShareCode = initialUrl.searchParams.get('s');
    // No path id and no share code → the user landed on the placeholder
    // route directly. Hand off to /live/new for the welcome flow.
    if (!initialId && !initialShareCode) {
      window.location.assign(`${window.location.origin}/live/new`);
      return;
    }
    void (async () => {
      const id = initialId;
      const shareCodeParam = initialShareCode;

      // Identity comes first because every diagram fetch needs an
      // owner id. Two ways in (spec/04): when signed in, the Clerk
      // userId becomes the canonical participant id — same id the
      // api worker resolves from the Bearer token, so the
      // participant record keys match. When signed out, fall back
      // to the localStorage guest UUID (minted on first visit and
      // persisted forever, so a guest's diagrams survive page
      // reloads).
      const selfId = clerkUserId ?? ensureGuestSelfId();
      const storedSelf = await apiLoadSelf(selfId).catch(() => null);
      // Signed-in users always use their Clerk-known name on the
      // participant record. For a brand-new participant (no
      // storedSelf) this seeds the row; for an existing one we
      // overwrite the persisted name so it stays in sync with the
      // user's Clerk profile (rename in Clerk → rename here on next
      // load). Guests keep the existing random placeholder so their
      // chosen identity isn't blown away.
      const baseSelf: Participant = storedSelf ?? {
        id: selfId,
        name: randomName(),
        color: randomColor(),
        status: 'online',
      };
      const self: Participant =
        clerkUserId && clerkDisplayName
          ? { ...baseSelf, name: clerkDisplayName, status: 'online' }
          : { ...baseSelf, status: 'online' };
      setSelfParticipant({ ...self, status: 'online' });
      // Persist on first load, or when a signed-in user's Clerk
      // display name has drifted from what we have on the server
      // (e.g. they renamed themselves in the Clerk dashboard). The
      // denormalised participant name we copy into change_log rows
      // would otherwise stay stale.
      const nameDrifted = !!(
        storedSelf &&
        clerkUserId &&
        clerkDisplayName &&
        storedSelf.name !== clerkDisplayName
      );
      if (!storedSelf || nameDrifted) await apiSaveSelf(self).catch(() => {});
      // Seed the persistence guard with whatever's on the server (or
      // what we just saved for a brand-new participant) so the
      // post-hydration effect doesn't immediately echo the same
      // name/color back via PUT.
      lastPersistedSelfRef.current = { name: self.name, color: self.color };

      // Two URL flavours: `?d=<id>` is the owner's private URL,
      // `?s=<code>` is a share URL another participant follows. Visitor
      // arrivals get full diagram data via the share-code endpoint and
      // are flagged `!isOwner` so the Share button hides.
      if (shareCodeParam) {
        // Warm-cache the share password (spec/24) before the first
        // call so a returning visitor whose password didn't change
        // gets straight to the canvas without the gate. The seed is
        // a no-op when the cache is empty (apiHeaders sees null and
        // skips the X-Share-Password header), and if the server
        // rejects the cached value we'll clear the entry below.
        const cachedPassword = readCachedSharePassword(shareCodeParam);
        if (cachedPassword) setSessionSharePassword(cachedPassword);
        // Pass the visitor's owner id so the api worker can record
        // their visit into shared_with — without it the server can't
        // identify the visitor and the "Shared with you" list stays
        // empty forever.
        const resolution = await apiLoadShared(shareCodeParam, self.id).catch(() => null);
        if (!resolution) {
          // The share code didn't resolve. Either it never existed,
          // the owner revoked it, or the diagram was deleted while
          // the visitor still had the link. Surface a NotFound page
          // so the visitor sees an explicit error instead of a
          // silent blank canvas (which used to read as "the
          // diagram loaded but is empty").
          setDiagramNotFound(true);
          setHydrated(true);
          setLoadingDiagram(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if ('passwordRequired' in resolution) {
          // The diagram is password-protected (spec/24). Show the gate
          // instead of hydrating. Deliberately leave `hydrated` false
          // so bumping `passwordRetry` (on submit) re-runs this effect
          // with the password now set on the session. `invalid` marks
          // a wrong attempt so the gate can show an error. A cached
          // password that the server just rejected goes into both
          // buckets: clear it so we don't loop the same wrong value
          // on the next retry, and reset the session attempt too so
          // the gate's empty-input prompt isn't lying about what's
          // about to be sent.
          if (cachedPassword) {
            writeCachedSharePassword(shareCodeParam, null);
            setSessionSharePassword(null);
          }
          setSharePasswordGate({ invalid: resolution.invalid });
          setLoadingDiagram(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        // Success path. Persist whatever password the session is
        // currently using (cached seed OR fresh user input) so the
        // next load skips the gate.
        const accepted = getSessionSharePassword();
        if (accepted) writeCachedSharePassword(shareCodeParam, accepted);
        {
          const { diagram: fetched, role } = resolution;
          const codeForVisitor = fetched.ownerId === self.id ? null : shareCodeParam;
          // Lazy per-tab fetch (spec/13): the active tab (first in the
          // summaries) gets its full payload inline so the first paint
          // has real content; the rest land as placeholders and a
          // useEffect below fetches each one when the user switches.
          const placeholderTabs: Tab[] = placeholdersFromSummaries(fetched.tabs);
          const firstSummary = fetched.tabs[0];
          if (firstSummary) {
            const first = await apiLoadTab(
              self.id,
              fetched.id,
              firstSummary.id,
              codeForVisitor,
            ).catch(() => null);
            // Only mark the tab loaded when the eager fetch actually
            // returned content. If it failed (e.g. a transient 403 from
            // a request that raced ahead of the Clerk token / session
            // share code being wired up), leave it OUT of the loaded set
            // so the lazy-load effect below retries it once auth is in
            // place. Marking it loaded regardless used to leave the
            // first tab permanently blank while later tabs — fetched
            // through that effect after bootstrap — loaded fine.
            if (first) {
              placeholderTabs[0] = first;
              loadedTabIdsRef.current.add(firstSummary.id);
              setLoadedTabIds((prev) => new Set(prev).add(firstSummary.id));
            }
          }
          resetTabs(placeholderTabs);
          // Seed the autosave's "last saved" mirror with the hydrated
          // state so the first save-cycle treats it as unchanged.
          // Otherwise the autosave would diff the EMPTY-elements
          // placeholders against an empty [] baseline and PUT them
          // back to the server, wiping every other tab's content
          // before the lazy-load could populate it.
          lastSavedTabsRef.current = placeholderTabs;
          lastSavedNameRef.current = fetched.name;
          setDiagramName(fetched.name);
          // Prefer the tab id pinned in the URL fragment (#t=<id>) when
          // it points at a real loaded tab — round-trips the user back
          // to whichever tab they last had open before a refresh.
          {
            const hashMatch = window.location.hash.match(/t=([^&]+)/);
            const hashedId = hashMatch ? hashMatch[1] : null;
            const pickFromHash = hashedId && placeholderTabs.some((t) => t.id === hashedId);
            setActiveId(pickFromHash ? hashedId! : (placeholderTabs[0]?.id ?? activeId));
          }
          setLoadedExistingDiagram(true);
          setDiagramId(fetched.id);
          setDiagramShareable(fetched.shareable);
          setDiagramShareCode(fetched.shareCode);
          setIsOwner(fetched.ownerId === self.id);
          setDiagramOwnerId(fetched.ownerId);
          setDiagramOwnerName(fetched.ownerName ?? null);
          setDiagramOwnerColor(fetched.ownerColor ?? null);
          // Visitors inherit the role from their share code. Owners
          // overwrite this to 'edit' below.
          setSessionRole(fetched.ownerId === self.id ? 'edit' : role);
          // Visitor: stash the code they came in on so any log
          // writes can present it as authorisation. Owner accessing
          // via a share URL keeps null.
          setSessionShareCode(fetched.ownerId === self.id ? null : shareCodeParam);
          // Visitors with an edit-role share code can read + write the
          // log too. View-only visitors get nothing from the endpoint
          // (the API gates POST/DELETE but currently still serves
          // GET when authorised; we skip the fetch so view-only
          // visitors don't even attempt it). Owner case is handled
          // in the ?d= branch below.
          if (fetched.ownerId === self.id || role === 'edit') {
            const codeForFetch = fetched.ownerId === self.id ? null : shareCodeParam;
            apiListChangeLog(self.id, fetched.id, codeForFetch)
              .then((entries) => {
                setChangeLog(entries);
                setChangeLogLoading(false);
              })
              .catch(() => setChangeLogLoading(false));
          } else {
            setChangeLogLoading(false);
          }
          // Signed-in user opening their own diagram via a share URL
          // already has a confirmed identity — never prompt. Visitors
          // (signed in or not) still see the welcome card so they get
          // the "you're joining X's diagram" context; the name input
          // is locked downstream when they have a Clerk identity so
          // they can't pretend to be someone else.
          const isOwnerVisit = fetched.ownerId === self.id;
          if (!isOwnerVisit && !hasConfirmedName()) {
            setTemplatePickerMode('identity');
          }
          // Telemetry (spec/22): a visitor joined a shared diagram.
          // Owners opening their own share URL don't count as a join.
          // `type` is the share role (Edit / View), a preset.
          if (!isOwnerVisit) {
            track('Diagram', 'Joined', role === 'edit' ? 'Edit' : 'View');
          }
        }
      } else if (id) {
        const fetched = await apiLoadDiagram(self.id, id).catch(() => null);
        if (!fetched) {
          // URL had a ?d=<id> but the API didn't return anything for
          // us — either the diagram doesn't exist or we don't own it.
          // Surface a NotFound page instead of dropping the user into
          // the new-diagram welcome flow.
          setDiagramId(id);
          setDiagramNotFound(true);
          setHydrated(true);
          setLoadingDiagram(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if (fetched) {
          // Lazy per-tab fetch — see the share branch above for
          // rationale.
          const placeholderTabs: Tab[] = placeholdersFromSummaries(fetched.tabs);
          const firstSummary = fetched.tabs[0];
          if (firstSummary) {
            const first = await apiLoadTab(self.id, fetched.id, firstSummary.id, null).catch(
              () => null,
            );
            // Only mark loaded on success, so a failed eager fetch falls
            // through to the lazy-load effect's retry (see the visitor
            // branch above for the full rationale).
            if (first) {
              placeholderTabs[0] = first;
              loadedTabIdsRef.current.add(firstSummary.id);
              setLoadedTabIds((prev) => new Set(prev).add(firstSummary.id));
            }
          }
          resetTabs(placeholderTabs);
          // Seed the autosave's "last saved" mirror with the hydrated
          // state — same rationale as the visitor branch above.
          lastSavedTabsRef.current = placeholderTabs;
          lastSavedNameRef.current = fetched.name;
          setDiagramName(fetched.name);
          // Prefer the tab id pinned in the URL fragment (#t=<id>) when
          // it points at a real loaded tab — round-trips the user back
          // to whichever tab they last had open before a refresh.
          {
            const hashMatch = window.location.hash.match(/t=([^&]+)/);
            const hashedId = hashMatch ? hashMatch[1] : null;
            const pickFromHash = hashedId && placeholderTabs.some((t) => t.id === hashedId);
            setActiveId(pickFromHash ? hashedId! : (placeholderTabs[0]?.id ?? activeId));
          }
          setLoadedExistingDiagram(true);
          setDiagramShareable(fetched.shareable);
          setDiagramShareCode(fetched.shareCode);
          setIsOwner(fetched.ownerId === self.id);
          setDiagramOwnerId(fetched.ownerId);
          setDiagramOwnerName(fetched.ownerName ?? null);
          setDiagramOwnerColor(fetched.ownerColor ?? null);
          setSessionRole('edit');
          // If we own the diagram, prefetch its full share-link list so
          // the dialog opens populated.
          if (fetched.ownerId === self.id) {
            apiListShareLinks(self.id, fetched.id)
              .then(({ links, password }) => {
                setShareLinks(links);
                setSharePassword(password);
              })
              .catch(() => {});
            apiListChangeLog(self.id, fetched.id, null)
              .then((entries) => {
                setChangeLog(entries);
                setChangeLogLoading(false);
              })
              .catch(() => setChangeLogLoading(false));
          } else {
            setChangeLogLoading(false);
          }
          // Owner branch (`?d=<id>` / `/diagram/<id>`): a signed-in
          // user is by definition the owner here and their identity is
          // settled — skip the identity prompt entirely. Guests fall
          // back to the legacy localStorage gate so they still get the
          // one-time naming nudge.
          if (!clerkUserId && !hasConfirmedName()) {
            setTemplatePickerMode('identity');
          }
        }
        setDiagramId(id);
      }
      // No URL params → no diagram yet → no log to fetch. Clear the
      // skeleton so the panel renders the empty-state copy.
      if (!shareCodeParam && !id) {
        setChangeLogLoading(false);
      }
      setNameConfirmed(hasConfirmedName());
      refreshDiagramList(self.id);
      refreshSharedList(self.id);
      // Folder list is auto-loaded by the useFolders hook once
      // selfParticipant.id transitions off the placeholder — no
      // manual fetch needed here.
      setHydrated(true);
      setLoadingDiagram(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, passwordRetry]);

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

  // Flush any pending autosave when the page unloads. Without this a
  // fast user (edit → reload before the 600ms debounce fires) would
  // lose changes. Uses `fetch` with `keepalive: true` so the browser
  // keeps the request alive across the navigation. Reads the refs
  // directly (rather than the stale closure) so the handler always
  // ships the most recent state. See task #85.
  useEffect(() => {
    if (!hydrated || !diagramId || isReadOnly) return;
    const handler = () => {
      const prevTabs = lastSavedTabsRef.current;
      const prevTabById = new Map(prevTabs.map((t) => [t.id, t] as const));
      const changedTabs = tabs.filter((t) => prevTabById.get(t.id) !== t);
      const orderChanged =
        tabs.length !== prevTabs.length || tabs.some((t, i) => prevTabs[i]?.id !== t.id);
      const nameChanged = diagramName !== lastSavedNameRef.current;
      const deletedIds = prevTabs
        .filter((t) => !tabs.some((current) => current.id === t.id))
        .map((t) => t.id);
      if (changedTabs.length === 0 && !orderChanged && !nameChanged && deletedIds.length === 0) {
        return;
      }
      const apiBase = '/api';
      const headers: Record<string, string> = {
        'X-Owner-Id': selfParticipant.id,
        'Content-Type': 'application/json',
      };
      if (sessionShareCode) headers['X-Share-Code'] = sessionShareCode;
      for (const t of changedTabs) {
        // Strip `templateChosen` (UI-only) before persisting,
        // mirroring apiSaveTab.
        const { templateChosen: _tc, ...persistable } = t;
        void _tc;
        fetch(`${apiBase}/diagrams/${diagramId}/tabs/${t.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(persistable),
          keepalive: true,
        }).catch(() => {});
      }
      for (const tabId of deletedIds) {
        const getHeaders: Record<string, string> = { 'X-Owner-Id': selfParticipant.id };
        if (sessionShareCode) getHeaders['X-Share-Code'] = sessionShareCode;
        fetch(`${apiBase}/diagrams/${diagramId}/tabs/${tabId}`, {
          method: 'DELETE',
          headers: getHeaders,
          keepalive: true,
        }).catch(() => {});
      }
      if (orderChanged || nameChanged) {
        fetch(`${apiBase}/diagrams/${diagramId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ name: diagramName, tabIds: tabs.map((t) => t.id) }),
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hydrated, diagramId, isReadOnly, tabs, diagramName, selfParticipant.id, sessionShareCode]);

  useEffect(() => {
    if (!hydrated || !diagramId) return;
    if (isReadOnly) return;
    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const prevTabs = lastSavedTabsRef.current;
      const prevTabById = new Map(prevTabs.map((t) => [t.id, t] as const));
      const changedTabs = tabs.filter((t) => prevTabById.get(t.id) !== t);
      const orderChanged =
        tabs.length !== prevTabs.length || tabs.some((t, i) => prevTabs[i]?.id !== t.id);
      const nameChanged = diagramName !== lastSavedNameRef.current;
      const deletedIds = prevTabs
        .filter((t) => !tabs.some((current) => current.id === t.id))
        .map((t) => t.id);

      if (changedTabs.length === 0 && !orderChanged && !nameChanged && deletedIds.length === 0) {
        return;
      }

      setSaveStatus('saving');
      const writes: Promise<unknown>[] = [];
      for (const t of changedTabs) {
        writes.push(
          apiSaveTab(selfParticipant.id, diagramId, t, sessionShareCode).then(() => {
            roomRef.current?.send({
              kind: 'op',
              op: { kind: 'tab', tabId: t.id, tab: t },
            });
          }),
        );
      }
      for (const tabId of deletedIds) {
        writes.push(apiDeleteTab(selfParticipant.id, diagramId, tabId, sessionShareCode));
      }
      if (orderChanged || nameChanged) {
        writes.push(
          apiSaveDiagramMeta(
            selfParticipant.id,
            { id: diagramId, name: diagramName, tabIds: tabs.map((t) => t.id) },
            sessionShareCode,
          ).then(() => {
            roomRef.current?.send({
              kind: 'op',
              op: {
                kind: 'diagram-meta',
                name: diagramName,
                tabs: tabs.map((t, i) => ({
                  id: t.id,
                  name: t.name,
                  orderIndex: i,
                })),
              },
            });
          }),
        );
      }
      Promise.all(writes)
        .then(() => {
          lastSavedTabsRef.current = tabs;
          lastSavedNameRef.current = diagramName;
          setSaveStatus('saved');
          const now = Date.now();
          setSavedAt(now);
          // Bump the current diagram's row locally so the Explorer's
          // "Updated X ago" stays fresh — used to refetch the whole
          // list here, which hit /api/diagrams on every autosave.
          setDiagramList((prev) =>
            prev.map((d) => (d.id === diagramId ? { ...d, savedAt: now, name: diagramName } : d)),
          );
        })
        .catch(() => {
          setSaveStatus('error');
        });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [hydrated, diagramId, tabs, diagramName, selfParticipant.id, isReadOnly, sessionShareCode]);

  // Persist self only when name or color actually changed. Without
  // this guard the hydration GET → state set → effect fire chain
  // produced a useless PUT echoing the same values back to the
  // server. Status is in-memory only (the API doesn't store it) so
  // it doesn't count as a change.
  const lastPersistedSelfRef = useRef<{ name: string; color: string } | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const prev = lastPersistedSelfRef.current;
    if (prev && prev.name === selfParticipant.name && prev.color === selfParticipant.color) {
      return;
    }
    lastPersistedSelfRef.current = { name: selfParticipant.name, color: selfParticipant.color };
    apiSaveSelf(selfParticipant).catch(() => {});
  }, [hydrated, selfParticipant]);

  // Realtime room: open a WebSocket per diagram, BUT only when the
  // diagram is actually shared. Private diagrams skip the WS — there's
  // no one else in the room, presence is meaningless, and we don't
  // want every save to broadcast an op into the void.
  useEffect(() => {
    if (!hydrated || !diagramId || !diagramShareable) {
      // Make sure any state from a previous shared session is cleared
      // when we transition back to private (revoke share).
      setLivePresence([]);
      setRemoteSelections(new Map());
      return;
    }
    const handlers: RoomHandlers = {
      onPresence: (participants) => {
        const now = Date.now();
        setLivePresence(
          participants.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            // Status + lastActiveAt are derived locally rather than
            // carried on the wire — the server doesn't track idle
            // time. Seed any peer we haven't seen with `now` so the
            // tooltip reads "Active just now" until their first op
            // arrives.
            status: 'online',
            lastActiveAt: lastSeenRef.current.get(p.id) ?? now,
            // Role is server-verified (api worker resolved it at WS
            // upgrade from the share-code / owner-id query params
            // and stamped it onto the broadcast row). Optional on the
            // wire so a connection without role info still parses.
            ...(p.role ? { role: p.role } : {}),
          })),
        );
        // Seed lastSeen for any presence-arrival we haven't tracked
        // yet — without this the next render still shows
        // `lastActiveAt = undefined` because the merge happens
        // synchronously above before the ref write.
        for (const p of participants) {
          if (!lastSeenRef.current.has(p.id)) {
            lastSeenRef.current.set(p.id, now);
          }
        }
        // Unique-colour reconciliation. Every client computes the
        // same allocation on every presence update; we only act when
        // (a) someone else in the room shares our colour and (b) our
        // participant id sorts later than theirs — that way only the
        // later-joining peer yields, the earlier one keeps their
        // colour, and every client converges on the same assignment
        // without a server-side allocator. Persisting the new colour
        // via setSelfParticipant flushes through the autosave effect
        // and the next hello broadcast carries the fixed colour.
        // selfParticipantRef instead of selfParticipant because this
        // effect's deps intentionally omit the participant — without
        // the ref we'd act on a stale snapshot.
        const live = selfParticipantRef.current;
        const me = participants.find((p) => p.id === live.id);
        if (me) {
          const conflictHolder = participants.find(
            (p) => p.id !== live.id && p.color === live.color,
          );
          if (conflictHolder && live.id > conflictHolder.id) {
            const taken = new Set(participants.filter((p) => p.id !== live.id).map((p) => p.color));
            const fresh = nextFreeColor(taken, undefined);
            if (fresh !== live.color) {
              setSelfParticipant((prev) => ({ ...prev, color: fresh }));
            }
          }
        }
        // Drop selections AND cursors for any participant who's no
        // longer connected. Stops stale presence indicators from
        // sticking after a tab close or network drop.
        const present = new Set(participants.map((p) => p.id));
        // Drop tab-focus entries for people who left so their avatar
        // dot doesn't linger on a tab they no longer occupy.
        setRemoteTabFocus((prev) => {
          let changed = false;
          const next = new Map<string, string>();
          for (const [id, tabId] of prev) {
            if (present.has(id)) {
              next.set(id, tabId);
            } else {
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        setRemoteSelections((prev) => {
          let changed = false;
          const next = new Map<string, string | null>();
          for (const [id, sel] of prev) {
            if (present.has(id)) {
              next.set(id, sel);
            } else {
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        setRemoteCursors((prev) => {
          let changed = false;
          const next = new Map<string, { tabId: string; x: number; y: number } | null>();
          for (const [id, pos] of prev) {
            if (present.has(id)) {
              next.set(id, pos);
            } else {
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      onOp: (from, op) => {
        // Any op from a peer counts as "they're still here". Bumps
        // the idle timer used by the avatar's away/offline status
        // derivation. Cursor packets are the most frequent so this
        // doubles as a perfectly fine activity heartbeat.
        lastSeenRef.current.set(from, Date.now());
        if (op.kind === 'tab') {
          // Peer updated a single tab's contents. Merge by id; if the
          // tab isn't local yet (new tab the peer just added), append
          // it so the receiver picks it up without a refetch.
          remoteUpdateRef.current = true;
          resetTabs((prev) => {
            const existing = prev.findIndex((t) => t.id === op.tabId);
            if (existing === -1) return [...prev, op.tab];
            const next = [...prev];
            next[existing] = op.tab;
            return next;
          });
        } else if (op.kind === 'diagram-meta') {
          // Peer renamed the diagram or reordered tabs (incl. add /
          // delete). Reorder locally to match; new ids land as
          // placeholders that a follow-up `tab` op will populate.
          remoteUpdateRef.current = true;
          setDiagramName(op.name);
          resetTabs((prev) => {
            const localById = new Map(prev.map((t) => [t.id, t] as const));
            return op.tabs.map(
              (summary) =>
                localById.get(summary.id) ?? {
                  id: summary.id,
                  name: summary.name,
                  elements: [],
                },
            );
          });
        } else if (op.kind === 'select') {
          setRemoteSelections((prev) => {
            const next = new Map(prev);
            next.set(from, op.elementId);
            return next;
          });
        } else if (op.kind === 'cursor') {
          setRemoteCursors((prev) => {
            const next = new Map(prev);
            next.set(
              from,
              op.x !== null && op.y !== null ? { tabId: op.tabId, x: op.x, y: op.y } : null,
            );
            return next;
          });
        } else if (op.kind === 'laser') {
          setRemoteLaserTrails((prev) => {
            const next = new Map(prev);
            const existing = next.get(from);
            // A tab switch resets the buffer for that participant —
            // otherwise a peer who lasered on tab A then started
            // lasering on tab B would briefly render an interpolated
            // line across the gap.
            const points =
              existing && existing.tabId === op.tabId
                ? trimLaserBuffer([...existing.points, { x: op.x, y: op.y, t: performance.now() }])
                : [{ x: op.x, y: op.y, t: performance.now() }];
            next.set(from, { tabId: op.tabId, points });
            return next;
          });
        } else if (op.kind === 'tab-focus') {
          setRemoteTabFocus((prev) => {
            const next = new Map(prev);
            next.set(from, op.tabId);
            return next;
          });
        } else if (op.kind === 'log') {
          // Remote participant just emitted an audit entry. Prepend it
          // to the local list (de-duped by id so a sender that round-
          // trips its own op doesn't show a duplicate). Cap at 200 to
          // match the hydrated list size.
          setChangeLog((prev) => {
            if (prev.some((e) => e.id === op.entry.id)) return prev;
            return [op.entry, ...prev].slice(0, 30);
          });
        } else if (op.kind === 'log-remove') {
          setChangeLog((prev) => prev.filter((e) => e.id !== op.entryId));
        } else if (op.kind === 'share-revoked') {
          // Owner revoked a share link. If our session is hydrated
          // against that exact code, the diagram is no longer ours
          // to read; hard-redirect to the explorer so we don't sit
          // on stale state. The check is per-client: an owner who
          // revoked their own outbound link to a different visitor
          // keeps their session.
          if (sessionShareCodeRef.current && sessionShareCodeRef.current === op.code) {
            window.location.assign('/live/');
          }
        }
      },
    };
    const room = connectRoom(
      diagramId,
      { id: selfParticipant.id, name: selfParticipant.name, color: selfParticipant.color },
      handlers,
      {
        // The api worker resolves role from these on WS upgrade and
        // stamps it into the participant row via X-Verified-Role so
        // peers see a trustworthy Viewer / Editor badge.
        shareCode: sessionShareCode,
        ownerId: isOwner ? selfParticipant.id : null,
      },
    );
    roomRef.current = room;
    return () => {
      room.close();
      roomRef.current = null;
    };
    // selfParticipant.id is stable across the session; name/color
    // changes don't warrant a reconnect. Deliberately omitted from
    // the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, diagramShareable]);

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

  // Lazy fetch the active tab's full payload if we haven't loaded it
  // yet. The hydration step seeds the first tab; switching to a
  // never-opened tab kicks off a one-shot GET that merges the
  // elements into local state. Failures fall back to the placeholder
  // (empty elements) so the editor doesn't lock up.
  useEffect(() => {
    if (!hydrated || !diagramId) return;
    if (loadedTabIdsRef.current.has(activeId)) return;
    let cancelled = false;
    loadedTabIdsRef.current.add(activeId);
    // Track whether we actually consumed the API response. Cleanup
    // checks this flag — if the effect was torn down before it could
    // merge (StrictMode double-invoke, fast activeId switch, etc.),
    // we remove the id from the loaded-set so the next effect run
    // can retry instead of skipping forever. Without this, Tab 2
    // reliably loaded as empty: first effect added the id, then the
    // cleanup cancelled the in-flight fetch, then the second effect
    // saw the id in the set and bailed.
    let merged = false;
    const targetId = activeId;
    // Capture the ref value at effect-run time so the cleanup uses
    // the same Set the effect itself populated (avoids the lint
    // warning about ref values shifting between effect and cleanup).
    const loadedTabIds = loadedTabIdsRef.current;
    apiLoadTab(selfParticipant.id, diagramId, targetId, sessionShareCode)
      .then((tab) => {
        if (cancelled || !tab) return;
        let didMerge = false;
        resetTabs((prev) =>
          prev.map((t) => {
            if (t.id !== tab.id) return t;
            const userHasEdited = t.elements.length > 0 || t.templateChosen === true;
            if (userHasEdited) return t;
            didMerge = true;
            return tab;
          }),
        );
        if (didMerge) remoteUpdateRef.current = true;
        // Either way the load is now committed — local state has been
        // consulted. Keep the id in the loaded-set so subsequent
        // tab switches don't refetch.
        merged = true;
        // Mirror into reactive state so the template-picker gate
        // can wait on this without rebuilding the ref-based dedupe
        // logic. Suppresses the brief "pick a template" flash that
        // used to render between hydration and the fetch landing.
        setLoadedTabIds((prev) => {
          if (prev.has(targetId)) return prev;
          return new Set(prev).add(targetId);
        });
      })
      .catch(() => {
        loadedTabIds.delete(targetId);
      });
    return () => {
      cancelled = true;
      // StrictMode double-invoke + cleanup-before-promise-resolve
      // used to lock the tab in "loaded but empty" state forever:
      // the first run added the id and was cancelled before the
      // response arrived; the second run saw the id in the set and
      // bailed; the user never saw the real content. Drop the id
      // here so the next run actually fetches.
      if (!merged) loadedTabIds.delete(targetId);
    };
  }, [hydrated, diagramId, activeId, selfParticipant.id, sessionShareCode, resetTabs]);

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
  const selfParticipantRef = useRef(selfParticipant);
  useEffect(() => {
    selfParticipantRef.current = selfParticipant;
  }, [selfParticipant]);

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
  const participantsByTab = (() => {
    const map = new Map<string, Participant[]>();
    // Private diagrams have no collaborators by definition, so the
    // avatar row on the tab strip would just be a redundant "you're
    // here" indicator. Skip it entirely until the diagram is shared.
    if (!diagramShareable) return map;
    const now = Date.now();
    map.set(activeId, [
      // Self is always "online" (you can't be idle to yourself in
      // any useful sense), with lastActiveAt at "now" so the tooltip
      // reads "Active just now".
      { ...selfParticipant, status: 'online', lastActiveAt: now },
    ]);
    // Build a local view of "who's on which tab" that defaults any
    // joiner whose tab-focus op hasn't arrived yet to the first tab
    // (every visitor lands on tabs[0] by default unless they came in
    // via a tab hash). Without this fallback a new joiner's avatar
    // is invisible until they switch tabs once, even though their
    // presence row already arrived. We derive a fresh Map rather
    // than mutating `remoteTabFocus` state from a render callback.
    const defaultTabId = tabs[0]?.id ?? activeId;
    const tabFocus = new Map<string, string>(remoteTabFocus);
    for (const p of livePresence) {
      if (p.id === selfParticipant.id) continue;
      if (!tabFocus.has(p.id)) tabFocus.set(p.id, defaultTabId);
    }
    for (const [id, tabId] of tabFocus) {
      if (id === selfParticipant.id) continue;
      const p = livePresenceById.get(id);
      if (!p) continue;
      // Combine the two presence signals: tab-focus (are they on my
      // tab) and idle (how long since their last op). Idle wins when
      // it's worse — a peer who's gone idle for an hour is "offline"
      // no matter which tab they were last on. Otherwise the
      // historical "on my tab → online, on another tab → away"
      // signal applies.
      const lastActiveAt = lastSeenRef.current.get(id) ?? now;
      const idleStatus = statusFromIdleMs(now - lastActiveAt);
      const status =
        idleStatus === 'offline'
          ? 'offline'
          : idleStatus === 'away'
            ? 'away'
            : tabId === activeId
              ? 'online'
              : 'away';
      const withStatus: Participant = { ...p, status, lastActiveAt };
      const bucket = map.get(tabId);
      if (bucket) bucket.push(withStatus);
      else map.set(tabId, [withStatus]);
    }
    return map;
  })();
  // Cursor rows joined with presence so we get a fresh colour + name on
  // every render and don't have to denormalise them into each `cursor`
  // op payload. Filter to the active tab so cursors of teammates
  // looking at a different tab don't bleed onto this one.
  const remoteCursorRows = useMemo(() => {
    const rows: { id: string; name: string; color: string; x: number; y: number }[] = [];
    for (const [id, pos] of remoteCursors) {
      if (!pos) continue;
      if (id === selfParticipant.id) continue;
      if (pos.tabId !== activeId) continue;
      const p = livePresenceById.get(id);
      if (!p) continue;
      rows.push({ id, name: p.name, color: p.color, x: pos.x, y: pos.y });
    }
    return rows;
  }, [remoteCursors, livePresenceById, selfParticipant.id, activeId]);
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

  const laserTrailRows = useMemo(() => {
    const rows: {
      participantId: string;
      color: string;
      points: LaserPoint[];
    }[] = [];
    if (localLaserTrail.length > 0) {
      rows.push({
        participantId: selfParticipant.id,
        color: selfParticipant.color,
        points: localLaserTrail,
      });
    }
    for (const [id, entry] of remoteLaserTrails) {
      if (id === selfParticipant.id) continue;
      if (entry.tabId !== activeId) continue;
      const p = livePresenceById.get(id);
      if (!p) continue;
      rows.push({ participantId: id, color: p.color, points: entry.points });
    }
    return rows;
  }, [
    localLaserTrail,
    remoteLaserTrails,
    livePresenceById,
    selfParticipant.id,
    selfParticipant.color,
    activeId,
  ]);
  const remoteSelectionsByElement = useMemo(() => {
    const out = new Map<string, { id: string; name: string; color: string }[]>();
    for (const [participantId, elementId] of remoteSelections) {
      if (!elementId) continue;
      if (participantId === selfParticipant.id) continue;
      const participant = livePresenceById.get(participantId);
      if (!participant) continue;
      const list = out.get(elementId) ?? [];
      list.push({ id: participant.id, name: participant.name, color: participant.color });
      out.set(elementId, list);
    }
    return out;
  }, [remoteSelections, livePresenceById, selfParticipant.id]);
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

  // Click handler for Activity rows (Revert has its own button that
  // stops propagation). Element-related entries select the affected
  // element on the right tab; tab-meta entries pop the matching
  // accordion in the Editor panel so the user can see what changed
  // and tweak it again.
  const handleActivityRowClick = (entry: ChangeLogEntry) => {
    // Switch to the entry's tab if we're not already on it. Without
    // this, selecting an element on a different tab would silently
    // fail because tabs[].find(t=>t.id===entry.tabId) is the wrong
    // active tab.
    if (entry.tabId && entry.tabId !== activeId) {
      setActiveId(entry.tabId);
    }
    if (entry.elementIds.length > 0) {
      // Element entry — select the (first) affected element and
      // clear any marquee multi-selection. The selection popover
      // takes care of itself from there.
      const target = entry.elementIds[0]!;
      setSelectedId(target);
      setMultiSelectedIds(new Set());
      setEditingId(null);
      return;
    }
    // Tab-meta entries (theme / background tweaks) have no element
    // ids. Crude string-match on the summary picks the right
    // accordion; we own the summary text so this stays stable.
    const lower = entry.summary.toLowerCase();
    if (lower.includes('theme')) {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      requestEditorOpen();
      setTabAccordionsOpen({
        theme: true,
        canvas: false,
        cleanup: false,
      });
    } else if (lower.includes('canvas') || lower.includes('pattern') || lower.includes('opacity')) {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      requestEditorOpen();
      setTabAccordionsOpen({
        theme: false,
        canvas: true,
        cleanup: false,
      });
    }
  };

  // Drop every audit entry for the currently active tab. The diagram
  // itself is untouched — only the log dies. The Activity Panel
  // exposes this via its bottom "Clear Activity" button. Mirrors the
  // server-side cascade that runs on tab delete, just user-triggered.
  const clearActivityForActiveTab = () => {
    if (!diagramId) return;
    const targetTabId = activeId;
    setChangeLog((prev) => prev.filter((entry) => entry.tabId !== targetTabId));
    apiDeleteChangeLogForTab(selfParticipant.id, diagramId, targetTabId, sessionShareCode).catch(
      () => {
        // Best-effort. Stale rows in D1 are harmless; the next list
        // fetch reconciles. We don't want a transient error to block
        // the local clear that already happened.
      },
    );
  };

  // Surgical revert: replay the entry's `before` payload onto the
  // target tab. Other elements (including newer edits) are untouched.
  // If the tab was deleted in between, the revert is a no-op — the
  // log entry has already been cascade-dropped.
  //
  // The reverted entry is removed from the log rather than getting a
  // 'reverted' twin appended. Keeps the panel compact: a revert is a
  // cancellation of an event, not its own event.
  const revertChange = (entry: ChangeLogEntry) => {
    const tabId = entry.tabId;
    if (!tabId) return;
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;
    const after = applyRevert(target.elements, entry.beforeState as Record<string, Element | null>);
    commitTabs((ts) => patchTab(ts, tabId, { elements: after }));
    if (tabId !== activeId) setActiveId(tabId);
    track('Diagram', 'Reverted');
    // Drop the entry locally first so the panel updates immediately;
    // fire-and-forget the API delete.
    setChangeLog((prev) => prev.filter((e) => e.id !== entry.id));
    if (diagramId) {
      apiDeleteChangeLogEntry(selfParticipant.id, diagramId, entry.id, sessionShareCode).catch(
        () => {
          // Best-effort. A stale row in D1 surfaces on the next list
          // fetch — at which point the entry would reappear; acceptable
          // tradeoff for the lighter UX.
        },
      );
    }
    roomRef.current?.send({ kind: 'op', op: { kind: 'log-remove', entryId: entry.id } });
  };

  const tick = (mapElements: (els: Element[]) => Element[]) => {
    if (editsBlocked) return;
    tickTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, elements: mapElements(t.elements) } : t)),
    );
  };

  // Undo / redo are paired with the activity log: undoing a step
  // removes the matching entry from the panel (and from D1), redoing
  // re-inserts the same entry verbatim. The `canUndo` / `canRedo`
  // guards keep this in sync with useDiagramHistory's bounded stacks
  // — if the history is exhausted, our entry stacks stay put.
  const undo = () => {
    if (!canUndo) return;
    track('Diagram', 'Undone');
    undoHistory();
    const { past, future } = entryHistoryRef.current;
    const popped = past[past.length - 1];
    if (popped) {
      entryHistoryRef.current = {
        past: past.slice(0, -1),
        future: [popped, ...future].slice(0, HISTORY_LIMIT),
      };
      setChangeLog((prev) => prev.filter((e) => e.id !== popped.id));
      if (diagramId) {
        apiDeleteChangeLogEntry(selfParticipant.id, diagramId, popped.id, sessionShareCode).catch(
          () => {
            // Best-effort. A redo will re-POST the same id so a stale
            // duplicate is unlikely.
          },
        );
      }
      roomRef.current?.send({ kind: 'op', op: { kind: 'log-remove', entryId: popped.id } });
    }
    setEditingId(null);
    setSelectedId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  const redo = () => {
    if (!canRedo) return;
    track('Diagram', 'Redone');
    redoHistory();
    const { past, future } = entryHistoryRef.current;
    const next = future[0];
    if (next) {
      entryHistoryRef.current = {
        past: [...past, next].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      };
      setChangeLog((prev) => [next, ...prev].slice(0, 30));
      if (diagramId) {
        // Same entry id and content — D1 ends up with the same row
        // it had before the undo. Idempotent under network retries
        // (the API treats POST as insert; a re-insert of the same id
        // would fail loudly but we don't double-fire).
        if (diagramId) {
          apiAppendChangeLogEntry(selfParticipant.id, diagramId, next, sessionShareCode).catch(
            () => {},
          );
        }
      }
      roomRef.current?.send({ kind: 'op', op: { kind: 'log', entry: next } });
    }
    setEditingId(null);
    setSelectedId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  const sizeFromSelection = (): { width: number; height: number } | null => {
    if (!selectedId) return null;
    const sel = activeTab.elements.find((el) => el.id === selectedId);
    if (!sel || !isBoxed(sel)) return null;
    return { width: sel.width, height: sel.height };
  };

  const addBoxed = <T extends BoxedElement>(make: (x: number, y: number) => T) => {
    if (editsBlocked) return;
    const base = make(0, 0);
    const override = sizeFromSelection();
    let width = override?.width ?? base.width;
    let height = override?.height ?? base.height;
    // Circles and diamonds are inherently 1:1 — inheriting a non-square
    // size from the selection would squash them. Snap them back to a square
    // using the larger inherited dimension so they stay visible.
    if (base.type === 'shape' && (base.shape === 'circle' || base.shape === 'diamond')) {
      const side = Math.max(width, height);
      width = side;
      height = side;
    }
    // Derive colours from the active tab's backdrop + theme. The
    // two-pass projection (background-derived then theme-override)
    // lives in lib/themes.ts so the rule is testable in isolation
    // and stays in sync with the other theme helpers
    // (recolourElementForTheme etc).
    const colours = deriveNewBoxedColours(base, {
      backgroundColor: activeTab.backgroundColor,
      patternColor: activeTab.patternColor,
      theme: activeTab.theme,
    });
    const centre = getViewportCenter();
    const el: T = {
      ...base,
      ...colours,
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
    };
    // Single commit that both adds the element and marks the template
    // picker as dismissed for this tab (if it was still showing).
    // Prepend (not append) so new elements land at the BACK of the
    // z-order: rendering is by array index, lowest first. The user
    // observed that the previous append-default forced a manual
    // "send to back" after most adds; "add behind existing content"
    // is the friendlier default, and the Layer accordion's
    // "Bring to front" still exists for the rare case where the new
    // element should sit on top.
    const before = activeTab.elements;
    const after = [el, ...before];
    commitTabs((ts) => patchTab(ts, activeId, { elements: after, templateChosen: true }));
    // Activity-log the add. commit() (the element-only setter) does
    // this on every change; addBoxed bypasses commit because it also
    // touches templateChosen on the tab, so the emitChange call has
    // to be repeated here. Without it, palette adds never appear in
    // the Activity panel.
    emitChange(activeId, before, after);
    setSelectedId(el.id);
  };

  // --- Selection helpers ---------------------------------------------------

  const memberIdsOf = (id: string | null): Set<string> => {
    if (!id) return new Set();
    return new Set(selectionMembers(activeTab.elements, id));
  };

  // Unified "what's the user editing right now?" id set. An active
  // marquee multi-selection wins; otherwise we fall back to the
  // single-id member-resolver (which expands a group selection
  // into its full membership). Every editor setter that used to
  // operate on `memberIdsOf(selectedId)` now uses this so shared
  // controls bulk-apply across either flavour of multi-selection.
  const currentSelectionIds = (): Set<string> => {
    if (multiSelectedIds.size > 0) return new Set(multiSelectedIds);
    return memberIdsOf(selectedId);
  };

  // First element in `activeTab.elements` (DOM/z-order) that's in
  // the current selection. Used as the "primary" for toggle setters
  // (lock, bold, etc.) — read its current value, apply the inverse
  // to every selected element. Returns null when nothing is selected.
  const selectionPrimary = (): Element | null => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return null;
    return activeTab.elements.find((el) => ids.has(el.id)) ?? null;
  };

  // --- Modes ---------------------------------------------------------------

  const exitFormatPainter = () => setFormatSourceId(null);
  const exitGroupMode = () => setGroupSourceId(null);

  const applyFormatFromSource = (targetId: string) => {
    if (!formatSourceId) return;
    const source = activeTab.elements.find((el) => el.id === formatSourceId);
    const target = activeTab.elements.find((el) => el.id === targetId);
    if (!source || !target || source.id === target.id) {
      setFormatSourceId(null);
      return;
    }
    track('Element', 'Changed', 'FormatPainter');
    // Field projections live in lib/format-painter.ts so the list
    // of painted fields (and the rule that future additions to
    // BoxedElement / ArrowElement must be opted into the painter
    // by hand) is one tested source of truth. Boxed-to-arrow and
    // arrow-to-boxed paints are no-ops: the two kinds share
    // almost no formattable fields.
    if (isBoxed(source) && isBoxed(target)) {
      const projection = paintableBoxedFields(source);
      commit((els) =>
        els.map((el) =>
          el.id === targetId && isBoxed(el) ? ({ ...el, ...projection } as typeof el) : el,
        ),
      );
    } else if (source.type === 'arrow' && target.type === 'arrow') {
      const projection = paintableArrowFields(source);
      commit((els) =>
        els.map((el) =>
          el.id === targetId && el.type === 'arrow' ? ({ ...el, ...projection } as typeof el) : el,
        ),
      );
    }
    setFormatSourceId(null);
  };

  const completeGrouping = (targetId: string) => {
    if (!groupSourceId) return;
    commit((els) => joinGroups(els, groupSourceId, targetId));
    setSelectedId(targetId);
  };

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

  const openTemplatePicker = () => {
    setTemplatePickerMode('templates');
    commitTabs((ts) => patchTab(ts, activeId, { templateChosen: false }));
  };

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

  // Dismiss the template / identity modal without picking anything.
  // Welcome (first-run "New Diagram") lives on /live/new post-spec/14
  // — this route only ever sees identity (visitor join) and templates
  // (per-tab scaffold) modes.
  const skipTemplatePicker = () => {
    if (templatePickerMode === 'identity') {
      confirmName();
      setTemplatePickerMode('welcome');
      return;
    }
    commitTabs((ts) => patchTab(ts, activeId, { templateChosen: true }));
    confirmName();
    setTemplatePickerMode('welcome');
  };

  const chooseTemplate = async (kind: TemplateKind, name?: string, themeId?: ThemeId) => {
    // Identity-only mode: the visitor is joining an existing diagram.
    // No template scaffold, no theme application — just commit the name
    // and dismiss the modal.
    if (templatePickerMode === 'identity') {
      if (name && name !== selfParticipant.name) {
        setSelfParticipant((p) => ({ ...p, name }));
      }
      confirmName();
      setTemplatePickerMode('welcome');
      return;
    }
    // Telemetry (spec/22): a template was applied; `type` is the kind.
    // The picker also lets the user pick a theme alongside the template,
    // so emit Theme / Changed in the same flow that /live/new uses for
    // its symmetric "create with a chosen theme" event.
    track('Template', 'Used', titleCaseType(kind));
    if (themeId) {
      const themeLabel =
        THEMES.find((t) => t.id === themeId)?.label ??
        themeId.charAt(0).toUpperCase() + themeId.slice(1);
      track('Theme', 'Changed', themeLabel);
    }
    // Templates flow: applying a template / theme to an existing tab.
    // The diagram already exists in D1; no mint required.
    if (name && name !== selfParticipant.name) {
      setSelfParticipant((p) => ({ ...p, name }));
    }
    confirmName();
    setTemplatePickerMode('welcome');
    const centre = getViewportCenter();
    // Dynamic-import the heavy builders module only when the user
    // actually picks a template. The ~1700 lines of build* code stays
    // out of the editor's initial chunk; returning users opening an
    // existing diagram never download it.
    const { buildTemplate } = await import('@/lib/template-builders');
    const rawElements = buildTemplate(kind, centre.x, centre.y);
    const theme = themeId ? getTheme(themeId) : null;
    // Repaint the scaffold with the chosen theme so the Mind map circles,
    // Org chart boxes etc. land in the user's selected colours rather
    // than the hard-coded brand defaults from `buildTemplate`. Sticky
    // notes (Retrospective) keep their amber identity — same rule
    // `addBoxed` applies to ad-hoc sticky creation.
    // Shared recolour helper so the in-editor template picker
    // can't drift from the /live/new path (`buildTemplatedTab` in
    // lib/templates.ts uses the same function). The previous
    // inline copy here omitted the arrow case, so arrows in
    // mindmap / flowchart / flywheel templates picked from inside
    // the editor stayed brand-blue instead of inheriting the
    // theme's stroke colour.
    const elements = !theme
      ? rawElements
      : rawElements.map((el) => recolourElementForTheme(el, theme));
    // Apply the picker's theme choice at the same time as the
    // template scaffold so the user lands on a fully themed canvas
    // in one step instead of having to revisit the Theme accordion.
    const patch: Partial<Tab> = {
      elements,
      templateChosen: true,
      ...(theme && themeId
        ? {
            theme: themeId,
            backgroundColor: theme.backgroundColor,
            backgroundPattern: theme.backgroundPattern,
            patternColor: theme.patternColor,
          }
        : {}),
      ...templateCanvasOverrides(kind),
    };
    commitTabs((ts) => patchTab(ts, activeId, patch));
    // Auto-select when a template produces a single element (today: blank
    // diagram's seeded rectangle) so the user can immediately rename or edit
    // it. Multi-element templates leave the selection cleared.
    setSelectedId(elements.length === 1 ? elements[0]!.id : null);
    setEditingId(null);
  };

  // Open one of the Tab section accordions inside the Editor panel,
  // popping the panel back if it was minimised. Both context-menu
  // actions ("Change Theme", "Change Canvas") route here rather than
  // introducing a new picker dialog.
  const openTabAccordion = (which: 'theme' | 'canvas') => {
    requestEditorOpen();
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

  const addShape = (kind: ShapeKind) => {
    if (editsBlocked) return;
    if (beginDrawIfEnabled({ type: 'shape', kind })) return;
    addBoxed((x, y) => createShape(kind, x, y));
    // Telemetry (spec/22): element added; `type` is the shape kind
    // (a preset enum, e.g. "Square"), never user content.
    track('Element', 'Added', titleCaseType(kind));
  };

  const addText = () => {
    if (editsBlocked) return;
    if (beginDrawIfEnabled({ type: 'text' })) return;
    addBoxed((x, y) => createText(x, y));
    track('Element', 'Added', 'Text');
  };
  const addSticky = () => {
    if (editsBlocked) return;
    if (beginDrawIfEnabled({ type: 'sticky' })) return;
    addBoxed((x, y) => createSticky(x, y));
    track('Element', 'Added', 'Sticky');
  };

  // Drop a plain connector at the viewport centre. Defaults to no
  // pointers ('none') so the palette entry behaves like a "Line" tool;
  // the user can change pointer style later via the Pointer accordion.
  // Endpoints are free (unpinned) — drag them onto shapes after the
  // fact to pin to anchors.
  const addArrow = () => {
    if (editsBlocked) return;
    if (beginDrawIfEnabled({ type: 'arrow' })) return;
    const centre = getViewportCenter();
    const halfLen = 80;
    const theme = getTheme(activeTab.theme);
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'free', x: centre.x - halfLen, y: centre.y },
      to: { kind: 'free', x: centre.x + halfLen, y: centre.y },
      arrowEnds: 'none',
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
    };
    const before = activeTab.elements;
    const after = [...before, arrow];
    commitTabs((ts) => patchTab(ts, activeId, { elements: after, templateChosen: true }));
    // Same activity-log emit as addBoxed: commit() does this for
    // element-only commits, but this path also touches
    // templateChosen on the tab so we use commitTabs and emit
    // explicitly.
    emitChange(activeId, before, after);
    setSelectedId(arrow.id);
    track('Element', 'Added', 'Arrow');
  };

  const handleCanvasDoubleClick = (x: number, y: number) => {
    const TEXT_W = 160;
    const TEXT_H = 48;
    const el = createText(x - TEXT_W / 2, y - TEXT_H / 2);
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId ? { ...t, elements: [...t.elements, el], templateChosen: true } : t,
      ),
    );
    setSelectedId(el.id);
    setEditingId(el.id);
  };

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

  const beginFormatPainter = () => {
    if (!selectedId) return;
    setFormatSourceId(selectedId);
    setGroupSourceId(null);
  };

  const beginGroup = () => {
    if (!selectedId) return;
    setGroupSourceId(selectedId);
    setFormatSourceId(null);
  };

  const beginEdit = (elementId: string) => {
    // Viewers may select to inspect, but never enter text-edit mode.
    if (isReadOnly) return;
    if (formatSourceId !== null) return;
    setGroupSourceId(null);
    setSelectedId(elementId);
    setEditingId(elementId);
  };

  const commitLabel = (elementId: string, label: string) => {
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId) return el;
        // Boxed elements always carry a label; arrows treat an empty
        // string as "no label" and drop the field so the data model
        // round-trips cleanly through API JSON.
        if (isBoxed(el)) return { ...el, label };
        if (el.type === 'arrow') {
          if (label.length === 0) {
            const { label: _drop, ...rest } = el;
            void _drop;
            return rest;
          }
          return { ...el, label };
        }
        return el;
      }),
    );
    setEditingId(null);
    // While the diagram is still on its default name, mirror the label of
    // the very first element of the very first tab into the diagram title:
    // typing on the welcome rectangle is a strong signal of intent. Once
    // the user has explicitly named the diagram (or named it via another
    // path), we stop tracking.
    const trimmed = label.trim();
    if (diagramName === 'Untitled diagram') {
      const firstTab = tabs[0];
      const firstEl = firstTab?.elements[0];
      if (firstEl && firstEl.id === elementId) {
        if (trimmed && trimmed !== 'Blank Diagram') {
          setDiagramName(trimmed);
        }
      }
    }
    // Parallel auto-rename for the active tab while its name still matches
    // the default `Tab N` pattern: the first element's label becomes the
    // tab name. Fires at most once per tab (any non-default name stops the
    // gate, including the auto-renamed value itself). See spec/05.
    if (trimmed && /^Tab \d+$/.test(activeTab.name)) {
      const firstEl = activeTab.elements[0];
      if (firstEl && firstEl.id === elementId) {
        commitTabs((ts) => patchTab(ts, activeTab.id, { name: trimmed }));
      }
    }
  };

  const cancelEdit = () => setEditingId(null);

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

  // Type-to-edit (spec/09 Labels): a printable key on a single selected
  // element opens its label editor seeded with that character. Returns
  // true when it took over (so the caller swallows the key); false for
  // a non-labelable selection (image / freehand) so the tool shortcuts
  // still work there.
  const typeIntoSelected = (elementId: string, char: string): boolean => {
    if (isReadOnly) return false;
    const el = activeTab.elements.find((e) => e.id === elementId);
    if (!el) return false;
    const labelable = isBoxed(el) || el.type === 'arrow';
    if (!labelable) return false;
    commit((els) => els.map((e) => (e.id === elementId ? { ...e, label: char } : e)));
    setSelectedId(elementId);
    setEditingId(elementId);
    return true;
  };

  // --- Selection + drag dispatch ------------------------------------------

  const selectElement = (id: string) => {
    if (formatSourceId !== null) {
      // Format-paint mode: apply the source's formatting to the
      // clicked target instead of selecting it. applyFormatFromSource
      // clears formatSourceId itself; it handles boxed→boxed and
      // arrow→arrow, no-ops cross-kind.
      applyFormatFromSource(id);
      return;
    }
    if (groupSourceId !== null) {
      setGroupSourceId(null);
      return;
    }
    setSelectedId(id);
    // Clicking a single element always collapses any active multi-selection
    // down to that one element — the user's intent is unambiguous.
    setMultiSelectedIds(new Set());
  };

  // Shift-click membership toggle. Folds a current single-selection
  // into the multi-set so users can promote "I already had A
  // selected, now also B and C" without first dropping to nothing.
  // Toggling the last member out of the multi-set drops back to
  // empty selection.
  const toggleInMultiSelect = (id: string) => {
    const next = new Set(multiSelectedIds);
    if (selectedId && !next.has(selectedId)) next.add(selectedId);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedId(null);
    setMultiSelectedIds(next);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

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

  if (diagramNotFound) {
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          diagramName="Diagram not found"
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
        <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
          <NotFound
            onCreateNew={() => {
              window.location.assign(`${window.location.origin}/live/new`);
            }}
          />
          <Explorer
            position={explorerPosition}
            diagrams={diagramList}
            folders={folders}
            loading={diagramListLoading}
            shared={sharedDiagrams}
            onDismissShared={dismissSharedDiagram}
            onOpenFullExplorer={
              isSignedIn
                ? () => window.location.assign(`${window.location.origin}/live/explorer`)
                : undefined
            }
            currentDiagramId={null}
            onMoveTo={(x, y) => setExplorerPosition({ x, y })}
            onReset={() => setExplorerPosition(null)}
            onOpenDiagram={openDiagram}
            onNewDiagram={newDiagram}
            onDeleteDiagram={deleteDiagram}
            onDuplicateDiagram={(id) => void duplicateDiagram(id)}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onMoveDiagramToFolder={moveDiagramToFolder}
          />
        </main>
      </div>
    );
  }

  // Password gate (spec/24): a visitor opened a protected diagram's
  // share link and hasn't supplied a valid password yet. Submitting
  // sets the session password and bumps passwordRetry to re-run the
  // bootstrap, which now carries the password on every request.
  if (sharePasswordGate) {
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          diagramName="Password required"
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
        <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
          <SharePasswordGate
            invalid={sharePasswordGate.invalid}
            ownerName={diagramOwnerName}
            onSubmit={(pw) => {
              setSharePasswordGate(null);
              setSessionSharePassword(pw);
              setLoadingDiagram(true);
              setPasswordRetry((n) => n + 1);
            }}
          />
        </main>
      </div>
    );
  }

  if (loadingDiagram) {
    return (
      <div className="flex h-dvh flex-col">
        <DiagramLoading />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <EditorHeader
        diagramName={diagramName}
        hideTitle={anyWelcomeOpen}
        showShare={isOwner && hydrated && !anyWelcomeOpen}
        shareable={diagramShareable}
        // Visitors see "Make a copy" instead of "Share": same slot,
        // different action. Hidden during the welcome flow so the
        // first-paint chrome stays minimal, and during hydration so
        // we don't render the button before we know whether the user
        // is the owner.
        onMakeCopy={!isOwner && hydrated && !anyWelcomeOpen && diagramId ? makeCopy : undefined}
        copying={copying}
        readOnly={isReadOnly}
        brandAccent={getTheme(activeTab.theme).elementStroke ?? undefined}
        onOpenShare={() => {
          setShareDialogOpen(true);
          track('UI', 'Opened', 'Share');
        }}
        onRename={(next) => {
          const prev = diagramName.trim();
          const nextTrim = next.trim();
          setDiagramName(next);
          if (nextTrim && nextTrim !== prev) track('Diagram', 'Renamed');
        }}
      />
      {exportOpen ? (
        <ExportTabDialog
          tab={activeTab}
          diagramName={diagramName}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
      {shareDialogOpen ? (
        <ShareDialog
          participant={selfParticipant}
          links={shareLinks}
          sharePassword={sharePassword}
          shareUrlFor={shareUrlFor}
          nameConfirmed={nameConfirmed}
          // Signed-in via Clerk → name is locked to the account
          // display name (same rule as the welcome modal, spec/04).
          // Guests pass undefined so the input + shuffle stay live.
          lockedName={clerkUserId ? clerkDisplayName : null}
          onSaveName={updateParticipantName}
          onCreateLink={createShareLink}
          onRevokeLink={revokeShareLink}
          onSetPassword={setDiagramSharePassword}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
      <Canvas
        tabName={activeTab.name}
        tabLocked={activeTabLocked}
        readOnly={isReadOnly}
        ownerParticipant={(() => {
          // Three-tier resolution for the top-middle "Owner" badge:
          //   1. Self IS the owner -> always have name + colour.
          //   2. Owner is currently in the room -> use the live
          //      presence row so the avatar matches what visitors
          //      see in the TabBar.
          //   3. Owner is offline -> fall back to the joined name
          //      + colour we got from the diagram fetch
          //      (api worker LEFT JOINs participants on owner_id).
          // Returning null only when the owner truly has no
          // participant record on the server.
          if (isOwner) return selfParticipant;
          const live = livePresence.find((p) => p.id === diagramOwnerId);
          if (live) return live;
          if (diagramOwnerId && diagramOwnerName) {
            return {
              id: diagramOwnerId,
              name: diagramOwnerName,
              color: diagramOwnerColor ?? '#94a3b8',
              status: 'offline' as const,
            };
          }
          return null;
        })()}
        isOwner={isOwner}
        diagramName={diagramName}
        tabBackgroundPattern={activeTab.backgroundPattern ?? 'grid'}
        tabBackgroundColor={activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
        tabBackgroundOpacity={activeTab.backgroundOpacity ?? 1}
        tabPatternColor={activeTab.patternColor ?? DEFAULT_PATTERN_COLOR}
        mainRef={canvasMainRef}
        isPinchingRef={isPinchingRef}
        viewportZoom={viewportZoom}
        setViewportZoom={setViewportZoom}
        onFitToScreen={() => {
          fitToScreen();
          track('Canvas', 'Zoomed', 'Fit');
        }}
        viewportOffset={viewportOffset}
        setViewportOffset={setViewportOffset}
        elements={activeTab.elements}
        selectedId={selectedId}
        multiSelectedIds={multiSelectedIds}
        remoteSelectionsByElement={remoteSelectionsByElement}
        remoteCursors={remoteCursorRows}
        laserTrails={laserTrailRows}
        onCanvasPointerMove={(x, y) => {
          if (canvasTool === 'laser' && x !== null && y !== null) {
            broadcastLaser(x, y);
            // Laser mode hides the cursor indicator on peer screens —
            // the laser dot is the cursor. Clear any prior position.
            broadcastCursor(null);
            return;
          }
          broadcastCursor(x !== null && y !== null ? { x, y } : null);
        }}
        onSelectMarquee={selectMarquee}
        canvasTool={canvasTool}
        onSetCanvasTool={setCanvasTool}
        onDuplicateMultiSelected={duplicateMultiSelected}
        onDeleteMultiSelected={deleteMultiSelected}
        onGroupMultiSelected={groupMultiSelected}
        onToggleLockMultiSelected={toggleLockMultiSelected}
        editingId={editingId}
        formatSourceId={formatSourceId}
        groupSourceId={groupSourceId}
        palettePosition={palettePosition}
        explorerPosition={explorerPosition}
        canUndo={canUndo && !activeTabLocked}
        canRedo={canRedo && !activeTabLocked}
        onAddShape={addShape}
        onAddText={addText}
        onAddSticky={addSticky}
        onAddImage={addImage}
        onAddArrow={addArrow}
        onBeginFreehand={beginFreehand}
        pendingDraw={pendingDraw}
        onCommitDraw={commitDraw}
        onCommitFreehand={commitFreehand}
        recogniseShapes={userPreferences.recogniseShapes === true}
        onToggleRecogniseShapes={() => {
          const next: UserPreferences = {
            ...userPreferences,
            recogniseShapes: userPreferences.recogniseShapes !== true,
          };
          // Telemetry (spec/22): emit BEFORE persistence so the
          // flip itself reaches the wire even when the new state
          // would suppress emission later (matches how
          // TelemetryOn / TelemetryOff are handled in the
          // Settings dialog).
          track('UI', 'Toggled', next.recogniseShapes ? 'RecogniseShapesOn' : 'RecogniseShapesOff');
          setUserPreferences(next);
          writeUserPreferences(next, selfParticipant?.id ?? null);
        }}
        onCancelDraw={cancelDrawShape}
        onUndo={undo}
        onRedo={redo}
        onMovePalette={(x, y) => setPalettePosition({ x, y })}
        onResetPalette={() => setPalettePosition(null)}
        onMoveExplorer={(x, y) => setExplorerPosition({ x, y })}
        onResetExplorer={() => setExplorerPosition(null)}
        diagramList={diagramList}
        folders={folders}
        sharedDiagrams={sharedDiagrams}
        onDismissShared={dismissSharedDiagram}
        onOpenFullExplorer={
          isSignedIn
            ? () => window.location.assign(`${window.location.origin}/live/explorer`)
            : undefined
        }
        diagramListLoading={diagramListLoading}
        changeLog={changeLog.filter((entry) => entry.tabId === activeId)}
        changeLogLoading={changeLogLoading}
        activityPosition={activityPosition}
        activityMinimized={activityMinimized}
        onMoveActivity={(x, y) => setActivityPosition({ x, y })}
        onToggleActivityMinimized={() => {
          // Emit only the open transition (minimized -> expanded);
          // closing isn't a feature-reach signal. The closure read is
          // safe because this is a single user click, not a rapid
          // race, so no stale-state risk.
          if (activityMinimized) track('UI', 'Opened', 'Activity');
          setActivityMinimized((v) => !v);
        }}
        onResetActivity={() => setActivityPosition(null)}
        commentRows={commentRows}
        commentsPanelPosition={commentsPanelPosition}
        onMoveCommentsPanel={(x, y) => setCommentsPanelPosition({ x, y })}
        onResetCommentsPanel={() => setCommentsPanelPosition(null)}
        onOpenCommentsForElement={(id) => {
          setSelectedId(id);
          openComments(id);
        }}
        contextPosition={contextPosition}
        tabAccordionsOpen={tabAccordionsOpen}
        setTabAccordionsOpen={setTabAccordionsOpen}
        editorExpandSignal={editorExpandSignal}
        onMoveContext={(x, y) => setContextPosition({ x, y })}
        onResetContext={() => setContextPosition(null)}
        onRevertChange={revertChange}
        onActivityRowClick={handleActivityRowClick}
        onClearActivity={isReadOnly ? undefined : clearActivityForActiveTab}
        saveStatus={saveStatus}
        savedAt={savedAt}
        currentDiagramId={diagramId}
        onOpenDiagram={openDiagram}
        onNewDiagram={newDiagram}
        onRenameCurrent={(next) => {
          const prev = diagramName.trim();
          const nextTrim = next.trim();
          setDiagramName(next);
          if (nextTrim && nextTrim !== prev) track('Diagram', 'Renamed');
        }}
        onDeleteDiagram={deleteDiagram}
        onDuplicateDiagram={(id) => void duplicateDiagram(id)}
        onCreateFolder={createFolder}
        onRenameFolder={renameFolder}
        onDeleteFolder={deleteFolder}
        onMoveDiagramToFolder={moveDiagramToFolder}
        onDeselect={() => {
          setSelectedId(null);
          setMultiSelectedIds(new Set());
          setEditingId(null);
          setFormatSourceId(null);
          setGroupSourceId(null);
          setContextMenu(null);
        }}
        onSelect={selectElement}
        onElementContextMenu={
          isReadOnly
            ? undefined
            : (id, sx, sy) => setContextMenu({ mode: 'element', elementId: id, x: sx, y: sy })
        }
        onOpenElementContextMenu={
          isReadOnly
            ? undefined
            : (id, sx, sy) => setContextMenu({ mode: 'element', elementId: id, x: sx, y: sy })
        }
        onCanvasContextMenu={
          isReadOnly ? undefined : (sx, sy) => setContextMenu({ mode: 'canvas', x: sx, y: sy })
        }
        onBeginDrag={beginDrag}
        onBeginAnchorDrag={beginAnchorDrag}
        onBeginEdit={beginEdit}
        onCommitLabel={commitLabel}
        onCancelEdit={cancelEdit}
        onBeginEndpointDrag={beginEndpointDrag}
        onBeginArrowTranslate={beginArrowTranslate}
        onBeginArrowCurveDrag={beginArrowCurveDrag}
        onBeginArrowElbowDrag={beginArrowElbowDrag}
        onShiftSelect={toggleInMultiSelect}
        onBeginFormatPainter={beginFormatPainter}
        onCancelFormatPainter={exitFormatPainter}
        onBeginGroup={beginGroup}
        onCancelGroup={exitGroupMode}
        onUngroup={ungroupSelected}
        onBringToFront={bringSelectedToFront}
        onSendToBack={sendSelectedToBack}
        onSetTextSize={setTextSizeSelected}
        onSetTextAlign={setTextAlignSelected}
        onToggleTextBold={() => toggleTextStyleSelected('textBold')}
        onToggleTextItalic={() => toggleTextStyleSelected('textItalic')}
        onToggleTextUnderline={() => toggleTextStyleSelected('textUnderline')}
        onToggleTextStrikethrough={() => toggleTextStyleSelected('textStrikethrough')}
        onSetFillColor={setFillColorSelected}
        onSetStrokeColor={setStrokeColorSelected}
        onSetTextColor={setTextColorSelected}
        onSetOpacity={setOpacitySelected}
        onResetColors={resetColorsSelected}
        onSetPadding={setPaddingSelected}
        onSetArrowEnds={setArrowEndsSelected}
        onSetArrowThickness={setArrowThicknessSelected}
        onSetArrowheadSize={setArrowheadSizeSelected}
        onSetArrowStyle={setArrowStyleSelected}
        onSetArrowStrokeStyle={setArrowStrokeStyleSelected}
        onSetShapeKind={setShapeKindSelected}
        onSetBorderStroke={setBorderStrokeSelected}
        onSetBorderStyle={setBorderStyleSelected}
        onSetBorderRadius={setBorderRadiusSelected}
        onFollowLink={followLink}
        onOpenComments={openComments}
        onOpenNote={openNote}
        imageContext={imageContext}
        showTemplatePicker={
          // Wait for the active tab's content to land before
          // deciding whether to show the picker. Otherwise the
          // empty-elements / templateChosen-unset placeholder
          // briefly trips the gate after hydration, causing a
          // "pick a template" flash before the real content
          // pops in. `loadedTabIds.has(activeId)` flips true
          // once the lazy fetch resolves.
          //
          // View-role visitors never see the picker: they can't
          // commit a template anyway (every write goes through
          // a 403), so the prompt would just be a dead-end UI.
          !isReadOnly &&
          ((hydrated &&
            loadedTabIds.has(activeId) &&
            activeTab.elements.length === 0 &&
            activeTab.templateChosen !== true) ||
            identityOnlyScreenOpen)
        }
        hydrated={hydrated}
        templatePickerMode={effectiveTemplatePickerMode}
        // Visitor on someone else's diagram + signed in → lock the
        // identity input to their Clerk name. Owner branch never
        // shows the identity prompt so `lockedName` is moot there;
        // pure guests pass null and keep the editable name field.
        templatePickerLockedName={!isOwner && clerkUserId ? clerkDisplayName : null}
        welcomeOpen={anyWelcomeOpen}
        selfParticipant={selfParticipant}
        onChooseTemplate={chooseTemplate}
        onSkipTemplatePicker={skipTemplatePicker}
        onOpenTemplatePicker={openTemplatePicker}
        tabThemeId={(activeTab.theme as ThemeId | undefined) ?? 'brand'}
        onSetTheme={setTheme}
        onResetElementsToTheme={resetElementsToTheme}
        importError={importError}
        onAutoAlign={hydrated && !anyWelcomeOpen && !isReadOnly ? autoAlignTab : undefined}
        canAutoAlign={activeTab.elements.length > 0 && !activeTabLocked}
        imageDiagramId={!isReadOnly && diagramId ? diagramId : undefined}
        imageShareCode={sessionShareCode}
        onAddImageFromGallery={!isReadOnly && diagramId ? addImageFromGallery : undefined}
        onSetBackgroundPattern={setBackgroundPattern}
        onSetBackgroundColor={setBackgroundColor}
        onSetBackgroundOpacity={setBackgroundOpacity}
        onSetPatternColor={setPatternColor}
        onToggleAspectLock={toggleAspectLockSelected}
        onDuplicateConnect={duplicateConnectSelected}
        onToggleLockSelected={toggleLockSelected}
        onDeleteSelected={deleteSelected}
        onCanvasDoubleClick={handleCanvasDoubleClick}
      />
      {anyWelcomeOpen ? null : (
        <TabBar
          tabs={tabs}
          activeId={activeId}
          activeTabHasContent={activeTab.elements.length > 0}
          onSelect={(id) => {
            setActiveId(id);
            setSelectedId(null);
            setMultiSelectedIds(new Set());
            setEditingId(null);
            setFormatSourceId(null);
            setGroupSourceId(null);
          }}
          onAdd={addTab}
          onRename={renameTab}
          onDuplicate={duplicateTab}
          onDelete={deleteTab}
          onClearContent={clearTabContent}
          onImportTab={() => void importTabFromFile()}
          onExportTab={() => setExportOpen(true)}
          otherDiagrams={diagramList.filter((d) => d.id !== diagramId)}
          onCopyTabTo={linkActiveTabTo}
          onToggleLockTab={toggleActiveTabLock}
          onReorder={reorderTabs}
          readOnly={isReadOnly}
          participantsByTab={participantsByTab}
          selfId={selfParticipant.id}
          selfRole={sessionRole}
          onOpenShortcuts={() => {
            setShortcutsOpen(true);
            track('UI', 'Opened', 'Shortcuts');
          }}
          onOpenSettings={() => {
            // Preferences are user-scoped, not diagram-scoped, so
            // view-role visitors can still flip them for their own
            // browser (e.g. opt out of telemetry).
            setSettingsOpen(true);
            track('UI', 'Opened', 'Settings');
          }}
          onOpenSearch={() => setSearchOpen(true)}
        />
      )}
      {searchOpen ? (
        <SearchPanel
          diagrams={diagramList.map((d) => ({ id: d.id, name: d.name }))}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
          tabs={tabs}
          currentTabId={activeId}
          onSelectDiagram={(id) => {
            openDiagram(id);
          }}
          onSelectTab={(tabId) => {
            setActiveId(tabId);
            setSelectedId(null);
          }}
          onSelectElement={(tabId, elementId) => {
            setActiveId(tabId);
            setSelectedId(elementId);
          }}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
      {shortcutsOpen ? (
        <ShortcutsDialog
          enabled={shortcutsEnabled}
          onToggleEnabled={setShortcutsEnabled}
          onClose={() => setShortcutsOpen(false)}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsDialog
          settings={userPreferences}
          onChange={(next) => {
            setUserPreferences(next);
            // Pass the resolved owner id so the new prefs round-trip
            // to D1 (spec/20). selfParticipant?.id is null until the
            // identity effect resolves it, but settingsOpen can't be
            // true until the user clicks the gear, which only renders
            // after that effect ran, so the id is always set here.
            writeUserPreferences(next, selfParticipant?.id ?? null);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {commentThreadOpenId !== null
        ? (() => {
            const target = activeTab.elements.find(
              (el) => el.id === commentThreadOpenId && isBoxed(el),
            );
            if (!target || !isBoxed(target)) return null;
            return (
              <CommentThreadPopover
                elementId={target.id}
                thread={target.commentThread}
                onAddComment={(text) => {
                  addComment(target.id, text);
                  track('Comment', 'Added');
                  // View-role visitors don't autosave the tab, so
                  // their addComment via the local commit alone
                  // would vanish on refresh. Persist via the
                  // dedicated POST /tabs/<id>/comments endpoint
                  // (the only write path open to view-role) so the
                  // viewer's contribution lives in D1 like an
                  // owner / editor's would.
                  if (isReadOnly && diagramId) {
                    void apiAddComment(
                      selfParticipant.id,
                      diagramId,
                      activeTab.id,
                      target.id,
                      text,
                      sessionShareCode,
                    ).catch(() => {});
                  }
                }}
                onDeleteComment={(cid) => {
                  deleteComment(target.id, cid);
                  track('Comment', 'Deleted');
                }}
                onResolve={() => {
                  resolveThread(target.id);
                  track('Comment', 'Resolved');
                }}
                onUnresolve={() => {
                  unresolveThread(target.id);
                  track('Comment', 'Unresolved');
                }}
                onClose={closeComments}
                readOnly={isReadOnly}
              />
            );
          })()
        : null}
      {noteOpenId !== null && !isReadOnly
        ? (() => {
            const target = activeTab.elements.find((el) => el.id === noteOpenId && isBoxed(el));
            if (!target || !isBoxed(target)) return null;
            return (
              <NotePopover
                elementId={target.id}
                initial={target.note ?? ''}
                onCommit={(next) => {
                  const prev = (target.note ?? '').trim();
                  const nextTrim = next.trim();
                  setNote(target.id, next);
                  if (prev === nextTrim) return;
                  if (!prev && nextTrim) track('Note', 'Added');
                  else if (prev && !nextTrim) track('Note', 'Deleted');
                  else track('Note', 'Changed');
                }}
                onClose={closeNote}
              />
            );
          })()
        : null}
      {contextMenu && !isReadOnly ? (
        <EditorContextMenu
          menu={contextMenu}
          elements={activeTab.elements}
          onClose={closeContextMenu}
          onDuplicate={duplicateSelected}
          onLinkElement={setLinkPickerOpenForId}
          onBringToFront={bringSelectedToFront}
          onSendToBack={sendSelectedToBack}
          onOpenNote={openNote}
          onOpenComments={openComments}
          onChangeTheme={() => openTabAccordion('theme')}
          onChangeCanvas={() => openTabAccordion('canvas')}
          onAutoAlign={autoAlignTab}
          onAddShape={addShape}
          onAddSticky={addSticky}
        />
      ) : null}
      {linkPickerOpenForId !== null && linkPickerAnchorEl && !isReadOnly ? (
        <TabLinkPicker
          anchor={linkPickerAnchorEl}
          tabs={tabs}
          currentTabId={activeId}
          linkedTabId={(() => {
            const el = activeTab.elements.find((e) => e.id === linkPickerOpenForId);
            return el && el.link && el.link.kind === 'tab' ? el.link.tabId : null;
          })()}
          linkedDiagramId={(() => {
            const el = activeTab.elements.find((e) => e.id === linkPickerOpenForId);
            return el && el.link && el.link.kind === 'diagram' ? el.link.diagramId : null;
          })()}
          recentDiagrams={diagramList
            .filter((d) => d.id !== diagramId)
            .slice(0, 5)
            .map((d) => ({ id: d.id, name: d.name }))}
          onSelect={(tabId) => {
            setLinkSelected(tabId);
            setLinkPickerOpenForId(null);
            track('Element', 'Linked', 'Tab');
          }}
          onSelectDiagram={(d) => {
            setDiagramLinkSelected(d);
            setLinkPickerOpenForId(null);
            track('Element', 'Linked', 'Diagram');
          }}
          onClear={() => {
            clearLinkSelected();
            setLinkPickerOpenForId(null);
            track('Element', 'Unlinked');
          }}
          onClose={() => setLinkPickerOpenForId(null)}
        />
      ) : null}
      {imagePickerOpenFor && diagramId && !isReadOnly ? (
        <ImagePicker
          ownerId={selfParticipant.id}
          diagramId={diagramId}
          forElementId={imagePickerOpenFor.forElementId}
          currentImageId={(() => {
            const targetId = imagePickerOpenFor.forElementId;
            if (!targetId) return null;
            const el = activeTab.elements.find((e) => e.id === targetId);
            return el && isBoxed(el) && el.type === 'image' ? el.imageId : null;
          })()}
          onRemove={
            imagePickerOpenFor.forElementId
              ? () => removeImageFromElement(imagePickerOpenFor.forElementId!)
              : undefined
          }
          onSelect={(image) => {
            if (imagePickerOpenFor.forElementId) {
              applyImageToElement(imagePickerOpenFor.forElementId, image);
            } else {
              closeImagePicker();
            }
            // Refresh the Current Tab → Images accordion so the
            // just-uploaded image surfaces without a diagram reload.
            refreshRecentImages(selfParticipant.id);
          }}
          onClose={closeImagePicker}
        />
      ) : null}
    </div>
  );
}
