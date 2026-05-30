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
import { NotFound } from '@/components/NotFound';
import { ShareDialog } from '@/components/ShareDialog';
import { TabBar } from '@/components/TabBar';
import { useDiagramHistory } from '@/hooks/useDiagramHistory';
import { ALIGN_SNAP_THRESHOLD, SNAP_THRESHOLD, type ArrowEnd, type DragMode } from '@/lib/canvas';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import {
  connectRoom,
  createShareLink as apiCreateShareLink,
  deleteDiagram as apiDeleteDiagram,
  deleteShareLink as apiDeleteShareLink,
  listDiagrams as apiListDiagrams,
  listShareLinks as apiListShareLinks,
  loadDiagram as apiLoadDiagram,
  loadSelfParticipant,
  loadSharedDiagram as apiLoadShared,
  saveDiagram as apiSaveDiagram,
  saveSelfParticipant,
  type RoomHandlers,
  type ShareLink,
  type ShareRole,
} from '@/lib/diagram-store';
import { buildTemplate, type TemplateKind } from '@/lib/templates';
import { getTheme, type ThemeId } from '@/lib/themes';

function createTab(name: string): Tab {
  return { id: crypto.randomUUID(), name, elements: [] };
}

const MIN_SIZE = 20;

type ShapeBounds = { x: number; y: number; width: number; height: number };

type DragState =
  | {
      kind: 'boxed';
      primaryId: string;
      mode: DragMode;
      startClientX: number;
      startClientY: number;
      startBounds: Map<string, ShapeBounds>;
      aspectLocked: boolean;
    }
  | {
      kind: 'arrow-endpoint';
      arrowId: string;
      end: ArrowEnd;
      startClientX: number;
      startClientY: number;
      startCanvasX: number;
      startCanvasY: number;
    };

function nextBounds(
  start: ShapeBounds,
  mode: DragMode,
  dx: number,
  dy: number,
  aspectLocked: boolean,
): ShapeBounds {
  const { x, y, width, height } = start;
  if (mode === 'move') return { x: x + dx, y: y + dy, width, height };

  const freeForCorner = (signX: number, signY: number) => {
    const newW = Math.max(MIN_SIZE, width + signX * dx);
    const newH = Math.max(MIN_SIZE, height + signY * dy);
    return { newW, newH };
  };

  const lockedForCorner = (signX: number, signY: number) => {
    const candW = Math.max(MIN_SIZE, width + signX * dx);
    const candH = Math.max(MIN_SIZE, height + signY * dy);
    const ratio = width / height;
    const useW = Math.abs(candW - width) >= Math.abs(candH - height);
    const newW = useW ? candW : candH * ratio;
    const newH = useW ? candW / ratio : candH;
    return { newW: Math.max(MIN_SIZE, newW), newH: Math.max(MIN_SIZE, newH) };
  };

  const compute = aspectLocked ? lockedForCorner : freeForCorner;

  switch (mode) {
    case 'resize-se': {
      const { newW, newH } = compute(1, 1);
      return { x, y, width: newW, height: newH };
    }
    case 'resize-sw': {
      const { newW, newH } = compute(-1, 1);
      return { x: x + (width - newW), y, width: newW, height: newH };
    }
    case 'resize-ne': {
      const { newW, newH } = compute(1, -1);
      return { x, y: y + (height - newH), width: newW, height: newH };
    }
    case 'resize-nw': {
      const { newW, newH } = compute(-1, -1);
      return { x: x + (width - newW), y: y + (height - newH), width: newW, height: newH };
    }
  }
}

function arrowReferencesAny(arrow: ArrowElement, ids: Set<string>): boolean {
  return (
    (arrow.from.kind === 'pinned' && ids.has(arrow.from.elementId)) ||
    (arrow.to.kind === 'pinned' && ids.has(arrow.to.elementId))
  );
}

