import {
  useEffect,
  useEffectEvent,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { setRemoteBesideTab, syncRemoteBesideTabs } from '@/lib/split-presence';
import { noteAccessEnded } from '@/lib/access-notice';
import type { Tab } from '@liveplanner/project';
import {
  type AgentPresence,
  type ChangesetRoomOp,
  type ItemsRoomOp,
  type ItemTypesRoomOp,
  type SheetPresenceOp,
  type SheetsRoomOp,
} from '@liveplanner/api-schema';
import { nextFreeColor, type Participant } from '@/lib/identity';
import {
  apiCreateRoomTicket,
  connectRoom,
  getSessionSharePassword,
  type RoomHandlers,
} from '@/lib/api-client';
import { keepPlanGrantFresh, planGrant } from '@/lib/api/plan-grants';
import {
  createPresenceCoalescer,
  type CursorPos,
  type PresenceCoalescer,
} from './presence-coalescer';
import type { RemoteSelection } from '@/lib/presence-rows';
import { pruneMapToPresent } from './editor-page-helpers';
import { applyRoomOpToTabs } from './room-op-apply';
import { keepUnsavedTabChanges } from './meta-keep-local';
import { migrateRoomOp } from './room-op-migrate';
import { roomOpIsWellFormed } from './room-op-shape';
import { foldRemoteOpIntoBaseline, type SaveBaselineRefs } from './save-baseline';
import { isSupersededByOwnWrite, type OwnElementWrites } from './own-element-writes';
import { debugLog } from '@/lib/debug-log';
import { shareLinkOpEffect } from './share-link-ops';
import {
  endPeerDragPreview,
  prunePeerDragPreviews,
  receivePeerDragPreview,
} from '@/hooks/collab/peer-drag-previews';
import { joinRefusedBecauseTrashed } from './room-refusal';

// Realtime room: one WebSocket per project, opened for every project saved on
// the server (docs/specs/024-agents/agent-changesets.md "Rooms for personal projects"). Lifted out of editor-page.tsx verbatim — the
// presence reconciliation (unique-colour, idle seeding, leaver cleanup)
// and the onOp application (tab / project-meta / select / cursor /
// tab-focus / log / share-revoked) are unchanged. All the state
// it drives lives in the page and is passed in; the deps array stays
// [hydrated, projectId, projectServerStored] (a name/colour change must not
// reconnect), so the exhaustive-deps disable rides along.
export function useRoomConnection(opts: {
  hydrated: boolean;
  projectId: string | null;
  // Saved on the server, so it has a room: every such project, personal ones included, since an
  // agent writing through the api is a second writer even where nobody else can open it.
  projectServerStored: boolean;
  // False keeps the room closed whatever else holds (an ended workbench session). Defaults to true.
  enabled?: boolean;
  // A workbench session (docs/specs/013-workspace/blueprints/workbench-embeds.md): told when the room
  // ends it (close 4006), or when an access change does (4005, WB31), instead of reloading.
  onWorkbenchEnded?: () => void;
  // The project's team (docs/specs/013-workspace/team-shared-projects.md), null for a personal project. A team
  // project is a live room for its members even without a share link,
  // so presence opens for it the same way a shared project does.
  projectTeamId: string | null;
  selfParticipant: Participant;
  sessionShareCode: string | null;
  lastSeenRef: MutableRefObject<Map<string, number>>;
  // Bumps a peer's last-seen (usePresenceState), publishing when they arrive or return from idle.
  markSeen: (participantId: string) => void;
  selfParticipantRef: MutableRefObject<Participant>;
  // The autosave's baseline (docs/specs/012-collaboration/collab-race-hardening.md): every project op a peer sends is
  // folded into it as well as into the tabs on screen, so the next local save
  // neither mistakes it for ours nor ships it back out.
  saveBaseline: SaveBaselineRefs;
  // This editor's element writes the room has not sequenced yet: a peer's update of one was ordered first, and
  // ours replaces it everywhere, so it is not shown here (own-element-writes.ts).
  ownWrites?: OwnElementWrites;
  // Counts a peer op applied to `tabs` (useEditorState's opsApplied, read by the autosave).
  countAppliedOp: () => void;
  sessionShareCodeRef: MutableRefObject<string | null>;
  roomRef: MutableRefObject<ReturnType<typeof connectRoom> | null>;
  // Merge a peer's tab / project-meta change into the present, PRESERVING
  // the local undo / redo stacks (peers autosave ~600ms, so clearing
  // history on each would wipe undo continuously during a shared session).
  // A peer's op into the present and every undo / redo snapshot (historyApplyRemoteOp), so undo
  // never brings back what the peer changed.
  applyRemoteOp: (apply: (prev: Tab[]) => Tab[]) => void;
  // The tabs whose content is here (fetched, or made here), and marking one so: a peer's element op
  // for a tab still waiting on its first fetch is left to that fetch.
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  markTabLoaded: (id: string) => void;
  setLivePresence: Dispatch<SetStateAction<Participant[]>>;
  setLiveAgents: Dispatch<SetStateAction<AgentPresence[]>>;
  setRemoteSelections: Dispatch<SetStateAction<Map<string, RemoteSelection>>>;
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
  setRemoteTabFocus: Dispatch<SetStateAction<Map<string, string>>>;
  setProjectName: Dispatch<SetStateAction<string>>;
  setSelfParticipant: Dispatch<SetStateAction<Participant>>;
  // The project went to the Trash (docs/specs/013-workspace/trash.md): the
  // worker's project-trashed op, or the room closing the socket with 4004.
  // Stable, like the others, so it can't reopen the socket.
  receiveProjectTrashed: () => void;
  // Re-hydrate tab content from D1 when the room can't replay our gap
  // (docs/specs/012-collaboration/resync-without-reload.md). Stable, like the others, so it can't reopen the
  // socket — the effect's dep list stays [hydrated, projectId, shareable].
  resyncFromServer: () => Promise<void>;
  // An agent's changeset (docs/specs/024-agents/agent-changesets.md "In the editor"), relayed by the
  // worker; useChangesetFeed decides what to do with it.
  receiveChangeset: (op: ChangesetRoomOp) => void;
  // Item writes the api made (docs/specs/026-plan/items.md "Live for everyone"). System-only.
  receiveItems: (op: ItemsRoomOp) => void;
  // A stored type catalogue (docs/specs/026-plan/item-types.md "Storage and sync"). System-only.
  receiveItemTypes: (op: ItemTypesRoomOp) => void;
  // A peer's hands on a Plan card (docs/specs/026-plan/plan-board.md). Presence.
  receivePlanPresence: (
    from: string,
    op: { tabId: string; itemId: string | null; state?: 'drag' | 'view' },
  ) => void;
  // Sheet writes the api made (docs/specs/029-sheets/sheet-store.md "Live for everyone"). System-only.
  receiveSheets: (op: SheetsRoomOp) => void;
  // A peer's selection on a sheet (docs/specs/029-sheets/sheet.md "Collaboration"). Presence.
  receiveSheetPresence: (from: string, op: SheetPresenceOp) => void;
  // The room has greeted this connection (its first presence list): what was relayed before it
  // joined is caught up through the api (useChangesetFeed's checkSinceLoad).
  onRoomJoined: () => void;
  // A Participant session's ticket (docs/specs/013-workspace/share-roles.md) carries the adder key the room
  // stamps on what it adds, and the key comes back for `onAdderKey`.
  onAdderKey?: (key: string | null) => void;
}) {
  const {
    hydrated,
    projectId,
    projectServerStored,
    enabled = true,
    onWorkbenchEnded,
    projectTeamId,
    selfParticipant,
    sessionShareCode,
    lastSeenRef,
    markSeen,
    selfParticipantRef,
    saveBaseline,
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
    setProjectName,
    setSelfParticipant,
    receiveProjectTrashed,
    resyncFromServer,
    receiveChangeset,
    receiveItems,
    receiveItemTypes,
    receivePlanPresence,
    receiveSheets,
    receiveSheetPresence,
    onRoomJoined,
    onAdderKey,
  } = opts;

  // Who we connect as, read when the socket opens: the id is stable for the session, and a name or colour
  // change goes out over the open socket rather than warranting a reconnect.
  const connectAs = useEffectEvent(() => ({
    self: {
      id: selfParticipant.id,
      key: selfParticipant.key,
      name: selfParticipant.name,
      color: selfParticipant.color,
    },
    shareCode: sessionShareCode,
  }));
  const announceAdderKey = useEffectEvent((key: string | null) => onAdderKey?.(key));
  // Each peer's server-verified role by presence id, refreshed with every presence list.
  const roleByPresenceRef = useRef<Map<string, string | undefined>>(new Map());

  // Whether this connection has had its first presence list: reset by every (re)open below.
  const joinedRef = useRef(false);
  const roomJoined = useEffectEvent(() => onRoomJoined());
  // The room's handlers, as effect events: the socket opens once per project (the effect below), and each
  // message still runs against the current props, which is what a handler must see.
  const roomPresence = useEffectEvent(
    (
      participants: Parameters<NonNullable<RoomHandlers['onPresence']>>[0],
      agents: AgentPresence[],
    ) => {
      const now = Date.now();
      setLiveAgents(agents);
      if (!joinedRef.current) {
        joinedRef.current = true;
        roomJoined();
      }
      // Each peer's server-verified role, read when their drag preview arrives: only an editor's is
      // drawn (docs/specs/008-canvas/drag-preview.md).
      roleByPresenceRef.current = new Map(participants.map((p) => [p.id, p.role] as const));
      setLivePresence(
        participants.map((p) => ({
          id: p.id,
          // The peer's project-write id (docs/specs/012-collaboration/participant-responses.md), claimed in their
          // hello and relayed unchanged — it is what joins their saved
          // answer on a temperature check back to them.
          // `p.id` cannot: the room mints that per socket (docs/specs/015-api/public-api-and-tokens.md §6),
          // so it matches nothing that was ever written down.
          ...(p.key ? { key: p.key } : {}),
          name: p.name,
          color: p.color,
          // Status + lastActiveAt are derived locally rather than
          // carried on the wire — the server doesn't track idle
          // time. Seed any peer we haven't seen with `now` so the
          // hover card reads "Active just now" until their first op
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
      // Seed lastSeen for any presence-arrival we haven't tracked yet, publishing it so the next
      // render has their `lastActiveAt`.
      for (const p of participants) {
        if (!lastSeenRef.current.has(p.id)) markSeen(p.id);
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
        const conflictHolder = participants.find((p) => p.id !== live.id && p.color === live.color);
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
      prunePeerDragPreviews(present);
      // Drop tab-focus entries for people who left so their avatar
      // dot doesn't linger on a tab they no longer occupy, AND seed
      // from the presence list: the room echoes each peer's current
      // tab here, so a late joiner immediately sees where everyone
      // already is instead of defaulting them to the first tab until
      // they next switch. Skip self — the remote map never holds it
      // (the live relay excludes the sender), and our own tab is
      // tracked from local activeId. A fresh Map guarantees re-render.
      const selfId = selfParticipantRef.current.id;
      setRemoteTabFocus((prev) => {
        const next = new Map(pruneMapToPresent(prev, present));
        for (const p of participants) {
          if (p.tabId && p.id !== selfId) next.set(p.id, p.tabId);
        }
        return next;
      });
      syncRemoteBesideTabs(participants, selfId);
      setRemoteSelections((prev) => pruneMapToPresent(prev, present));
      setRemoteCursors((prev) => pruneMapToPresent(prev, present));
      // Same for the lastSeen idle tracker (a plain ref, not state):
      // drop departed peers so it can't grow unbounded over a
      // long-lived room with people joining / leaving via share links.
      for (const id of [...lastSeenRef.current.keys()]) {
        if (!present.has(id)) lastSeenRef.current.delete(id);
      }
    },
  );

  const roomOp = useEffectEvent(
    (
      from: Parameters<NonNullable<RoomHandlers['onOp']>>[0],
      op: Parameters<NonNullable<RoomHandlers['onOp']>>[1],
      presence: PresenceCoalescer,
    ) => {
      // Any op from a peer counts as "they're still here". Bumps
      // the idle timer used by the avatar's away/offline status
      // derivation. Cursor packets are the most frequent so this
      // doubles as a perfectly fine activity heartbeat.
      markSeen(from);
      if (
        op.kind === 'tab' ||
        op.kind === 'el' ||
        op.kind === 'vote' ||
        op.kind === 'el-delta' ||
        op.kind === 'tab-meta' ||
        op.kind === 'project-meta'
      ) {
        // A project change from a peer: a whole tab, one element (docs/specs/012-collaboration/realtime-conflict-resolution.md),
        // one dot (docs/specs/012-collaboration/session-tools.md), one answer / idea / tick / comment (docs/specs/012-collaboration/collab-race-hardening.md),
        // non-element tab fields, or the project's name
        // and tab list. One pure function applies each (room-op-apply.ts),
        // to the tabs on screen AND to the autosave's baseline, so the
        // change is known to be the peer's and is never saved or broadcast
        // back as if it were ours (docs/specs/012-collaboration/collab-race-hardening.md).
        if (op.kind === 'project-meta') setProjectName(op.name);
        // A tab not fetched yet is a placeholder: an element added to it would make it look edited, so
        // its fetch would be thrown away and the next save would write the placeholder over the real
        // tab. Its fetch brings the element. A whole tab from a peer is its content: loaded.
        if (op.kind === 'el' && !loadedTabIdsRef.current.has(op.tabId)) return;
        if (op.kind === 'tab') markTabLoaded(op.tabId);
        // A dragger's real change has arrived: their live preview has done its job.
        endPeerDragPreview(from);
        // Ordered before our own pending write of the same element, which replaces it on every screen: showing it
        // here alone would leave this screen on the peer's copy (realtime-conflict-resolution.md "Same-element
        // edits converge").
        if (ownWrites && isSupersededByOwnWrite(ownWrites, op)) {
          debugLog('[room] peer update superseded by our pending write');
          return;
        }
        // A peer's tab list keeps what this editor has not saved yet: a tab added here, one deleted here
        // (keepUnsavedTabChanges), judged against the baseline as it was before the list arrived.
        const savedBefore = saveBaseline.tabs.current;
        applyRemoteOp((prev) =>
          op.kind === 'project-meta'
            ? keepUnsavedTabChanges(prev, applyRoomOpToTabs(prev, op), savedBefore)
            : applyRoomOpToTabs(prev, op),
        );
        foldRemoteOpIntoBaseline(saveBaseline, op);
        // In the same batch as the tabs update, so the render that shows the op also counts it.
        countAppliedOp();
      } else if (op.kind === 'select') {
        setRemoteSelections((prev) => {
          const next = new Map(prev);
          // tabId scopes the badge + docs/specs/007-editor/editor-app.md lock to the sender's tab;
          // absent (older peer) = tab-unknown, shown everywhere.
          next.set(from, { elementId: op.elementId, tabId: op.tabId });
          return next;
        });
      } else if (op.kind === 'cursor') {
        // Coalesced: buffered and committed once per animation frame
        // (see createPresenceCoalescer). Cursor
        // packets arrive at up to 30 Hz PER PEER, and a setState per
        // packet re-rendered the whole editor tree per message.
        presence.cursor(
          from,
          op.x !== null && op.y !== null ? { tabId: op.tabId, x: op.x, y: op.y } : null,
        );
      } else if (op.kind === 'drag-preview') {
        // A collaborator mid-drag (docs/specs/008-canvas/drag-preview.md): drawn, never written.
        receivePeerDragPreview(from, op, (id) => roleByPresenceRef.current.get(id));
      } else if (op.kind === 'tab-focus') {
        setRemoteTabFocus((prev) => {
          const next = new Map(prev);
          next.set(from, op.tabId);
          return next;
        });
        // Their other pane, side by side (docs/specs/007-editor/split-view.md "Presence").
        setRemoteBesideTab(from, op.besideTabId);
      } else if (op.kind === 'share-revoked' || op.kind === 'share-rescoped') {
        // The owner revoked or rescoped a share link (share-link-ops.ts).
        // A session hydrated with that exact code leaves the editor on a
        // revoke and reloads into the new scope on a rescope; the room
        // closes its socket either way. Everyone else keeps their session.
        const effect = shareLinkOpEffect(op, from, sessionShareCodeRef.current);
        if (effect === 'leave') {
          // The Explorer says why we arrived (lib/access-notice.ts), rather than landing without a word.
          noteAccessEnded(projectId, 'revoked');
          window.location.assign('/explorer');
        } else if (effect === 'reload') window.location.reload();
      } else if (op.kind === 'changeset') {
        // An agent's changeset, applied, outlined and toasted by useChangesetFeed. System-only, like
        // the share ops: the room refuses one from a client socket.
        if (from === 'system') receiveChangeset(op);
      } else if (op.kind === 'plan-presence') {
        receivePlanPresence(from, op);
      } else if (op.kind === 'sheet-presence') {
        receiveSheetPresence(from, op);
      } else if (op.kind === 'sheets') {
        // Sheet writes (docs/specs/029-sheets/sheet-store.md). System-only, as items.
        if (from === 'system') receiveSheets(op);
      } else if (op.kind === 'items') {
        // Item writes (docs/specs/026-plan/items.md). System-only: items change only through the api,
        // and the room refuses this op from a client socket.
        if (from === 'system') receiveItems(op);
      } else if (op.kind === 'item-types') {
        // The type catalogue (docs/specs/026-plan/item-types.md). System-only: it changes only through
        // the api.
        if (from === 'system') receiveItemTypes(op);
      } else if (op.kind === 'project-trashed') {
        // The project went to the Trash. System-only, like the share ops:
        // the room refuses it from a client socket.
        if (from === 'system') receiveProjectTrashed();
      }
    },
  );

  const roomProjectTrashed = useEffectEvent(() => receiveProjectTrashed());
  // A workbench frame cannot reload into another access path: an access change ends its session.
  const roomAccessChanged = useEffectEvent(() => {
    if (onWorkbenchEnded) return onWorkbenchEnded();
    // Whatever the reload's access check answers, a refusal says why (lib/access-notice.ts).
    noteAccessEnded(projectId, 'changed');
    window.location.reload();
  });
  const roomWorkbenchEnded = useEffectEvent(() => onWorkbenchEnded?.());
  // A join turned away (docs/specs/013-workspace/trash.md): trashed between our load and our join, the room
  // refuses us instead of telling us. Ask the api once per refusal (one probe at a time); only a trashed
  // answer changes anything.
  const refusalProbeRef = useRef(false);
  const roomRefused = useEffectEvent(() => {
    if (!projectId || refusalProbeRef.current) return;
    refusalProbeRef.current = true;
    void joinRefusedBecauseTrashed({
      projectId,
      selfId: selfParticipant.id,
      shareCode: sessionShareCodeRef.current,
    })
      .then((trashed) => {
        if (trashed) receiveProjectTrashed();
      })
      .finally(() => {
        refusalProbeRef.current = false;
      });
  });
  const roomResync = useEffectEvent(() => {
    // The room couldn't bridge our reconnect gap from its op log
    // (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1) -- we fell too far behind or it restarted.
    // Re-fetch the tab rows from D1 IN PLACE (docs/specs/012-collaboration/resync-without-reload.md). This used to
    // be a full page reload, on the assumption it was rare; live
    // telemetry said otherwise, and a reload also destroyed the
    // viewport, selection, and undo history to fix stale content.
    void resyncFromServer();
  });

  useEffect(() => {
    // Open the realtime room for every server-stored project: shared and team projects for their
    // people (docs/specs/013-workspace/team-shared-projects.md), and personal ones too, so an agent's
    // changeset reaches the person working on it (docs/specs/024-agents/agent-changesets.md).
    if (!enabled || !hydrated || !projectId || !projectServerStored) {
      // Make sure any state from a previous shared session is cleared
      // when we transition back to private (revoke share / leave team).
      setLivePresence([]);
      setLiveAgents([]);
      setRemoteSelections(new Map());
      prunePeerDragPreviews(new Set());
      return;
    }
    joinedRef.current = false;
    // Batched cursor presence, committed one Map update per animation frame
    // instead of one per packet — see the coalescer. Created per effect run,
    // so a reconnect starts with empty buffers.
    const presence = createPresenceCoalescer({ setRemoteCursors });

    const handlers: RoomHandlers = {
      onPresence: (participants, agents) => roomPresence(participants, agents),
      // Elements in a former stored shape from a peer loaded before a deploy are migrated
      // before anything applies them (docs/specs/006-project/stroke-points.md); an op that is not the
      // shape its kind promises is dropped first (room-op-shape.ts).
      onOp: (from, op) => {
        if (!roomOpIsWellFormed(op)) {
          debugLog('[room] malformed op dropped', { kind: (op as { kind?: unknown }).kind });
          return;
        }
        roomOp(from, migrateRoomOp(op), presence);
      },
      onProjectTrashed: () => roomProjectTrashed(),
      // Reload so the access gates run again (a password prompt, a refusal page, or the editor).
      onAccessChanged: () => roomAccessChanged(),
      onWorkbenchEnded: () => roomWorkbenchEnded(),
      onRefused: () => roomRefused(),
      onResync: () => roomResync(),
    };
    // Every session joins through a one-time room ticket (docs/specs/015-api/api.md "Realtime model"),
    // minted over REST, where the access gates already read the guest signature, the share code and its
    // password, and team membership as headers. The WS upgrade can't carry headers, so before tickets
    // those rode the upgrade URL, which is logged; now only the spent-on-use ticket does. The connector
    // mints its first ticket itself, so it exists while that request runs and keeps what the editor
    // says meanwhile (its selection, its tab) for the room.
    const { self, shareCode } = connectAs();
    const share = shareCode ? { code: shareCode, password: getSessionSharePassword() } : null;
    // The grant every request and the room's ticket carry, fetched again a minute before it lapses while the
    // plan is open (plan-grants.ts), so neither a save nor a renewal waits on the index.
    const stopGrant = keepPlanGrantFresh(projectId, share);
    let firstMint = true;
    const openedRoom = connectRoom(projectId, self, handlers, {
      // The api worker resolves the role the mint stored on the ticket and
      // stamps it into the participant row via X-Verified-Role so
      // peers see a trustworthy Viewer / Editor badge. Each connect needs its
      // own ticket: the upgrade spends the one it admits.
      mintTicket: async () => {
        const minted = await apiCreateRoomTicket(self.id, projectId, shareCode);
        // A Participant's key comes back with every ticket (the same key, derived per project); the
        // first answer also says when there is none.
        if (minted?.adderKey || firstMint) announceAdderKey(minted?.adderKey ?? null);
        firstMint = false;
        return minted?.ticket ?? null;
      },
      renewGrant: async () => (await planGrant(projectId, share))?.grant ?? null,
    });
    roomRef.current = openedRoom;
    return () => {
      stopGrant();
      presence.cancel();
      openedRoom.close();
      roomRef.current = null;
    };
  }, [
    enabled,
    hydrated,
    projectId,
    projectServerStored,
    projectTeamId,
    roomRef,
    setLivePresence,
    setLiveAgents,
    setRemoteSelections,
    setRemoteCursors,
  ]);
}
