'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  anchorPosition,
  ARROW_THICKNESS_PX,
  bringManyToFront,
  createComment,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  duplicateGroupedElements,
  endpointPosition,
  isBoxed,
  joinGroups,
  selectionMembers,
  sendManyToBack,
  snapResizeBounds,
  snapToAlignment,
  snapToAnchor,
  ungroup,
  unionBoxedBounds,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  deriveShapeColours,
  deriveTextColorForBg,
  type Anchor,
  type ArrowElement,
  type BackgroundPattern,
  type BoxedElement,
  type Element,
  type Endpoint,
  type ShapeKind,
  type Tab,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { Canvas } from '@/components/Canvas';
import { CommentThreadPopover } from '@/components/CommentThreadPopover';
import { EditorHeader, type SaveStatus } from '@/components/EditorHeader';
import { ExportTabDialog } from '@/components/ExportTabDialog';
import { parseImportedTab, pickTabFile } from '@/lib/import-tab';
import { Explorer } from '@/components/Explorer';
import { NotFound } from '@/components/NotFound';
import { ShareDialog } from '@/components/ShareDialog';
import { TabBar } from '@/components/TabBar';
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import { useDiagramHistory } from '@/hooks/useDiagramHistory';
import { useFolders } from '@/hooks/useFolders';
import { duplicateDiagram as duplicate } from '@/lib/duplicate-diagram';
import {
  ALIGN_SNAP_THRESHOLD,
  arrowReferencesAny,
  MIN_SIZE,
  nextBounds,
  SNAP_THRESHOLD,
  type ArrowEnd,
  type DragMode,
  type DragState,
  type ShapeBounds,
} from '@/lib/canvas';
import {
  nextFreeColor,
  randomColor,
  randomName,
  statusFromIdleMs,
  type Participant,
} from '@/lib/identity';
import {
  getGuestSelfId,
  hasConfirmedName,
  markNameConfirmed,
  setGuestSelfId,
} from '@/lib/local-identity';
import {
  apiAppendChangeLogEntry,
  apiCreateShareLink,
  apiDeleteChangeLogEntry,
  apiDeleteChangeLogForTab,
  apiDeleteDiagram,
  apiDeleteShareLink,
  apiDeleteTab,
  apiListChangeLog,
  apiCopyDiagram,
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
  apiSaveTab,
  apiSetDiagramFolder,
  connectRoom,
  type ChangeLogEntry,
  type RoomHandlers,
  type ShareLink,
  type ShareRole,
} from '@/lib/api-client';
import { applyRevert, diffElements } from '@/lib/change-log';
import { buildTemplate, templateCanvasOverrides, type TemplateKind } from '@/lib/templates';
import { getTheme, THEMES, type ThemeId } from '@/lib/themes';

function createTab(name: string): Tab {
  return { id: crypto.randomUUID(), name, elements: [] };
}

// Mirrors useDiagramHistory.HISTORY_LIMIT — we can't undo past what
// the state-snapshot stack remembers, so there's no point in tracking
// more log entries than that. Bumping HISTORY_LIMIT in useDiagramHistory
// should bump this too.
const LOG_HISTORY_LIMIT = 3;

// Bound a laser-trail buffer in both dimensions: cap at 60 points and
// drop any sample older than LASER_BUFFER_TTL_MS. Called on every
// append (local broadcast + remote receive), so even a flood from a
// misbehaving peer can't grow the buffer without bound. The overlay
// has its own (shorter) fade window — LIFETIME_MS — so points
// between LIFETIME_MS and TTL_MS are buffered but render at 0
// opacity, protecting against frame jitter at the fade boundary.
const LASER_BUFFER_TTL_MS = 1500;
function trimLaserBuffer(
  points: { x: number; y: number; t: number }[],
): { x: number; y: number; t: number }[] {
  const cutoff = performance.now() - LASER_BUFFER_TTL_MS;
  const fresh = points.filter((p) => p.t >= cutoff);
  return fresh.length > 60 ? fresh.slice(fresh.length - 60) : fresh;
}