export default function LivePage() {
  const initialTabs: Tab[] = [createTab('Tab 1')];

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
  // Canvas tool — Pan (default, drag-on-empty scrolls) vs Select
  // (drag-on-empty marquee-selects). Holding Space always pans
  // regardless. Lives in page so other components (e.g. status bar
  // later) can read it without prop-drilling through Canvas.
  const [canvasTool, setCanvasTool] = useState<'pan' | 'select'>('pan');
  // Picker mode lives here (rather than nearer `chooseTemplate`) so the
  // derived `welcomeOpen` below — used to gate page-level chrome — can
  // read it. See `openTemplatePicker` / `skipTemplatePicker` for the
  // transition rules.
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
  // Surfaced in the editor header as a Saving/Saved/Not-saved pill. The
  // autosave used to catch and swallow errors, which made an offline
  // API look identical to a successful save. Now every save attempt
  // flips this and the header is honest about what's happening.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [diagramName, setDiagramName] = useState('Untitled diagram');
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
  const [diagramList, setDiagramList] = useState<{ id: string; name: string; savedAt: number }[]>(
    [],
  );
  // Live presence: the participants connected to this diagram's
  // Durable Object room right now. Includes ourselves once our `hello`
  // round-trips. Rendered in the editor header avatar stack.
  const [livePresence, setLivePresence] = useState<Participant[]>([]);
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
  const refreshDiagramList = (ownerId: string) => {
    apiListDiagrams(ownerId)
      .then((list) => setDiagramList(list))
      .catch(() => {
        // Network glitch — the next save will retry. List staleness
        // for a beat is acceptable; we don't want a transient error
        // to wipe the rendered list.
      });
  };
  // `remoteUpdateRef` blocks the auto-save effect from re-broadcasting
  // a remote update back through the room (which would cause an
  // infinite save/broadcast loop between two connected clients).
  const remoteUpdateRef = useRef(false);
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
  // arrived via /live?s=<code>. Drives whether the Share button shows.
  const [isOwner, setIsOwner] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
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

  useLayoutEffect(() => {
    if (hydrated) return;
    // The post-mount hydration is async (the API is HTTP) so we run it
    // inside an IIFE. UI stays at the placeholder during the fetch;
    // the welcome modal is gated on `hydrated` so it doesn't flash the
    // Guest placeholder name into the input.
    void (async () => {
      const url = new URL(window.location.href);
      const id = url.searchParams.get('d');
      const shareCodeParam = url.searchParams.get('s');

      // Identity comes first because every diagram fetch needs an
      // owner id. Persistent id lives in localStorage as a tiny
      // bootstrap value; the participant record itself is in the API.
      let selfId = window.localStorage.getItem('livediagram:v2:self-id');
      if (!selfId) {
        selfId = crypto.randomUUID();
        window.localStorage.setItem('livediagram:v2:self-id', selfId);
      }
      const storedSelf = await loadSelfParticipant(selfId).catch(() => null);
      const self: Participant = storedSelf ?? {
        id: selfId,
        name: randomName(),
        color: randomColor(),
        status: 'online',
      };
      setSelfParticipant({ ...self, status: 'online' });
      if (!storedSelf) await saveSelfParticipant(self).catch(() => {});

      // Two URL flavours: `?d=<id>` is the owner's private URL,
      // `?s=<code>` is a share URL another participant follows. Visitor
      // arrivals get full diagram data via the share-code endpoint and
      // are flagged `!isOwner` so the Share button hides.
      if (shareCodeParam) {
        const resolution = await apiLoadShared(shareCodeParam).catch(() => null);
        if (resolution) {
          const { diagram: fetched, role } = resolution;
          resetTabs(fetched.tabs);
          setDiagramName(fetched.name);
          setActiveId(fetched.tabs[0]?.id ?? activeId);
          setLoadedExistingDiagram(true);
          setDiagramId(fetched.id);
          setDiagramShareable(fetched.shareable);
          setDiagramShareCode(fetched.shareCode);
          setIsOwner(fetched.ownerId === self.id);
          // Visitors inherit the role from their share code. Owners
          // overwrite this to 'edit' below.
          setSessionRole(fetched.ownerId === self.id ? 'edit' : role);
          if (window.localStorage.getItem('livediagram:v2:name-confirmed') !== '1') {
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
          setNameConfirmed(window.localStorage.getItem('livediagram:v2:name-confirmed') === '1');
          return;
        }
        if (fetched) {
          resetTabs(fetched.tabs);
          setDiagramName(fetched.name);
          setActiveId(fetched.tabs[0]?.id ?? activeId);
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
          }
          if (window.localStorage.getItem('livediagram:v2:name-confirmed') !== '1') {
            setTemplatePickerMode('identity');
          }
        }
        setDiagramId(id);
      }
      setNameConfirmed(window.localStorage.getItem('livediagram:v2:name-confirmed') === '1');
      refreshDiagramList(self.id);
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mint a diagram id on demand (when the user completes the welcome
  // flow), write it to the URL, and return it for the caller's
  // immediate use. No-op if we already have one. Returning the value
  // matters because state setters aren't synchronous — handlers that
  // need the id this same tick (e.g. an immediate localStorage save)
  // can't rely on `diagramId` having updated yet.
  const commitDiagramId = (): string => {
    if (diagramId) return diagramId;
    const id = crypto.randomUUID();
    const url = new URL(window.location.href);
    url.searchParams.set('d', id);
    // `replaceState` writes the id back without a navigation so the
    // user can copy the URL and reopen the same diagram later.
    window.history.replaceState({}, '', url.toString());
    setDiagramId(id);
    return id;
  };

  // Persist on any change after hydration. Debounced because the API
  // is HTTP and rapid drag/keystroke edits would otherwise hammer it.
  // 600 ms feels responsive without being chatty. The `remoteUpdateRef`
  // gate prevents echoing remote ops back to the room.
  useEffect(() => {
    if (!hydrated || !diagramId) return;
    // View-only visitors don't get to push edits. Local UI still lets
    // them experiment for usability, but those experiments stay
    // ephemeral — neither the API save nor the broadcast happens.
    if (isReadOnly) return;
    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const payload = { id: diagramId, name: diagramName, tabs, savedAt: Date.now() };
      setSaveStatus('saving');
      apiSaveDiagram(selfParticipant.id, payload)
        .then(() => {
          setSaveStatus('saved');
          refreshDiagramList(selfParticipant.id);
        })
        .catch(() => {
          // Network down, API unreachable, env var wrong — anything
          // that prevents persistence. The pill stays in the error
          // state until the next successful save so the user can't
          // miss it. The room broadcast still happens above so any
          // connected peer sees the in-memory edit; we just couldn't
          // durably persist it.
          setSaveStatus('error');
        });
      // Broadcast the new snapshot to peers via the room so other
      // viewers see the change in real time. The room's last-writer-
      // wins model means the most recent broadcast becomes the truth.
      roomRef.current?.send({
        kind: 'op',
        op: { kind: 'tabs', tabs, name: diagramName },
      });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [hydrated, diagramId, tabs, diagramName, selfParticipant.id, isReadOnly]);

  useEffect(() => {
    if (!hydrated) return;
    saveSelfParticipant(selfParticipant).catch(() => {});
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
        setLivePresence(
          participants.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            status: 'online',
          })),
        );
        // Drop selections AND cursors for any participant who's no
        // longer connected. Stops stale presence indicators from
        // sticking after a tab close or network drop.
        const present = new Set(participants.map((p) => p.id));
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
        if (op.kind === 'tabs') {
          remoteUpdateRef.current = true;
          resetTabs(op.tabs);
          setDiagramName(op.name);
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
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [viewportZoom, setViewportZoom] = useState(1);
  const canvasMainRef = useRef<HTMLElement>(null);
  // Keep latest zoom available to drag effects without re-creating them on
  // every zoom change (which would interrupt an in-progress drag).
  const zoomRef = useRef(viewportZoom);
  useEffect(() => {
    zoomRef.current = viewportZoom;
  }, [viewportZoom]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]!;

  // Per-element remote-selection map. Looks up each participant id
  // against the current `livePresence` so we can render their colour +
  // initials without bringing the participant blob along in every
  // `select` op. Self is filtered out — we don't need a "you're here"
  // badge on top of our own selection ring.
  const livePresenceById = new Map(livePresence.map((p) => [p.id, p] as const));
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
  const welcomeOpen =
    hydrated &&
    activeTab.elements.length === 0 &&
    activeTab.templateChosen !== true &&
    templatePickerMode === 'welcome';
  // Join screen for visitors landing on an existing diagram who haven't
  // confirmed their identity yet. Same chrome-hide rule as welcomeOpen
  // — focus the user on the name input before they start editing.
  const joinScreenOpen =
    hydrated && loadedExistingDiagram && !nameConfirmed && templatePickerMode === 'identity';
  const identityOnlyScreenOpen = joinScreenOpen;
  // Combined gate for the modal + the chrome hide. Either flavour of
  // welcome (new-diagram or join-existing) wants the same treatment.
  const anyWelcomeOpen = welcomeOpen || identityOnlyScreenOpen;

  // --- Element-scoped history helpers (active-tab aware) -------------------

  const commit = (mapElements: (els: Element[]) => Element[]) => {
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, elements: mapElements(t.elements) } : t)),
    );
  };

  const tick = (mapElements: (els: Element[]) => Element[]) => {
    tickTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, elements: mapElements(t.elements) } : t)),
    );
  };

  const undo = () => {
    undoHistory();
    setEditingId(null);
    setSelectedId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  const redo = () => {
    redoHistory();
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
    // Format-paint behaviour depends on the element kind:
    //   - boxed → boxed: copy width + height (the visual "shape"
    //     of the element)
    //   - arrow → arrow: copy strokeColor + opacity + arrowEnds
    //   - cross-kind paint is a no-op (boxed and arrows don't share
    //     enough formattable properties to make a sensible decision)
    if (isBoxed(source) && isBoxed(target)) {
      commit((els) =>
        els.map((el) =>
          el.id === targetId && isBoxed(el)
            ? { ...el, width: source.width, height: source.height }
            : el,
        ),
      );
    } else if (source.type === 'arrow' && target.type === 'arrow') {
      commit((els) =>
        els.map((el) =>
          el.id === targetId && el.type === 'arrow'
            ? {
                ...el,
                ...(source.strokeColor ? { strokeColor: source.strokeColor } : {}),
                ...(source.opacity !== undefined ? { opacity: source.opacity } : {}),
                ...(source.arrowEnds ? { arrowEnds: source.arrowEnds } : {}),
              }
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

  // Delete the entire diagram: remove from the API, strip the id from
  // the URL, and reload to a fresh welcome flow. Not undoable — the
  // user explicitly opened the title menu and picked Delete. We don't
  // await the delete so the redirect is instant; the row will be gone
  // by the time the next list query runs.
  const deleteDiagram = () => {
    if (typeof window === 'undefined') return;
    if (diagramId) void apiDeleteDiagram(diagramId).catch(() => {});
    window.location.assign(`${window.location.origin}/live`);
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

  const renameTab = (id: string, name: string) => {
    commitTabs((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
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

  // "New Diagram" from the Explorer. The current diagram's already in
  // localStorage (we save on every change after hydration), so we don't
  // need to persist anything — navigating to /live with no ?d= triggers
  // a full reload and lands the user in the welcome flow for a fresh id.
  // Using `window.location.assign` rather than state reset because the
  // page owns a lot of derived state (history hook, drag state, picker
  // mode, etc.) and a clean reload is the simplest way to guarantee a
  // pristine starting point.
  const newDiagram = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/live`);
  };

  // Open a different diagram from the Explorer list. Same reload trick
  // as `newDiagram` — the auto-save has already persisted the current
  // diagram so nothing is lost.
  const openDiagram = (id: string) => {
    if (typeof window === 'undefined') return;
    if (id === diagramId) return;
    const url = new URL(`${window.location.origin}/live`);
    url.searchParams.set('d', id);
    window.location.assign(url.toString());
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('livediagram:v2:name-confirmed', '1');
    }
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
    await saveSelfParticipant(updated).catch(() => {});
  };

  // Create a new share link for the current diagram with the given
  // role. Also commits the diagram id (first share == canonical
  // "this leaves your device" point) and flips the room-open flag.
  const createShareLink = async (role: ShareRole) => {
    const id = commitDiagramId();
    confirmName();
    try {
      const link = await apiCreateShareLink(selfParticipant.id, id, role);
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

  // Absolute share URL helper used by the dialog. Router stitches
  // /live onto the app's hostname so `${origin}/live?s=<code>` always
  // resolves to the editor.
  const shareUrlFor = (code: string) =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/live?s=${code}`;

  // Dismiss the welcome / templates / identity modal without picking
  // anything. For the welcome flow this marks the tab as
  // template-chosen so the modal doesn't reappear; for the identity
  // flow it just records the name confirmation. Always resets the
  // picker mode to 'welcome' so future first-run sessions are
  // unaffected, and mints the diagram id if this is the first-run
  // session so Skip / X still produces a shareable URL.
  const skipTemplatePicker = () => {
    if (templatePickerMode === 'identity') {
      confirmName();
      setTemplatePickerMode('welcome');
      return;
    }
    commitDiagramId();
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
    // Welcome / Browse-templates is the canonical "commit point" for a new
    // diagram. Mint an id + put it in the URL now if we haven't already.
    commitDiagramId();
    if (name && name !== selfParticipant.name) {
      setSelfParticipant((p) => ({ ...p, name }));
    }
    confirmName();
    // Reset the picker mode to 'welcome' so a future first-run session
    // (new diagram, fresh URL) starts in the right variant.
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
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundPattern: pattern } : t)),
    );
  };

  // Applying a theme swaps backdrop colours/pattern, records the theme
  // id (so future element-create calls in `addBoxed` inherit the theme),
  // AND retroactively recolours every shape + text element on the tab to
  // match. Sticky notes are skipped — the amber palette is iconic. Any
  // per-element colour overrides the user previously set are replaced;
  // applying a theme is meant to be a one-tap "reset to this look".
  const setTheme = (id: ThemeId) => {
    const theme = getTheme(id);
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        const elements = t.elements.map((el) => {
          if (el.type === 'shape') {
            return {
              ...el,
              ...(theme.elementFill ? { fillColor: theme.elementFill } : { fillColor: undefined }),
              ...(theme.elementStroke
                ? { strokeColor: theme.elementStroke }
                : { strokeColor: undefined }),
              ...(theme.elementText ? { textColor: theme.elementText } : { textColor: undefined }),
            };
          }
          if (el.type === 'text') {
            return {
              ...el,
              ...(theme.elementText ? { textColor: theme.elementText } : { textColor: undefined }),
            };
          }
          if (el.type === 'arrow') {
            return {
              ...el,
              ...(theme.elementStroke
                ? { strokeColor: theme.elementStroke }
                : { strokeColor: undefined }),
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

  const setBackgroundColor = (color: string) => {
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, backgroundColor: color } : t)));
  };

  const setBackgroundOpacity = (opacity: number) => {
    commitTabs((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, backgroundOpacity: opacity } : t)),
    );
  };

  const setPatternColor = (color: string) => {
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, patternColor: color } : t)));
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
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
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

  // Multi-select duplicate: clones every multi-selected boxed element with
  // a small diagonal offset and selects the new copies as the next
  // multi-selection. Arrows aren't duplicated (matches single-element
  // Duplicate semantics — connections are user-rebuilt).
  const duplicateMultiSelected = () => {
    if (multiSelectedIds.size === 0) return;
    const offset = 24;
    const sources = activeTab.elements.filter((el) => multiSelectedIds.has(el.id) && isBoxed(el));
    if (sources.length === 0) return;
    const copies: BoxedElement[] = sources.map((s) => ({
      ...(s as BoxedElement),
      id: crypto.randomUUID(),
      x: (s as BoxedElement).x + offset,
      y: (s as BoxedElement).y + offset,
      // Drop group membership — duplicates are independent. Existing
      // groupings on the multi-selection don't carry over.
      groupId: undefined,
    }));
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
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source) return;
    const shouldLock = !(source.locked === true);
    const ids = memberIdsOf(selectedId);
    commit((els) => els.map((el) => (ids.has(el.id) ? { ...el, locked: shouldLock } : el)));
  };

  const toggleAspectLockSelected = () => {
    if (!selectedId) return;
    const source = activeTab.elements.find((el) => el.id === selectedId);
    if (!source || !isBoxed(source)) return;
    const shouldLock = !(source.aspectLocked === true);
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, aspectLocked: shouldLock } : el)),
    );
  };

  const bringSelectedToFront = () => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) => bringManyToFront(els, ids));
  };

  const sendSelectedToBack = () => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) => sendManyToBack(els, ids));
  };

  const setTextSizeSelected = (size: TextSize) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, textSize: size } : el)),
    );
  };

  const setTextAlignSelected = (x: TextAlignX, y: TextAlignY) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isBoxed(el) ? { ...el, textAlignX: x, textAlignY: y } : el,
      ),
    );
  };

  const setFillColorSelected = (color: string) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (el.type === 'shape' || el.type === 'sticky')
          ? { ...el, fillColor: color }
          : el,
      ),
    );
  };

  const setStrokeColorSelected = (color: string) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (el.type === 'shape' || el.type === 'sticky' || el.type === 'arrow')
          ? { ...el, strokeColor: color }
          : el,
      ),
    );
  };

  const setTextColorSelected = (color: string) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, textColor: color } : el)),
    );
  };

  const setLinkSelected = (tabId: string) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) =>
      els.map((el) => (ids.has(el.id) ? { ...el, link: { kind: 'tab' as const, tabId } } : el)),
    );
  };

  const clearLinkSelected = () => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
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
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) => els.map((el) => (ids.has(el.id) ? { ...el, opacity } : el)));
  };

  const setPaddingSelected = (padding: import('@livediagram/diagram').Padding) => {
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
    commit((els) => els.map((el) => (ids.has(el.id) && isBoxed(el) ? { ...el, padding } : el)));
  };

  const setArrowEndsSelected = (arrowEnds: import('@livediagram/diagram').ArrowEnds) => {
    if (!selectedId) return;
    commit((els) =>
      els.map((el) => (el.id === selectedId && el.type === 'arrow' ? { ...el, arrowEnds } : el)),
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
    if (!selectedId) return;
    const ids = memberIdsOf(selectedId);
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
    if (formatSourceId !== null) return;
    setGroupSourceId(null);
    setSelectedId(elementId);
    setEditingId(elementId);
  };

  const commitLabel = (elementId: string, label: string) => {
    commit((els) => els.map((el) => (el.id === elementId && isBoxed(el) ? { ...el, label } : el)));
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
    if (element.locked === true) return;

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
    if (!element || !isBoxed(element) || element.locked === true) return;
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

  const beginEndpointDrag = (arrowId: string, end: ArrowEnd, e: ReactPointerEvent) => {
    if (formatSourceId !== null || groupSourceId !== null) return;
    const arrow = activeTab.elements.find((el) => el.id === arrowId);
    if (!arrow || arrow.type !== 'arrow') return;
    setSelectedId(arrowId);
    if (arrow.locked === true) return;
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
          const next = nextBounds(start, drag.mode, dx, dy, drag.aspectLocked);
          tick((els) =>
            els.map((el) => (el.id === drag.primaryId && isBoxed(el) ? { ...el, ...next } : el)),
          );
        }
        return;
      }

      const cursor = { x: drag.startCanvasX + dx, y: drag.startCanvasY + dy };
      tick((els) => {
        const snap = snapToAnchor(cursor, els, SNAP_THRESHOLD);
        const endpoint: Endpoint = snap
          ? { kind: 'pinned', elementId: snap.elementId, anchor: snap.anchor }
          : { kind: 'free', x: cursor.x, y: cursor.y };
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
        <NotFound
          onCreateNew={() => {
            window.location.assign(`${window.location.origin}/live`);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <EditorHeader
        diagramName={diagramName}
        participants={
          // Avatar stack: live presence is authoritative when the room
          // is connected. For private diagrams there's no room, so we
          // hide the stack entirely (a single "you" avatar with no
          // peers carries no information).
          diagramShareable ? (livePresence.length > 0 ? livePresence : [selfParticipant]) : []
        }
        hideTitle={anyWelcomeOpen}
        showShare={isOwner && hydrated && !anyWelcomeOpen}
        shareable={diagramShareable}
        saveStatus={saveStatus}
        onOpenShare={() => setShareDialogOpen(true)}
        onRename={setDiagramName}
        onDeleteDiagram={deleteDiagram}
      />
      {shareDialogOpen ? (
        <ShareDialog
          participant={selfParticipant}
          links={shareLinks}
          shareUrlFor={shareUrlFor}
          nameConfirmed={nameConfirmed}
          onSaveName={updateParticipantName}
          onCreateLink={createShareLink}
          onRevokeLink={revokeShareLink}
          onClose={() => setShareDialogOpen(false)}
        />
      ) : null}
      <Canvas
        tabName={activeTab.name}
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
        onCanvasPointerMove={(x, y) => broadcastCursor(x !== null && y !== null ? { x, y } : null)}
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
        canUndo={canUndo}
        canRedo={canRedo}
        onAddShape={addShape}
        onAddText={addText}
        onAddSticky={addSticky}
        onAddArrow={addArrow}
        onUndo={undo}
        onRedo={redo}
        onMovePalette={(x, y) => setPalettePosition({ x, y })}
        onToggleMinimized={() => setPaletteMinimized((v) => !v)}
        onMoveExplorer={(x, y) => setExplorerPosition({ x, y })}
        onToggleExplorerMinimized={() => setExplorerMinimized((v) => !v)}
        diagramList={diagramList}
        currentDiagramId={diagramId}
        onOpenDiagram={openDiagram}
        onNewDiagram={newDiagram}
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
        onBeginFormatPainter={beginFormatPainter}
        onCancelFormatPainter={exitFormatPainter}
        onBeginGroup={beginGroup}
        onCancelGroup={exitGroupMode}
        onUngroup={ungroupSelected}
        onBringToFront={bringSelectedToFront}
        onSendToBack={sendSelectedToBack}
        onSetTextSize={setTextSizeSelected}
        onSetTextAlign={setTextAlignSelected}
        onSetFillColor={setFillColorSelected}
        onSetStrokeColor={setStrokeColorSelected}
        onSetTextColor={setTextColorSelected}
        onSetOpacity={setOpacitySelected}
        onResetColors={resetColorsSelected}
        onSetPadding={setPaddingSelected}
        onSetArrowEnds={setArrowEndsSelected}
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
        templatePickerMode={templatePickerMode}
        welcomeOpen={anyWelcomeOpen}
        selfParticipant={selfParticipant}
        onChooseTemplate={chooseTemplate}
        onSkipTemplatePicker={skipTemplatePicker}
        onOpenTemplatePicker={openTemplatePicker}
        tabThemeId={(activeTab.theme as ThemeId | undefined) ?? 'brand'}
        onSetTheme={setTheme}
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
      {welcomeOpen ? null : (
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
          onReorder={reorderTabs}
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