// Full-screen "loading your diagram…" placeholder. Stand-in for the
// editor chrome while the post-mount fetch resolves a ?d= or ?s= URL.
// Reassures the user that data isn't lost — previously they'd briefly
// see the empty-canvas welcome card and assume it had been wiped.
// If the fetch hasn't returned within 10 seconds, surfaces a "taking
// too long" message and a Refresh button so the user has an out.
function DiagramLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="animate-spin text-brand-500"
          aria-hidden
        >
          <circle cx="16" cy="16" r="12" strokeOpacity="0.18" />
          <path d="M28 16a12 12 0 0 0-12-12" />
        </svg>
        <p className="text-sm font-medium text-slate-600">Loading your diagram…</p>
        {slow ? (
          <div className="mt-2 flex flex-col items-center gap-2">
            <p className="text-xs text-slate-500">It&apos;s taking too long.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              <RefreshIcon />
              Refresh
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 5.5" />
      <path d="M13.5 2.5v3h-3" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 10.5" />
      <path d="M2.5 13.5v-3h3" />
    </svg>
  );
}

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
  const [drag, setDrag] = useState<DragState | null>(null);
  const [palettePosition, setPalettePosition] = useState<{ x: number; y: number } | null>(null);
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const [explorerPosition, setExplorerPosition] = useState<{ x: number; y: number } | null>(null);
  const [explorerMinimized, setExplorerMinimized] = useState(false);
  // Editor / Context panel (Selected Element + Current Tab). Sits
  // under the Palette by default.
  const [contextPosition, setContextPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMinimized, setContextMinimized] = useState(false);
  // Tab-section accordion state lifted here so the Activity row
  // click handler can pop the matching accordion (e.g. clicking a
  // "Changed theme to X" entry opens the Theme accordion).
  const [tabAccordionsOpen, setTabAccordionsOpen] = useState<{
    theme: boolean;
    canvas: boolean;
    file: boolean;
  }>({ theme: false, canvas: false, file: false });
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
  // ID of the element whose comment thread popover is currently open.
  // Comment mutations bypass the history hook (so typing a comment then
  // Ctrl+Z doesn't unexpectedly wipe it).
  const [commentThreadOpenId, setCommentThreadOpenId] = useState<string | null>(null);
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
  // True while the very first diagram-list fetch is in flight, so the
  // Explorer can render a skeleton instead of an empty "no diagrams"
  // state. We only flip this off — subsequent refreshes don't reset it
  // because they're triggered by saves and shouldn't blank the list.
  const [diagramListLoading, setDiagramListLoading] = useState(true);
  // Diagrams shared with the current owner. Surfaced in the
  // Explorer's "Shared with you" accordion. Fetched alongside the
  // owned-diagram list and refreshed when the owner opens a new
  // share link in this tab.
  const [sharedDiagrams, setSharedDiagrams] = useState<
    { id: string; name: string; savedAt: number; role: 'edit' | 'view'; shareCode: string }[]
  >([]);
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
    Map<string, { tabId: string; points: { x: number; y: number; t: number }[] }>
  >(new Map());
  // Local laser trail — held in state so the overlay re-renders when
  // we append a point, but mutations stay cheap by always producing a
  // bounded array.
  const [localLaserTrail, setLocalLaserTrail] = useState<{ x: number; y: number; t: number }[]>([]);
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
  const dismissSharedDiagram = (diagramId: string) => {
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
      let selfId: string;
      if (clerkUserId) {
        selfId = clerkUserId;
      } else {
        const stored = getGuestSelfId();
        if (stored) {
          selfId = stored;
        } else {
          selfId = crypto.randomUUID();
          setGuestSelfId(selfId);
        }
      }
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
        const resolution = await apiLoadShared(shareCodeParam).catch(() => null);
        if (resolution) {
          const { diagram: fetched, role } = resolution;
          const codeForVisitor = fetched.ownerId === self.id ? null : shareCodeParam;
          // Lazy per-tab fetch (spec/13): the active tab (first in the
          // summaries) gets its full payload inline so the first paint
          // has real content; the rest land as placeholders and a
          // useEffect below fetches each one when the user switches.
          const placeholderTabs: Tab[] = fetched.tabs.map((summary) => ({
            id: summary.id,
            name: summary.name,
            elements: [],
          }));
          const firstSummary = fetched.tabs[0];
          if (firstSummary) {
            const first = await apiLoadTab(
              self.id,
              fetched.id,
              firstSummary.id,
              codeForVisitor,
            ).catch(() => null);
            if (first) placeholderTabs[0] = first;
            loadedTabIdsRef.current.add(firstSummary.id);
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
          const placeholderTabs: Tab[] = fetched.tabs.map((summary) => ({
            id: summary.id,
            name: summary.name,
            elements: [],
          }));
          const firstSummary = fetched.tabs[0];
          if (firstSummary) {
            const first = await apiLoadTab(self.id, fetched.id, firstSummary.id).catch(() => null);
            if (first) placeholderTabs[0] = first;
            loadedTabIdsRef.current.add(firstSummary.id);
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
          setSessionRole('edit');
          // If we own the diagram, prefetch its full share-link list so
          // the dialog opens populated.
          if (fetched.ownerId === self.id) {
            apiListShareLinks(self.id, fetched.id)
              .then((links) => setShareLinks(links))
              .catch(() => {});
            apiListChangeLog(self.id, fetched.id)
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
  }, [authLoaded]);

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
        }
      },
    };
    const room = connectRoom(
      diagramId,
      { id: selfParticipant.id, name: selfParticipant.name, color: selfParticipant.color },
      handlers,
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

  // Local cursor broadcaster. Sends the participant's pointer position
  // in canvas-coords whenever it moves, throttled to ~30 Hz so we
  // don't flood the room. `broadcastCursor(null)` is called when the
  // pointer leaves the canvas — peers hide the indicator until the
  // next position arrives.
  const lastCursorSentRef = useRef(0);
  const broadcastCursor = (pos: { x: number; y: number } | null) => {
    if (!hydrated || !diagramId || !diagramShareable) return;
    const now = performance.now();
    if (pos && now - lastCursorSentRef.current < 33) return;
    lastCursorSentRef.current = now;
    roomRef.current?.send({
      kind: 'op',
      op: {
        kind: 'cursor',
        tabId: activeId,
        x: pos?.x ?? null,
        y: pos?.y ?? null,
      },
    });
  };
  // Laser broadcast — fires per pointer-move while in laser tool.
  // Throttled to ~30 Hz to match cursor traffic. Trail buffers grow
  // locally + remotely as points arrive; the overlay's RAF loop is
  // what makes them visibly decay over the lifetime window.
  const lastLaserSentRef = useRef(0);
  const broadcastLaser = (x: number, y: number) => {
    const now = performance.now();
    setLocalLaserTrail((prev) => trimLaserBuffer([...prev, { x, y, t: now }]));
    if (!hydrated || !diagramId || !diagramShareable) return;
    if (now - lastLaserSentRef.current < 33) return;
    lastLaserSentRef.current = now;
    roomRef.current?.send({
      kind: 'op',
      op: { kind: 'laser', tabId: activeId, x, y },
    });
  };
  // Clear the local trail when leaving laser mode so a partial path
  // doesn't persist in state forever (the overlay's filter would
  // hide it after LIFETIME_MS, but a fresh laser session shouldn't
  // start from the prior trail's tail). Also fires on tab switch
  // for the same reason.
  useEffect(() => {
    if (canvasTool !== 'laser') {
      setLocalLaserTrail([]);
    }
  }, [canvasTool, activeId]);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  // Mobile (≤768 px) defaults to 30% zoom so the diagram fits without
  // a fit-to-screen tap; desktop stays at 100%. Re-evaluated on
  // window resize so a rotation / desktop-to-mobile breakpoint
  // change still gives a reasonable starting view.
  const [viewportZoom, setViewportZoom] = useState(() => {
    if (typeof window === 'undefined') return 1;
    return window.innerWidth <= 768 ? 0.3 : 1;
  });
  const canvasMainRef = useRef<HTMLElement>(null);
  // Keep latest zoom available to drag effects without re-creating them on
  // every zoom change (which would interrupt an in-progress drag).
  const zoomRef = useRef(viewportZoom);
  useEffect(() => {
    zoomRef.current = viewportZoom;
  }, [viewportZoom]);

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
  const livePresenceById = new Map(livePresence.map((p) => [p.id, p] as const));
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
    for (const [id, tabId] of remoteTabFocus) {
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
  const remoteCursorRows = (() => {
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
  })();
  // Laser trails for the LaserOverlay — local first, then any peers
  // whose latest sample is on the active tab and whose participant
  // entry is still live. The overlay handles fade + cleanup; we just
  // assemble per-tab visibility here.
  const laserTrailRows = (() => {
    const rows: {
      participantId: string;
      color: string;
      points: { x: number; y: number; t: number }[];
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
  })();
  const remoteSelectionsByElement = new Map<
    string,
    { id: string; name: string; color: string }[]
  >();
  for (const [participantId, elementId] of remoteSelections) {
    if (!elementId) continue;
    if (participantId === selfParticipant.id) continue;
    const participant = livePresenceById.get(participantId);
    if (!participant) continue;
    const list = remoteSelectionsByElement.get(elementId) ?? [];
    list.push({ id: participant.id, name: participant.name, color: participant.color });
    remoteSelectionsByElement.set(elementId, list);
  }
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
  // to the local log immediately and fire the POST without awaiting.
  const emitChange = (
    tabId: string,
    beforeElements: Element[],
    afterElements: Element[],
    override?: { kind: ChangeLogEntry['kind']; summary: string },
  ) => {
    if (!diagramId) return;
    const diff = diffElements(beforeElements, afterElements);
    if (!diff) return;
    const entry: ChangeLogEntry = {
      id: crypto.randomUUID(),
      tabId,
      participantId: selfParticipant.id,
      participantName: selfParticipant.name,
      participantColor: selfParticipant.color,
      kind: override?.kind ?? diff.kind,
      summary: override?.summary ?? diff.summary,
      elementIds: diff.elementIds,
      beforeState: diff.beforeState as Record<string, unknown>,
      afterState: diff.afterState as Record<string, unknown>,
      createdAt: Date.now(),
    };
    appendLogEntry(entry);
  };

  // Shared bookkeeping for any new log entry, regardless of whether
  // it came from an element diff or a tab-meta change. Optimistic
  // local append + fire-and-forget API + room broadcast + push onto
  // the Undo/Redo memory stack so the entry pops cleanly on undo.
  const appendLogEntry = (entry: ChangeLogEntry) => {
    setChangeLog((prev) => [entry, ...prev].slice(0, 30));
    entryHistoryRef.current = {
      past: [...entryHistoryRef.current.past, entry].slice(-LOG_HISTORY_LIMIT),
      future: [],
    };
    if (diagramId) {
      apiAppendChangeLogEntry(selfParticipant.id, diagramId, entry, sessionShareCode).catch(
        () => {},
      );
    }
    roomRef.current?.send({ kind: 'op', op: { kind: 'log', entry } });
  };

  // Emit a tab-meta entry — theme change, background tweak, rename,
  // anything that mutates Tab metadata rather than its elements. The
  // entry carries no before/after payload (revert isn't supported for
  // these in V1) so the panel renders the row without a Revert
  // button. Undo still works because the matching state lives in
  // useDiagramHistory.
  const emitTabMeta = (tabId: string, summary: string) => {
    if (!diagramId) return;
    const entry: ChangeLogEntry = {
      id: crypto.randomUUID(),
      tabId,
      participantId: selfParticipant.id,
      participantName: selfParticipant.name,
      participantColor: selfParticipant.color,
      kind: 'edit',
      summary,
      elementIds: [],
      beforeState: {},
      afterState: {},
      createdAt: Date.now(),
    };
    appendLogEntry(entry);
  };

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
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, elements: after } : t)));
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
      setContextMinimized(false);
      setTabAccordionsOpen({ theme: true, canvas: false, file: false });
    } else if (lower.includes('canvas') || lower.includes('pattern') || lower.includes('opacity')) {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setContextMinimized(false);
      setTabAccordionsOpen({ theme: false, canvas: true, file: false });
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
    if (!entry.tabId) return;
    const target = tabs.find((t) => t.id === entry.tabId);
    if (!target) return;
    const after = applyRevert(target.elements, entry.beforeState as Record<string, Element | null>);
    commitTabs((ts) => ts.map((t) => (t.id === entry.tabId ? { ...t, elements: after } : t)));
    if (entry.tabId !== activeId) setActiveId(entry.tabId);
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
    undoHistory();
    const { past, future } = entryHistoryRef.current;
    const popped = past[past.length - 1];
    if (popped) {
      entryHistoryRef.current = {
        past: past.slice(0, -1),
        future: [popped, ...future].slice(0, LOG_HISTORY_LIMIT),
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
    redoHistory();
    const { past, future } = entryHistoryRef.current;
    const next = future[0];
    if (next) {
      entryHistoryRef.current = {
        past: [...past, next].slice(-LOG_HISTORY_LIMIT),
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

  // Centre of the currently visible canvas viewport, in canvas-local coords.
  // With transform `scale(z) translate(offset)` centred on the wrapper, the
  // canvas-coord at viewport centre is just (canvasCentre - offset) — zoom
  // doesn't enter the equation because scale is centred on the same point.
  const getViewportCenter = (): { x: number; y: number } => {
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: rect.width / 2 - viewportOffset.x,
      y: rect.height / 2 - viewportOffset.y,
    };
  };

  // Compute zoom + offset so every element on the tab fits in the viewport
  // with padding, then centre the bounding box on the viewport centre.
  const fitToScreen = () => {
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const boxedIds = new Set(activeTab.elements.filter(isBoxed).map((el) => el.id));
    if (boxedIds.size === 0) {
      setViewportOffset({ x: 0, y: 0 });
      setViewportZoom(1);
      return;
    }
    const bbox = unionBoxedBounds(activeTab.elements, boxedIds);
    if (!bbox) return;
    const padding = 60;
    const zoom = Math.max(
      0.1,
      Math.min(
        5,
        (rect.width - 2 * padding) / Math.max(1, bbox.width),
        (rect.height - 2 * padding) / Math.max(1, bbox.height),
        1,
      ),
    );
    setViewportZoom(zoom);
    setViewportOffset({
      x: rect.width / 2 - (bbox.x + bbox.width / 2),
      y: rect.height / 2 - (bbox.y + bbox.height / 2),
    });
  };

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
    // Derive colours from the active tab when it has been recoloured, so
    // newly added elements harmonise with the user's chosen palette instead
    // of clashing with brand defaults. Sticky notes keep their amber palette
    // because the yellow note is iconic.
    const bg = activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    const patternColor = activeTab.patternColor ?? DEFAULT_PATTERN_COLOR;
    const colours: Partial<BoxedElement> = {};
    if (base.type === 'shape') {
      const derived = deriveShapeColours(patternColor, bg);
      if (derived) {
        colours.fillColor = derived.fill;
        colours.strokeColor = derived.stroke;
        colours.textColor = derived.text;
      }
    } else if (base.type === 'text') {
      if (bg !== DEFAULT_BACKGROUND_COLOR) {
        colours.textColor = deriveTextColorForBg(bg);
      }
    }
    // Preset theme overrides — explicit theme colours win over the
    // automatic background-derived ones above, and only apply to shapes
    // and text (sticky notes keep their amber identity).
    const theme = getTheme(activeTab.theme);
    if (base.type === 'shape') {
      if (theme.elementFill) colours.fillColor = theme.elementFill;
      if (theme.elementStroke) colours.strokeColor = theme.elementStroke;
      if (theme.elementText) colours.textColor = theme.elementText;
    } else if (base.type === 'text') {
      if (theme.elementText) colours.textColor = theme.elementText;
    }
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
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId ? { ...t, elements: [...t.elements, el], templateChosen: true } : t,
      ),
    );
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
    // Format-paint copies every formatting field on the source. Skip
    // identity (`id`, `type`, `shape`) and content (`label`, `link`,
    // `commentThread`, `groupId`, `locked`, position `x`/`y`) — those
    // belong to the target. Anything else that visually styles the
    // element gets carried over. Boxed↔arrow paints are no-ops since
    // the two kinds share almost no formattable fields.
    //
    // Each new style field (text bold/italic/underline/strike, padding,
    // arrow thickness, aspect lock, etc.) is included explicitly so
    // future additions need a deliberate update here — easier to spot
    // missing coverage than to debug "format painter forgot X" later.
    if (isBoxed(source) && isBoxed(target)) {
      const copied: Partial<BoxedElement> = {
        width: source.width,
        height: source.height,
        aspectLocked: source.aspectLocked,
        opacity: source.opacity,
        fillColor: source.fillColor,
        strokeColor: source.strokeColor,
        textColor: source.textColor,
        textSize: source.textSize,
        textAlignX: source.textAlignX,
        textAlignY: source.textAlignY,
        textBold: source.textBold,
        textItalic: source.textItalic,
        textUnderline: source.textUnderline,
        textStrikethrough: source.textStrikethrough,
        padding: source.padding,
      };
      const definedCopied = Object.fromEntries(
        Object.entries(copied).filter(([, v]) => v !== undefined),
      );
      commit((els) =>
        els.map((el) =>
          el.id === targetId && isBoxed(el) ? ({ ...el, ...definedCopied } as typeof el) : el,
        ),
      );
    } else if (source.type === 'arrow' && target.type === 'arrow') {
      const copied: Partial<ArrowElement> = {
        strokeColor: source.strokeColor,
        strokeWidth: source.strokeWidth,
        opacity: source.opacity,
        arrowEnds: source.arrowEnds,
      };
      const definedCopied = Object.fromEntries(
        Object.entries(copied).filter(([, v]) => v !== undefined),
      );
      commit((els) =>
        els.map((el) =>
          el.id === targetId && el.type === 'arrow'
            ? ({ ...el, ...definedCopied } as typeof el)
            : el,
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

  const addTab = () => {
    const tab = createTab(`Tab ${tabs.length + 1}`);
    commitTabs((ts) => [...ts, tab]);
    setActiveId(tab.id);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
    // New tabs jump straight into the lighter template picker (just the
    // template grid). The welcome flow is first-run only — the user
    // already has an identity + theme by this point.
    setTemplatePickerMode('templates');
  };

  // Import a tab from a `.livediagram-tab.json` file the user picks.
  // Tab id + nested element ids are re-minted client-side so the
  // imported tab can never collide with an existing one. Schema
  // mismatches surface via setImportError which the header button
  // renders in-place.
  const importTabFromFile = async () => {
    const text = await pickTabFile();
    if (!text) return;
    const result = parseImportedTab(text);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setImportError(null);
    // Re-mint ids so the imported tab can't collide. Pinned arrows
    // need their element references rewritten to the new ids — walk
    // boxed elements first, build an old→new id map, then rewrite
    // arrow endpoints.
    const idMap = new Map<string, string>();
    const newElements = result.tab.elements.map((el) => {
      const newId = crypto.randomUUID();
      idMap.set(el.id, newId);
      return { ...el, id: newId };
    });
    for (const el of newElements) {
      if (el.type === 'arrow') {
        if (el.from.kind === 'pinned') {
          const mapped = idMap.get(el.from.elementId);
          if (mapped) el.from = { ...el.from, elementId: mapped };
        }
        if (el.to.kind === 'pinned') {
          const mapped = idMap.get(el.to.elementId);
          if (mapped) el.to = { ...el.to, elementId: mapped };
        }
      }
    }
    const newTab: Tab = {
      ...result.tab,
      id: crypto.randomUUID(),
      elements: newElements,
    };
    commitTabs((ts) => [...ts, newTab]);
    setActiveId(newTab.id);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  // Delete a diagram by id. When the target is the currently-open one,
  // redirect to /live/new so the user lands on a fresh welcome flow
  // (the editor would otherwise be staring at a row that no longer
  // exists). Deleting any *other* diagram just hits the API + refreshes
  // the Explorer list. Not undoable — the menu is an explicit action.
  const deleteDiagram = (id: string) => {
    if (typeof window === 'undefined') return;
    if (id === diagramId) {
      void apiDeleteDiagram(selfParticipant.id, id).catch(() => {});
      window.location.assign(`${window.location.origin}/live/new`);
      return;
    }
    // Optimistic local removal so the Recent row disappears the
    // moment the user clicks Delete. The previous shape was a
    // fire-and-forget apiDeleteDiagram followed by an immediate
    // refreshDiagramList — the DELETE and the GET raced, and the
    // refresh frequently won, repainting the row that the API
    // hadn't yet committed. Users had to click Delete twice to
    // make it stick.
    setDiagramList((prev) => prev.filter((d) => d.id !== id));
    void apiDeleteDiagram(selfParticipant.id, id).catch(() => {});
  };

  // Folder helpers (spec/15). createFolder / renameFolder come
  // straight from useFolders; deleteFolder wraps the hook with a
  // diagram-side cascade so diagrams that pointed at the deleted
  // folder visibly re-bucket to Unsorted instead of waiting for
  // the next list refresh.
  const deleteFolder = (id: string) => {
    setDiagramList((prev) => prev.map((d) => (d.folderId === id ? { ...d, folderId: null } : d)));
    hookDeleteFolder(id);
  };

  const moveDiagramToFolder = (diagramId: string, folderId: string | null) => {
    setDiagramList((prev) => prev.map((d) => (d.id === diagramId ? { ...d, folderId } : d)));
    void apiSetDiagramFolder(selfParticipant.id, diagramId, folderId).catch(() => {});
  };

  // Duplicate a diagram into a brand-new one. Loads the source's
  // metadata + every tab's content, mints new tab ids (otherwise they
  // collide with the source when the user opens both), preserves
  // element ids inside each tab (arrows + same-tab links keep
  // resolving), and rewrites any tab-link references on the new tabs
  // through the id remap so cross-tab navigation survives the copy.
  const duplicateDiagram = async (id: string) => {
    const newId = await duplicate(selfParticipant.id, id);
    // Open the freshly created copy. Navigation reloads the editor onto
    // the new id, so a separate list refresh is unnecessary.
    if (newId) openDiagram(newId);
  };

  // Comment mutations live outside the history hook (per the comment on
  // `commentThreadOpenId`). They all funnel through `tickTabs`, which
  // updates the present tab list without pushing a snapshot to `past`.
  const updateThread = (
    elementId: string,
    fn: (
      thread: import('@livediagram/diagram').CommentThread | undefined,
    ) => import('@livediagram/diagram').CommentThread | undefined,
  ) => {
    tickTabs((ts) =>
      ts.map((t) =>
        t.id !== activeId
          ? t
          : {
              ...t,
              elements: t.elements.map((el) => {
                if (el.id !== elementId || !isBoxed(el)) return el;
                const next = fn(el.commentThread);
                if (!next) {
                  const { commentThread: _drop, ...rest } = el;
                  return rest as typeof el;
                }
                return { ...el, commentThread: next };
              }),
            },
      ),
    );
  };

  const openComments = (elementId: string) => {
    setCommentThreadOpenId((cur) => (cur === elementId ? null : elementId));
  };
  const closeComments = () => setCommentThreadOpenId(null);
  const addComment = (elementId: string, text: string) => {
    updateThread(elementId, (thread) => ({
      comments: [
        ...(thread?.comments ?? []),
        createComment(text, { name: selfParticipant.name, color: selfParticipant.color }),
      ],
      // Adding a comment unresolves a resolved thread — the new message
      // is itself a signal that the conversation isn't done.
      resolved: false,
    }));
  };
  const deleteComment = (elementId: string, commentId: string) => {
    updateThread(elementId, (thread) => {
      if (!thread) return undefined;
      const remaining = thread.comments.filter((c) => c.id !== commentId);
      if (remaining.length === 0) return undefined;
      return { ...thread, comments: remaining };
    });
  };
  const resolveThread = (elementId: string) => {
    updateThread(elementId, (thread) => (thread ? { ...thread, resolved: true } : undefined));
  };
  const unresolveThread = (elementId: string) => {
    updateThread(elementId, (thread) => (thread ? { ...thread, resolved: false } : undefined));
  };

  // Flip the active tab's locked flag. Emits a tab-meta entry so the
  // toggle shows up in the Activity panel alongside theme / background
  // changes.
  const toggleActiveTabLock = () => {
    const target = tabs.find((t) => t.id === activeId);
    if (!target) return;
    const next = !target.locked;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, locked: next } : t)));
    emitTabMeta(activeId, next ? 'Locked tab' : 'Unlocked tab');
    if (next) {
      // Drop any in-progress UI state that would be useless on a
      // newly-locked tab.
      setSelectedId(null);
      setEditingId(null);
      setFormatSourceId(null);
      setGroupSourceId(null);
    }
  };

  const renameTab = (id: string, name: string) => {
    const previous = tabs.find((t) => t.id === id)?.name ?? '';
    const trimmed = name.trim();
    if (trimmed === previous.trim()) return;
    commitTabs((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
    emitTabMeta(
      id,
      previous ? `Renamed tab '${previous}' to '${trimmed}'` : `Renamed tab to '${trimmed}'`,
    );
  };

  // Copy the active tab into another diagram. Loads the destination,
  // appends a fresh-id clone of the active tab, and PUTs it back. The
  // source diagram is unchanged. Element ids are preserved so internal
  // arrow endpoints and links between elements still resolve inside
  // the new tab.
  const copyActiveTabTo = async (targetDiagramId: string) => {
    const source = tabs.find((t) => t.id === activeId);
    if (!source) return;
    const target = await apiLoadDiagram(selfParticipant.id, targetDiagramId).catch(() => null);
    if (!target) return;
    const cloned: Tab = {
      ...source,
      id: crypto.randomUUID(),
      templateChosen: true,
    };
    // Save the new tab row + the destination's updated tab order.
    // Two API calls in series (tab content then meta reorder) so
    // the meta PUT sees the new tab id by the time it persists.
    try {
      await apiSaveTab(selfParticipant.id, target.id, cloned);
      const nextIds = [...target.tabs.map((t) => t.id), cloned.id];
      await apiSaveDiagramMeta(selfParticipant.id, {
        id: target.id,
        tabIds: nextIds,
      });
    } catch {
      // Best-effort. The user's own diagram autosave still drives
      // the "Not saved" pill; failures here don't surface.
    }
    refreshDiagramList(selfParticipant.id);
  };

  const duplicateTab = (id: string) => {
    const src = tabs.find((t) => t.id === id);
    if (!src) return;
    const copy: Tab = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} copy`,
      elements: src.elements.map((el) => ({ ...el })),
    };
    const srcIndex = tabs.findIndex((t) => t.id === id);
    commitTabs((ts) => {
      const next = [...ts];
      next.splice(srcIndex + 1, 0, copy);
      return next;
    });
    setActiveId(copy.id);
    setSelectedId(null);
    setEditingId(null);
  };

  const deleteTab = (id: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    // Drop the tab AND strip any links on remaining elements that point to
    // it, so we don't leave dangling cross-tab references. Bundled into one
    // commit so undo restores both.
    commitTabs((ts) =>
      ts
        .filter((t) => t.id !== id)
        .map((t) => ({
          ...t,
          elements: t.elements.map((el) => {
            if (!el.link) return el;
            if (el.link.tabId !== id) return el;
            const { link: _drop, ...rest } = el;
            return rest as typeof el;
          }),
        })),
    );
    // Cascade: drop every audit-log entry whose tab_id points at the
    // gone tab. Local list first so the panel updates immediately,
    // then the API (fire-and-forget).
    setChangeLog((prev) => prev.filter((entry) => entry.tabId !== id));
    if (diagramId) {
      apiDeleteChangeLogForTab(selfParticipant.id, diagramId, id, sessionShareCode).catch(() => {
        // Best-effort. Stale rows in D1 are harmless; next list fetch
        // simply omits them because the diagram is the source of truth.
      });
    }
    if (activeId === id) {
      const fallback = tabs[idx + 1] ?? tabs[idx - 1];
      if (fallback) setActiveId(fallback.id);
    }
    setSelectedId(null);
    setEditingId(null);
  };

  const reorderTabs = (sourceId: string, targetId: string) => {
    commitTabs((ts) => {
      const srcIdx = ts.findIndex((t) => t.id === sourceId);
      const tgtIdx = ts.findIndex((t) => t.id === targetId);
      if (srcIdx < 0 || tgtIdx < 0 || srcIdx === tgtIdx) return ts;
      const next = [...ts];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, moved!);
      return next;
    });
  };

  // "New Diagram" from the Explorer. Welcome / create-new lives at
  // /live/new (spec/14), so hand off there — that route owns the
  // identity + template + theme picker and the actual diagram POST.
  // The current diagram is already autosaved so nothing is lost.
  const newDiagram = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/live/new`);
  };

  // Open a different diagram from the Explorer list. Same reload trick
  // as `newDiagram` — the auto-save has already persisted the current
  // diagram so nothing is lost. Path scheme per spec/14.
  const openDiagram = (id: string, shareCode?: string) => {
    if (typeof window === 'undefined') return;
    if (id === diagramId) return;
    // Shared-list rows pass a share code so the non-owner can
    // actually load the target diagram — without it the editor's
    // hydration goes through the owner-only `/api/diagrams/:id`
    // path and 404s.
    const url = shareCode
      ? `${window.location.origin}/live/diagram/${id}?s=${encodeURIComponent(shareCode)}`
      : `${window.location.origin}/live/diagram/${id}`;
    window.location.assign(url);
  };

  // Visitor action: duplicate the currently-open shared diagram
  // into the caller's own files. Goes to the api worker's copy
  // endpoint which authorises via owner / shared_with row / share
  // code (spec/11), then navigates to the new diagram so the
  // visitor immediately lands on their own copy. Owner case never
  // hits this — the button is gated on `!isOwner`.
  const makeCopy = async () => {
    if (!diagramId || copying) return;
    setCopying(true);
    try {
      const copy = await apiCopyDiagram(selfParticipant.id, diagramId, {
        shareCode: sessionShareCode,
      });
      window.location.assign(`${window.location.origin}/live/diagram/${copy.id}`);
    } catch {
      // Network / auth glitch — let the user try again. Leave the
      // header button enabled by clearing the loading flag.
      setCopying(false);
    }
  };

  const openTemplatePicker = () => {
    setTemplatePickerMode('templates');
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, templateChosen: false } : t)));
  };

  // Mark the participant's name as "confirmed" — they explicitly
  // dismissed at least one modal that prompted for it. Persisted in
  // localStorage so a returning visitor isn't re-prompted, and clears
  // the in-memory flag so the modal closes immediately.
  const confirmName = () => {
    markNameConfirmed();
    setNameConfirmed(true);
  };

  // Save the participant's name (used from the share dialog's identity
  // card). Mints the diagram id if this is the first share gesture so
  // the share URL is shareable from the moment it's created.
  const updateParticipantName = async (name: string) => {
    if (!name) return;
    if (name === selfParticipant.name) return;
    const updated: Participant = { ...selfParticipant, name };
    setSelfParticipant(updated);
    await apiSaveSelf(updated).catch(() => {});
  };

  // Create a new share link for the current diagram with the given
  // role. The editor route always has a real diagramId by the time
  // the Share dialog is open — the welcome / mint-id flow now lives
  // on /live/new (spec/14) — so this just calls the API directly.
  const createShareLink = async (role: ShareRole) => {
    if (!diagramId) return;
    confirmName();
    try {
      const link = await apiCreateShareLink(selfParticipant.id, diagramId, role);
      setShareLinks((prev) => [...prev, link]);
      setDiagramShareable(true);
      setDiagramShareCode((prev) => prev ?? link.code);
    } catch {
      // Network glitch — leave state alone. A real app would toast.
    }
  };

  const revokeShareLink = async (code: string) => {
    if (!diagramId) return;
    try {
      await apiDeleteShareLink(selfParticipant.id, diagramId, code);
    } catch {
      // ignore — list refresh below reconciles if it actually went through.
    }
    setShareLinks((prev) => {
      const next = prev.filter((l) => l.code !== code);
      if (next.length === 0) {
        setDiagramShareable(false);
        setDiagramShareCode(null);
      } else if (diagramShareCode === code) {
        setDiagramShareCode(next[0]!.code);
      }
      return next;
    });
  };

  // Absolute share URL helper used by the dialog. Visitor links carry
  // the share code as a query param and land on the dedicated visitor
  // path; the editor page reads the code there. Router stitches /live
  // onto the app's hostname so this URL always resolves end-to-end.
  const shareUrlFor = (code: string) =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/live/diagram/shared?s=${code}`;

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
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, templateChosen: true } : t)));
    confirmName();
    setTemplatePickerMode('welcome');
  };

  const chooseTemplate = (kind: TemplateKind, name?: string, themeId?: ThemeId) => {
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
    // Templates flow: applying a template / theme to an existing tab.
    // The diagram already exists in D1; no mint required.
    if (name && name !== selfParticipant.name) {
      setSelfParticipant((p) => ({ ...p, name }));
    }
    confirmName();
    setTemplatePickerMode('welcome');
    const centre = getViewportCenter();
    const rawElements = buildTemplate(kind, centre.x, centre.y);
    const theme = themeId ? getTheme(themeId) : null;
    // Repaint the scaffold with the chosen theme so the Mind map circles,
    // Org chart boxes etc. land in the user's selected colours rather
    // than the hard-coded brand defaults from `buildTemplate`. Sticky
    // notes (Retrospective) keep their amber identity — same rule
    // `addBoxed` applies to ad-hoc sticky creation.
    const elements = !theme
      ? rawElements
      : rawElements.map((el) => {
          if (el.type === 'shape') {
            return {
              ...el,
              ...(theme.elementFill ? { fillColor: theme.elementFill } : {}),
              ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
              ...(theme.elementText ? { textColor: theme.elementText } : {}),
            };
          }
          if (el.type === 'text') {
            return {
              ...el,
              ...(theme.elementText ? { textColor: theme.elementText } : {}),
            };
          }
          return el;
        });
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements,
              templateChosen: true,
              // Apply the picker's theme choice at the same time as the
              // template scaffold so the user lands on a fully themed
              // canvas in one step instead of having to revisit the
              // Theme accordion.
              ...(theme && themeId
                ? {
                    theme: themeId,
                    backgroundColor: theme.backgroundColor,
                    backgroundPattern: theme.backgroundPattern,
                    patternColor: theme.patternColor,
                  }
                : {}),
              ...templateCanvasOverrides(kind),
            }
          : t,
      ),
    );
    // Auto-select when a template produces a single element (today: blank
    // diagram's seeded rectangle) so the user can immediately rename or edit
    // it. Multi-element templates leave the selection cleared.
    setSelectedId(elements.length === 1 ? elements[0]!.id : null);
    setEditingId(null);
  };

  const clearTabContent = () => {
    commit(() => []);
    setSelectedId(null);
    setEditingId(null);
  };

  const setBackgroundPattern = (pattern: BackgroundPattern) => {
    if (editsBlocked) return;
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundPattern: pattern } : t)),
    );
    emitTabMeta(activeId, `Changed canvas pattern to ${pattern}`);
  };

  // Applying a theme swaps backdrop colours/pattern, records the theme
  // id (so future element-create calls in `addBoxed` inherit the theme),
  // AND retroactively recolours shape + text + arrow elements on the
  // tab to match — UNLESS the user has previously set a custom colour
  // on a specific field, in which case that field stays untouched.
  // Heuristic for "custom": the current value differs from what the
  // PREVIOUS theme would have set. Anything still equal to the
  // previous theme's value (or undefined) is treated as
  // theme-controlled and gets the new theme's value; anything else is
  // the user's choice and survives. Sticky notes are skipped entirely
  // — the amber palette is iconic.
  const setTheme = (id: ThemeId) => {
    if (editsBlocked) return;
    const theme = getTheme(id);
    const themeLabel =
      THEMES.find((t) => t.id === id)?.label ?? id.charAt(0).toUpperCase() + id.slice(1);
    emitTabMeta(activeId, `Changed theme to ${themeLabel}`);
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        const prevTheme = getTheme(t.theme);
        // For one colour field on one element: if the element's
        // current value matches the previous theme's value for that
        // field (or is unset), the user hasn't overridden it — apply
        // the new theme. Otherwise it's custom; leave it.
        const applyOrKeep = (
          current: string | undefined,
          prev: string | null,
          next: string | null,
        ) => (current === undefined || current === prev ? (next ?? undefined) : current);
        const elements = t.elements.map((el) => {
          if (el.type === 'shape') {
            return {
              ...el,
              fillColor: applyOrKeep(el.fillColor, prevTheme.elementFill, theme.elementFill),
              strokeColor: applyOrKeep(
                el.strokeColor,
                prevTheme.elementStroke,
                theme.elementStroke,
              ),
              textColor: applyOrKeep(el.textColor, prevTheme.elementText, theme.elementText),
            };
          }
          if (el.type === 'text') {
            return {
              ...el,
              textColor: applyOrKeep(el.textColor, prevTheme.elementText, theme.elementText),
            };
          }
          if (el.type === 'arrow') {
            return {
              ...el,
              strokeColor: applyOrKeep(
                el.strokeColor,
                prevTheme.elementStroke,
                theme.elementStroke,
              ),
            };
          }
          return el;
        });
        return {
          ...t,
          elements,
          theme: id,
          backgroundColor: theme.backgroundColor,
          backgroundPattern: theme.backgroundPattern,
          patternColor: theme.patternColor,
        };
      }),
    );
  };

  // Force-apply the current theme's element colours to every shape /
  // text / arrow on the tab, OVERWRITING whatever's currently set —
  // even custom per-element colours. The standalone counterpart to
  // setTheme's preserve-customs behaviour; surfaces as a "Reset
  // elements to theme" button under the Theme accordion.
  const resetElementsToTheme = () => {
    if (editsBlocked) return;
    const theme = getTheme(activeTab.theme);
    const themeLabel = THEMES.find((t) => t.id === activeTab.theme)?.label ?? 'theme';
    emitTabMeta(activeId, `Reset elements to ${themeLabel}`);
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        const elements = t.elements.map((el) => {
          if (el.type === 'shape') {
            return {
              ...el,
              fillColor: theme.elementFill ?? undefined,
              strokeColor: theme.elementStroke ?? undefined,
              textColor: theme.elementText ?? undefined,
            };
          }
          if (el.type === 'text') {
            return { ...el, textColor: theme.elementText ?? undefined };
          }
          if (el.type === 'arrow') {
            return { ...el, strokeColor: theme.elementStroke ?? undefined };
          }
          return el;
        });
        return { ...t, elements };
      }),
    );
  };

  const setBackgroundColor = (color: string) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, backgroundColor: color } : t)));
    scheduleTabMetaLog('backgroundColor', `Changed canvas colour to ${color}`);
  };

  // Debounce window for slider / picker-driven activity-log entries
  // (opacity sliders, native color pickers). Without debouncing,
  // every tick of a continuous interaction emits its own log entry —
  // a single tweak to a fill color through Chrome's eyedropper fills
  // 30+ rows. 500 ms lets a fast drag collapse into one entry while
  // still feeling responsive to discrete clicks (two clicks ≥500 ms
  // apart stay separate entries).
  const ACTIVITY_LOG_DEBOUNCE_MS = 500;

  // Per-key debounce slots for tab-meta entries (background colour,
  // pattern colour, background opacity, etc.). Each call resets the
  // matching timer; on fire the latest summary is what lands.
  const tabMetaDebounceRef = useRef<Record<string, number | undefined>>({});
  const scheduleTabMetaLog = (key: string, summary: string) => {
    const slots = tabMetaDebounceRef.current;
    if (slots[key]) window.clearTimeout(slots[key]);
    const tabId = activeId;
    slots[key] = window.setTimeout(() => {
      emitTabMeta(tabId, summary);
      slots[key] = undefined;
    }, ACTIVITY_LOG_DEBOUNCE_MS);
  };

  // Per-key debounce slots for element-level changes — captures the
  // pre-drag elements on the first tick of a window and emits one
  // emitChange against the post-debounce snapshot. Keys are
  // independent so opacity + fill-color drags in parallel produce
  // two separate entries, not a merged one.
  const elementChangeDebounceRef = useRef<
    Record<
      string,
      {
        before: Element[] | null;
        tabId: string | null;
        timer: number | undefined;
      }
    >
  >({});
  const scheduleElementChangeLog = (key: string) => {
    const slots = elementChangeDebounceRef.current;
    if (!slots[key]) slots[key] = { before: null, tabId: null, timer: undefined };
    const slot = slots[key];
    if (slot.before === null) {
      slot.before = activeTab.elements;
      slot.tabId = activeId;
    }
    if (slot.timer) window.clearTimeout(slot.timer);
    const flushTabId = slot.tabId;
    slot.timer = window.setTimeout(() => {
      const before = slot.before;
      if (before && flushTabId) {
        // `tabsRef` (mirrored above) keeps the timer's read of the
        // post-debounce state fresh — closure-captured `tabs` would
        // be stale by the time the timer fires.
        const tab = tabsRef.current.find((t) => t.id === flushTabId);
        if (tab) emitChange(flushTabId, before, tab.elements);
      }
      slot.before = null;
      slot.tabId = null;
      slot.timer = undefined;
    }, ACTIVITY_LOG_DEBOUNCE_MS);
  };

  const setBackgroundOpacity = (opacity: number) => {
    if (editsBlocked) return;
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundOpacity: opacity } : t)),
    );
    scheduleTabMetaLog('backgroundOpacity', `Changed opacity to ${Math.round(opacity * 100)}%`);
  };

  const setPatternColor = (color: string) => {
    if (editsBlocked) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, patternColor: color } : t)));
    scheduleTabMetaLog('patternColor', `Changed pattern colour to ${color}`);
  };

  // --- Element CRUD --------------------------------------------------------

  const addShape = (kind: ShapeKind) => addBoxed((x, y) => createShape(kind, x, y));
  const addText = () => addBoxed((x, y) => createText(x, y));
  const addSticky = () => addBoxed((x, y) => createSticky(x, y));

  // Drop a plain connector at the viewport centre. Defaults to no
  // pointers ('none') so the palette entry behaves like a "Line" tool;
  // the user can change pointer style later via the Pointer accordion.
  // Endpoints are free (unpinned) — drag them onto shapes after the
  // fact to pin to anchors.
  const addArrow = () => {
    if (editsBlocked) return;
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
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId ? { ...t, elements: [...t.elements, arrow], templateChosen: true } : t,
      ),
    );
    setSelectedId(arrow.id);
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

  const deleteSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.filter((el) => {
        if (ids.has(el.id)) return false;
        if (el.type === 'arrow' && arrowReferencesAny(el, ids)) return false;
        return true;
      }),
    );
    setSelectedId(null);
    setEditingId(null);
  };

  // Marquee box-select committed by Canvas on pointer-up. Mutex with
  // single-selection: 0 → clear both; 1 → single-select that element so
  // the popover/accordion still applies; 2+ → enter true multi-select.
  const selectMarquee = (ids: Set<string>) => {
    if (ids.size === 0) {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    } else if (ids.size === 1) {
      const only = Array.from(ids)[0]!;
      setSelectedId(only);
      setMultiSelectedIds(new Set());
    } else {
      setSelectedId(null);
      setMultiSelectedIds(ids);
    }
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  // Bind every multi-selected boxed element into a single group. Same
  // groupId across all of them so move / lock / delete propagate
  // through the selection in the existing group machinery.
  const groupMultiSelected = () => {
    if (multiSelectedIds.size < 2) return;
    const groupId = crypto.randomUUID();
    commit((els) =>
      els.map((el) => (multiSelectedIds.has(el.id) && isBoxed(el) ? { ...el, groupId } : el)),
    );
    // After grouping, transition from marquee multi-select to single
    // selection on the new group: `selectionMembers` picks up every
    // member when one is selected, so the user sees the group treated
    // as one unit. Without this transition the multi-select toolbar
    // just stayed up looking identical and the Group click felt like
    // a no-op.
    const firstBoxed = activeTab.elements.find((el) => multiSelectedIds.has(el.id) && isBoxed(el));
    if (firstBoxed) setSelectedId(firstBoxed.id);
    setMultiSelectedIds(new Set());
  };

  // Toggle lock across every multi-selected element. If any member is
  // unlocked, the click locks everyone — so a partial-locked selection
  // resolves toward "all locked" with one click instead of leaving the
  // user to figure out the inverse state.
  const toggleLockMultiSelected = () => {
    if (multiSelectedIds.size === 0) return;
    const anyUnlocked = activeTab.elements.some(
      (el) => multiSelectedIds.has(el.id) && el.locked !== true,
    );
    commit((els) =>
      els.map((el) => (multiSelectedIds.has(el.id) ? { ...el, locked: anyUnlocked } : el)),
    );
  };

  // Multi-select duplicate: clones every multi-selected boxed element
  // with a small diagonal offset, then clones every multi-selected
  // arrow and rewires pinned endpoints onto the new boxed copies
  // when the source was also duplicated. Pinned ends that referenced
  // an element OUTSIDE the selection keep pointing at the original
  // (user can rewire); free ends shift by the same offset so the
  // visual layout of the duplicated cluster matches the source.
  const duplicateMultiSelected = () => {
    if (multiSelectedIds.size === 0) return;
    const offset = 24;
    const boxedSources = activeTab.elements.filter(
      (el) => multiSelectedIds.has(el.id) && isBoxed(el),
    ) as BoxedElement[];
    const arrowSources = activeTab.elements.filter(
      (el) => multiSelectedIds.has(el.id) && el.type === 'arrow',
    ) as ArrowElement[];
    if (boxedSources.length === 0 && arrowSources.length === 0) return;
    const boxedIdMap = new Map<string, string>();
    const boxedCopies: BoxedElement[] = boxedSources.map((s) => {
      const newId = crypto.randomUUID();
      boxedIdMap.set(s.id, newId);
      return {
        ...s,
        id: newId,
        x: s.x + offset,
        y: s.y + offset,
        // Drop group membership — duplicates are independent.
        groupId: undefined,
      };
    });
    const remapEndpoint = (e: ArrowElement['from']): ArrowElement['from'] => {
      if (e.kind === 'pinned') {
        const next = boxedIdMap.get(e.elementId);
        if (next) return { ...e, elementId: next };
        return e;
      }
      return { kind: 'free', x: e.x + offset, y: e.y + offset };
    };
    const arrowCopies: ArrowElement[] = arrowSources.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      from: remapEndpoint(s.from),
      to: remapEndpoint(s.to),
    }));
    const copies: Element[] = [...boxedCopies, ...arrowCopies];
    commit((els) => [...els, ...copies]);
    setMultiSelectedIds(new Set(copies.map((c) => c.id)));
  };

  // Multi-select delete: removes every marquee-selected element plus any
  // arrows that reference one of them. Falls back to single-element delete
  // when there's no active multi-selection.
  const deleteMultiSelected = () => {
    if (multiSelectedIds.size === 0) return;
    const ids = multiSelectedIds;
    commit((els) =>
      els.filter((el) => {
        if (ids.has(el.id)) return false;
        if (el.type === 'arrow' && arrowReferencesAny(el, ids)) return false;
        return true;
      }),
    );
    setMultiSelectedIds(new Set());
    setEditingId(null);
  };

  const toggleLockSelected = () => {
    if (!selectedId) return;
    const source = selectionPrimary();
    if (!source) return;
    const shouldLock = !(source.locked === true);
    const ids = currentSelectionIds();
    commit((els) => els.map((el) => (ids.has(el.id) ? { ...el, locked: shouldLock } : el)));
  };

  const toggleAspectLockSelected = () => {
    if (!selectedId) return;
    const source = selectionPrimary();
    if (!source || !isBoxed(source)) return;
    const shouldLock = !(source.aspectLocked === true);
    const ids = currentSelectionIds();
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, aspectLocked: shouldLock } : el)),
    );
  };

  const bringSelectedToFront = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => bringManyToFront(els, ids));
  };

  const sendSelectedToBack = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => sendManyToBack(els, ids));
  };

  const setTextSizeSelected = (size: TextSize) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, textSize: size } : el)),
    );
  };

  const setTextAlignSelected = (x: TextAlignX, y: TextAlignY) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isBoxed(el) ? { ...el, textAlignX: x, textAlignY: y } : el,
      ),
    );
  };

  // Generic helper for the inline label styles. Each toggle flips the
  // matching boolean on every member of the current selection. We
  // derive the next value from the primary so a partially-applied
  // group all jumps to the same state.
  const toggleTextStyleSelected = (
    field: 'textBold' | 'textItalic' | 'textUnderline' | 'textStrikethrough',
  ) => {
    const primary = selectionPrimary();
    if (!primary || !isBoxed(primary)) return;
    const next = !(primary[field] ?? false);
    const ids = currentSelectionIds();
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, [field]: next } : el)),
    );
  };

  const setFillColorSelected = (color: string) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    // State update inline (bypass `commit` so emitChange doesn't
    // fire per-tick); log entry debounced — same pattern as
    // opacity.
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: t.elements.map((el) =>
                ids.has(el.id) && (el.type === 'shape' || el.type === 'sticky')
                  ? { ...el, fillColor: color }
                  : el,
              ),
            }
          : t,
      ),
    );
    scheduleElementChangeLog('fillColor');
  };

  const setStrokeColorSelected = (color: string) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: t.elements.map((el) =>
                ids.has(el.id) &&
                (el.type === 'shape' || el.type === 'sticky' || el.type === 'arrow')
                  ? { ...el, strokeColor: color }
                  : el,
              ),
            }
          : t,
      ),
    );
    scheduleElementChangeLog('strokeColor');
  };

  const setTextColorSelected = (color: string) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: t.elements.map((el) =>
                ids.has(el.id) && isBoxed(el) ? { ...el, textColor: color } : el,
              ),
            }
          : t,
      ),
    );
    scheduleElementChangeLog('textColor');
  };

  const setLinkSelected = (tabId: string) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) ? { ...el, link: { kind: 'tab' as const, tabId } } : el)),
    );
  };

  const clearLinkSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id)) return el;
        const { link: _drop, ...rest } = el;
        return rest as typeof el;
      }),
    );
  };

  const followLink = (tabId: string) => {
    if (!tabs.some((t) => t.id === tabId)) return;
    setActiveId(tabId);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  const setOpacitySelected = (opacity: number) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: t.elements.map((el) => (ids.has(el.id) ? { ...el, opacity } : el)),
            }
          : t,
      ),
    );
    scheduleElementChangeLog('elementOpacity');
  };

  const setPaddingSelected = (padding: import('@livediagram/diagram').Padding) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, padding } : el)));
  };

  const setArrowEndsSelected = (arrowEnds: import('@livediagram/diagram').ArrowEnds) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, arrowEnds } : el)),
    );
  };

  const setArrowThicknessSelected = (thickness: import('@livediagram/diagram').ArrowThickness) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    const px = ARROW_THICKNESS_PX[thickness];
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, strokeWidth: px } : el)),
    );
  };

  const setArrowheadSizeSelected = (size: import('@livediagram/diagram').ArrowheadSize) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'arrow' ? { ...el, arrowheadSize: size } : el,
      ),
    );
  };

  const setArrowStyleSelected = (style: import('@livediagram/diagram').ArrowStyle) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) && el.type === 'arrow' ? { ...el, arrowStyle: style } : el)),
    );
  };

  // Morph the selected shape into a different kind, preserving width /
  // height / label / colour overrides. Circle and diamond are 1:1
  // shapes — coming from a non-square box, snap to the larger side so
  // the result fits the original footprint.
  const setShapeKindSelected = (kind: ShapeKind) => {
    if (!selectedId) return;
    commit((els) =>
      els.map((el) => {
        if (el.id !== selectedId || el.type !== 'shape') return el;
        const oneToOne = kind === 'circle' || kind === 'diamond';
        if (oneToOne) {
          const side = Math.max(el.width, el.height);
          return { ...el, shape: kind, width: side, height: side };
        }
        return { ...el, shape: kind };
      }),
    );
  };

  // Clear per-element colour overrides so the element falls back to
  // whatever the current tab theme dictates. Each colour field is set
  // to undefined; the history hook snapshots the present so this is
  // undoable as one step.
  const resetColorsSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    // "Reset to theme" applies the tab's current theme colours when
    // the tab has one set. Plain delete-the-override only works when
    // the theme is the brand default (its `elementFill / Stroke / Text`
    // are all null, so falling back to the type-default produces the
    // brand look). For any other theme we need to explicitly set the
    // colours since `addBoxed` is what normally writes them on create.
    const theme = getTheme(activeTab.theme);
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id)) return el;
        if (el.type === 'shape') {
          return {
            ...el,
            ...(theme.elementFill !== null
              ? { fillColor: theme.elementFill }
              : { fillColor: undefined }),
            ...(theme.elementStroke !== null
              ? { strokeColor: theme.elementStroke }
              : { strokeColor: undefined }),
            ...(theme.elementText !== null
              ? { textColor: theme.elementText }
              : { textColor: undefined }),
          };
        }
        if (el.type === 'text') {
          return {
            ...el,
            ...(theme.elementText !== null
              ? { textColor: theme.elementText }
              : { textColor: undefined }),
            fillColor: undefined,
            strokeColor: undefined,
          };
        }
        if (el.type === 'sticky') {
          // Sticky's amber palette is iconic — wipe any user overrides
          // but DON'T apply theme colours.
          const { fillColor: _f, strokeColor: _s, textColor: _t, ...rest } = el;
          return rest as typeof el;
        }
        if (el.type === 'arrow') {
          return {
            ...el,
            ...(theme.elementStroke !== null
              ? { strokeColor: theme.elementStroke }
              : { strokeColor: undefined }),
          };
        }
        return el;
      }),
    );
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    // Element-only duplicate: clones just this element (not arrows attached
    // to it), offset diagonally so it's visible next to the original.
    const offset = 24;
    if (isBoxed(source)) {
      const copy: BoxedElement = {
        ...source,
        id: crypto.randomUUID(),
        x: source.x + offset,
        y: source.y + offset,
        // Drop group membership — the duplicate is independent.
        groupId: undefined,
      };
      commit((els) => [...els, copy]);
      setSelectedId(copy.id);
      return;
    }
    if (source.type === 'arrow') {
      // For arrows, shift any free endpoints; pinned endpoints stay attached
      // to the same shape. The duplicate represents an extra arrow with the
      // same connection pattern as the original.
      const shift = (e: typeof source.from) =>
        e.kind === 'free' ? { ...e, x: e.x + offset, y: e.y + offset } : e;
      const copy: ArrowElement = {
        ...source,
        id: crypto.randomUUID(),
        from: shift(source.from),
        to: shift(source.to),
      };
      commit((els) => [...els, copy]);
      setSelectedId(copy.id);
    }
  };

  const duplicateConnectSelected = (direction: 'right' | 'below' | 'left' | 'above') => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source)) return;
    const ids = memberIdsOf(selectedId);
    const groupBounds = unionBoxedBounds(activeTab.elements, ids);
    const gap = 40;
    const w = (groupBounds?.width ?? source.width) + gap;
    const h = (groupBounds?.height ?? source.height) + gap;
    const baseBounds = groupBounds ?? {
      x: source.x,
      y: source.y,
      width: source.width,
      height: source.height,
    };
    const step = {
      x: direction === 'right' ? w : direction === 'left' ? -w : 0,
      y: direction === 'below' ? h : direction === 'above' ? -h : 0,
    };
    // Step further in the same direction until the duplicate's bounding box
    // doesn't overlap any existing element. Keeps long chains of duplicates
    // properly spaced even if the user clicks faster than the selection
    // visually catches up.
    let dx = step.x;
    let dy = step.y;
    for (let attempt = 0; attempt < 20; attempt++) {
      const proposed = {
        x: baseBounds.x + dx,
        y: baseBounds.y + dy,
        width: baseBounds.width,
        height: baseBounds.height,
      };
      const overlaps = activeTab.elements.some((el) => {
        if (!isBoxed(el) || ids.has(el.id)) return false;
        return !(
          proposed.x + proposed.width <= el.x ||
          el.x + el.width <= proposed.x ||
          proposed.y + proposed.height <= el.y ||
          el.y + el.height <= proposed.y
        );
      });
      if (!overlaps) break;
      dx += step.x;
      dy += step.y;
    }
    const { newElements, idMap } = duplicateGroupedElements(activeTab.elements, ids, dx, dy);
    const sourceCopyId = idMap.get(source.id);
    if (!sourceCopyId) return;
    // Connector arrow goes between adjacent edges of source and its copy.
    const anchors: Record<typeof direction, [Anchor, Anchor]> = {
      right: ['e', 'w'],
      left: ['w', 'e'],
      below: ['s', 'n'],
      above: ['n', 's'],
    };
    const [fromAnchor, toAnchor] = anchors[direction];
    const connector = createPinnedArrow(source.id, fromAnchor, sourceCopyId, toAnchor);
    commit((els) => [...els, ...newElements, connector]);
    setSelectedId(sourceCopyId);
  };

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

  const ungroupSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source) || source.groupId === undefined) return;
    const groupId = source.groupId;
    commit((els) => ungroup(els, groupId));
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
    // the very first element of the very first tab into the diagram title
    // — typing on the welcome rectangle is a strong signal of intent.
    // Once the user has explicitly named the diagram (or named it via
    // another path), we stop tracking.
    if (diagramName === 'Untitled diagram') {
      const firstTab = tabs[0];
      const firstEl = firstTab?.elements[0];
      if (firstEl && firstEl.id === elementId) {
        const trimmed = label.trim();
        if (trimmed && trimmed !== 'Blank Diagram') {
          setDiagramName(trimmed);
        }
      }
    }
  };

  const cancelEdit = () => setEditingId(null);

  // --- Drag handlers -------------------------------------------------------

  const beginDrag = (elementId: string, mode: DragMode, e: ReactPointerEvent) => {
    if (formatSourceId !== null && mode === 'move') {
      applyFormatFromSource(elementId);
      return;
    }
    if (groupSourceId !== null && mode === 'move') {
      completeGrouping(elementId);
      return;
    }
    if (editingId === elementId) return;
    const element = activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element)) return;
    setSelectedId(elementId);
    // Selection above still lands so viewers can inspect; the drag
    // itself is blocked for a locked element or a read-only session.
    if (element.locked === true || isReadOnly) return;

    // If the user is dragging a marquee-selected element, move every member
    // of the multi-selection in lockstep. Otherwise fall back to group
    // semantics (move every grouped sibling) or a single-element move.
    const ids =
      mode === 'move' && multiSelectedIds.has(elementId)
        ? multiSelectedIds
        : mode === 'move' && element.groupId
          ? new Set(selectionMembers(activeTab.elements, elementId))
          : new Set<string>([elementId]);

    const startBounds = new Map<string, ShapeBounds>();
    for (const el of activeTab.elements) {
      if (ids.has(el.id) && isBoxed(el)) {
        startBounds.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
      }
    }

    markCheckpoint();
    setDrag({
      kind: 'boxed',
      primaryId: elementId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBounds,
      aspectLocked: element.aspectLocked === true,
    });
  };

  const beginAnchorDrag = (elementId: string, anchor: Anchor, e: ReactPointerEvent) => {
    if (formatSourceId !== null || groupSourceId !== null) return;
    const element = activeTab.elements.find((el) => el.id === elementId);
    if (!element || !isBoxed(element) || element.locked === true || isReadOnly) return;
    const start = anchorPosition(element, anchor);
    // New arrows inherit the tab's theme stroke colour so they
    // visually belong with the rest of the diagram. Falls back to the
    // built-in arrow default when the theme has no override (Brand).
    const theme = getTheme(activeTab.theme);
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'pinned', elementId, anchor },
      to: { kind: 'free', x: start.x, y: start.y },
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
    };
    commit((els) => [...els, arrow]);
    setSelectedId(arrow.id);
    setDrag({
      kind: 'arrow-endpoint',
      arrowId: arrow.id,
      end: 'to',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
    });
  };

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

  const beginArrowTranslate = (arrowId: string, e: ReactPointerEvent) => {
    if (formatSourceId !== null || groupSourceId !== null) return;
    const arrow = activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return;
    if (arrow.locked === true || isReadOnly) return;
    if (arrow.from.kind !== 'free' || arrow.to.kind !== 'free') return;
    setSelectedId(arrowId);
    markCheckpoint();
    setDrag({
      kind: 'arrow-translate',
      arrowId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startFromX: arrow.from.x,
      startFromY: arrow.from.y,
      startToX: arrow.to.x,
      startToY: arrow.to.y,
    });
  };

  const beginEndpointDrag = (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => {
    if (formatSourceId !== null || groupSourceId !== null) return;
    const arrow = activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return;
    setSelectedId(arrowId);
    if (arrow.locked === true || isReadOnly) return;
    const start = endpointPosition(end === 'from' ? arrow.from : arrow.to, activeTab.elements);
    markCheckpoint();
    setDrag({
      kind: 'arrow-endpoint',
      arrowId,
      end,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: start.x,
      startCanvasY: start.y,
    });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      // Screen-pixel delta → canvas-coord delta, accounting for current zoom.
      const dx = (e.clientX - drag.startClientX) / zoomRef.current;
      const dy = (e.clientY - drag.startClientY) / zoomRef.current;

      if (drag.kind === 'boxed') {
        if (drag.mode === 'move') {
          // Snap the primary's candidate bounds to align with other
          // elements' edges/centres; apply the same nudge to every group
          // member so they translate together.
          const primaryStart = drag.startBounds.get(drag.primaryId);
          const memberIds = new Set(drag.startBounds.keys());
          let snapDx = 0;
          let snapDy = 0;
          if (primaryStart) {
            const candidate = {
              x: primaryStart.x + dx,
              y: primaryStart.y + dy,
              width: primaryStart.width,
              height: primaryStart.height,
            };
            const snap = snapToAlignment(
              candidate,
              activeTab.elements,
              memberIds,
              ALIGN_SNAP_THRESHOLD,
            );
            snapDx = snap.dx;
            snapDy = snap.dy;
          }
          tick((els) =>
            els.map((el) => {
              if (!isBoxed(el)) return el;
              const start = drag.startBounds.get(el.id);
              if (!start) return el;
              return { ...el, x: start.x + dx + snapDx, y: start.y + dy + snapDy };
            }),
          );
        } else {
          const start = drag.startBounds.get(drag.primaryId);
          if (!start) return;
          const raw = nextBounds(start, drag.mode, dx, dy, drag.aspectLocked);
          // Resize snapping: the active edges (the ones the handle is
          // pulling) snap to align with other elements' edges/centres
          // — same UX as the move-snap so users get the same alignment
          // guides whether they're translating or scaling. Aspect-
          // locked resizes skip snap because nudging one dimension
          // would break the locked ratio.
          const cornerOf = {
            'resize-se': 'se',
            'resize-sw': 'sw',
            'resize-ne': 'ne',
            'resize-nw': 'nw',
          } as const;
          const corner = cornerOf[drag.mode];
          const memberIds = new Set(drag.startBounds.keys());
          const next =
            !drag.aspectLocked && corner
              ? snapResizeBounds(
                  raw,
                  corner,
                  activeTab.elements,
                  memberIds,
                  ALIGN_SNAP_THRESHOLD,
                  MIN_SIZE,
                )
              : raw;
          tick((els) =>
            els.map((el) => (el.id === drag.primaryId && isBoxed(el) ? { ...el, ...next } : el)),
          );
        }
        return;
      }

      if (drag.kind === 'arrow-translate') {
        // Shift both free endpoints by the same canvas delta from
        // their captured start positions. No anchor / angle snap —
        // the user explicitly chose a fully-floating arrow.
        tick((els) =>
          els.map((el) => {
            if (el.id !== drag.arrowId || el.type !== 'arrow') return el;
            return {
              ...el,
              from: { kind: 'free', x: drag.startFromX + dx, y: drag.startFromY + dy },
              to: { kind: 'free', x: drag.startToX + dx, y: drag.startToY + dy },
            };
          }),
        );
        return;
      }

      const cursor = { x: drag.startCanvasX + dx, y: drag.startCanvasY + dy };
      tick((els) => {
        // Element anchor wins over angle snap: pinning to another
        // shape is the strongest constraint and the most desirable
        // outcome when both are plausible.
        const anchorSnap = snapToAnchor(cursor, els, SNAP_THRESHOLD);
        let endpoint: Endpoint;
        if (anchorSnap) {
          endpoint = {
            kind: 'pinned',
            elementId: anchorSnap.elementId,
            anchor: anchorSnap.anchor,
          };
        } else {
          // Angle snap: lock the arrow to 45° increments from its
          // other endpoint when the cursor is within ~5° of one.
          // Keeps right-angle connectors easy to draw without
          // fighting the cursor at oblique angles.
          const arrow = els.find((e) => e.id === drag.arrowId && e.type === 'arrow') as
            | ArrowElement
            | undefined;
          let resolved = cursor;
          if (arrow) {
            const otherKey = drag.end === 'from' ? 'to' : 'from';
            const other = endpointPosition(arrow[otherKey], els);
            const ax = cursor.x - other.x;
            const ay = cursor.y - other.y;
            const len = Math.hypot(ax, ay);
            if (len > 0) {
              const angle = Math.atan2(ay, ax);
              const STEP = Math.PI / 4;
              const THRESH = (5 * Math.PI) / 180;
              const nearest = Math.round(angle / STEP) * STEP;
              if (Math.abs(angle - nearest) <= THRESH) {
                resolved = {
                  x: other.x + Math.cos(nearest) * len,
                  y: other.y + Math.sin(nearest) * len,
                };
              }
            }
          }
          endpoint = { kind: 'free', x: resolved.x, y: resolved.y };
        }
        return els.map((el) =>
          el.id === drag.arrowId && el.type === 'arrow' ? { ...el, [drag.end]: endpoint } : el,
        );
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, activeId]);

  useEffect(() => {
    if (formatSourceId === null && groupSourceId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFormatSourceId(null);
        setGroupSourceId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formatSourceId, groupSourceId]);

  // Global Delete / Backspace handler — wipes the current selection
  // (multi-select first, then falls back to single). Suppressed while a
  // label is being edited or focus is in any text input, so typing in a
  // text element doesn't blow away the element you're editing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      // A view-only session never deletes; bail before preventDefault so a
      // viewer's Backspace still triggers browser-back as usual.
      if (isReadOnly) return;
      const target = e.target as Element | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (editingId !== null) return;
      if (multiSelectedIds.size > 0) {
        e.preventDefault();
        deleteMultiSelected();
      } else if (selectedId !== null) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiSelectedIds, selectedId, editingId]);

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
        <main className="relative flex-1 bg-slate-50">
          <NotFound
            onCreateNew={() => {
              window.location.assign(`${window.location.origin}/live/new`);
            }}
          />
          <Explorer
            position={explorerPosition}
            minimized={explorerMinimized}
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
            onToggleMinimized={() => setExplorerMinimized((v) => !v)}
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
        // Visitors see "Make a copy" instead of "Share" — same slot,
        // different action. Hidden during the welcome flow so the
        // first-paint chrome stays minimal, and during hydration so
        // we don't render the button before we know whether the user
        // is the owner.
        onMakeCopy={!isOwner && hydrated && !anyWelcomeOpen && diagramId ? makeCopy : undefined}
        copying={copying}
        brandAccent={getTheme(activeTab.theme).elementStroke ?? undefined}
        onOpenShare={() => setShareDialogOpen(true)}
        onRename={setDiagramName}
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
          shareUrlFor={shareUrlFor}
          nameConfirmed={nameConfirmed}
          // Signed-in via Clerk → name is locked to the account
          // display name (same rule as the welcome modal, spec/04).
          // Guests pass undefined so the input + shuffle stay live.
          lockedName={clerkUserId ? clerkDisplayName : null}
          onSaveName={updateParticipantName}
          onCreateLink={createShareLink}
          onRevokeLink={revokeShareLink}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
      <Canvas
        tabName={activeTab.name}
        tabLocked={activeTabLocked}
        readOnly={isReadOnly}
        diagramName={diagramName}
        tabBackgroundPattern={activeTab.backgroundPattern ?? 'grid'}
        tabBackgroundColor={activeTab.backgroundColor ?? DEFAULT_BACKGROUND_COLOR}
        tabBackgroundOpacity={activeTab.backgroundOpacity ?? 1}
        tabPatternColor={activeTab.patternColor ?? DEFAULT_PATTERN_COLOR}
        mainRef={canvasMainRef}
        viewportZoom={viewportZoom}
        setViewportZoom={setViewportZoom}
        onFitToScreen={fitToScreen}
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
        paletteMinimized={paletteMinimized}
        explorerPosition={explorerPosition}
        explorerMinimized={explorerMinimized}
        canUndo={canUndo && !activeTabLocked}
        canRedo={canRedo && !activeTabLocked}
        onAddShape={addShape}
        onAddText={addText}
        onAddSticky={addSticky}
        onAddArrow={addArrow}
        onUndo={undo}
        onRedo={redo}
        onMovePalette={(x, y) => setPalettePosition({ x, y })}
        onToggleMinimized={() => setPaletteMinimized((v) => !v)}
        onResetPalette={() => setPalettePosition(null)}
        onMoveExplorer={(x, y) => setExplorerPosition({ x, y })}
        onToggleExplorerMinimized={() => setExplorerMinimized((v) => !v)}
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
        onToggleActivityMinimized={() => setActivityMinimized((v) => !v)}
        onResetActivity={() => setActivityPosition(null)}
        contextPosition={contextPosition}
        contextMinimized={contextMinimized}
        tabAccordionsOpen={tabAccordionsOpen}
        setTabAccordionsOpen={setTabAccordionsOpen}
        onMoveContext={(x, y) => setContextPosition({ x, y })}
        onToggleContextMinimized={() => setContextMinimized((v) => !v)}
        onResetContext={() => setContextPosition(null)}
        onRevertChange={revertChange}
        onActivityRowClick={handleActivityRowClick}
        onClearActivity={clearActivityForActiveTab}
        saveStatus={saveStatus}
        savedAt={savedAt}
        currentDiagramId={diagramId}
        onOpenDiagram={openDiagram}
        onNewDiagram={newDiagram}
        onRenameCurrent={setDiagramName}
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
        }}
        onSelect={selectElement}
        onBeginDrag={beginDrag}
        onBeginAnchorDrag={beginAnchorDrag}
        onBeginEdit={beginEdit}
        onCommitLabel={commitLabel}
        onCancelEdit={cancelEdit}
        onBeginEndpointDrag={beginEndpointDrag}
        onBeginArrowTranslate={beginArrowTranslate}
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
        onSetShapeKind={setShapeKindSelected}
        onDuplicateSelected={duplicateSelected}
        tabs={tabs}
        currentTabId={activeId}
        onSetLink={setLinkSelected}
        onClearLink={clearLinkSelected}
        onFollowLink={followLink}
        onOpenComments={openComments}
        showTemplatePicker={
          (hydrated && activeTab.elements.length === 0 && activeTab.templateChosen !== true) ||
          identityOnlyScreenOpen
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
        onExportTab={hydrated && !anyWelcomeOpen ? () => setExportOpen(true) : undefined}
        onImportTab={
          hydrated && !anyWelcomeOpen && !isReadOnly ? () => void importTabFromFile() : undefined
        }
        importError={importError}
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
          otherDiagrams={diagramList.filter((d) => d.id !== diagramId)}
          onCopyTabTo={copyActiveTabTo}
          onToggleLockTab={toggleActiveTabLock}
          onReorder={reorderTabs}
          participantsByTab={participantsByTab}
        />
      )}
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
                onAddComment={(text) => addComment(target.id, text)}
                onDeleteComment={(cid) => deleteComment(target.id, cid)}
                onResolve={() => resolveThread(target.id)}
                onUnresolve={() => unresolveThread(target.id)}
                onClose={closeComments}
              />
            );
          })()
        : null}
    </div>
  );
}
