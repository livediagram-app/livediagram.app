import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { applyElementOp, type Tab } from '@livediagram/diagram';
import { CHANGE_LOG_LIST_LIMIT } from '@livediagram/api-schema';
import { nextFreeColor, type Participant } from '@/lib/identity';
import {
  apiCreateRoomTicket,
  connectRoom,
  type ChangeLogEntry,
  type RoomHandlers,
} from '@/lib/api-client';
import { trimLaserBuffer, type LaserPoint } from '@/lib/laser-buffer';
import { track } from '@/lib/telemetry';
import type { YjsMirror } from '@/lib/yjs-mirror';
import type { RemoteSelection } from '@/lib/presence-rows';
import { pruneMapToPresent } from './editor-page-helpers';

type CursorPos = { tabId: string; x: number; y: number } | null;
type LaserTrail = { tabId: string; points: LaserPoint[] };

// Realtime room: one WebSocket per diagram, opened only while the
// diagram is shared. Lifted out of editor-page.tsx verbatim — the
// presence reconciliation (unique-colour, idle seeding, leaver cleanup)
// and the onOp application (tab / diagram-meta / select / cursor /
// laser / tab-focus / log / share-revoked) are unchanged. All the state
// it drives lives in the page and is passed in; the deps array stays
// [hydrated, diagramId, diagramShareable] (a name/colour change must not
// reconnect), so the exhaustive-deps disable rides along.
export function useRoomConnection(opts: {
  hydrated: boolean;
  diagramId: string | null;
  diagramShareable: boolean;
  // The diagram's team (spec/35), null for a personal diagram. A team
  // diagram is a live room for its members even without a share link,
  // so presence opens for it the same way a shared diagram does.
  diagramTeamId: string | null;
  selfParticipant: Participant;
  sessionShareCode: string | null;
  lastSeenRef: MutableRefObject<Map<string, number>>;
  selfParticipantRef: MutableRefObject<Participant>;
  remoteUpdateRef: MutableRefObject<boolean>;
  sessionShareCodeRef: MutableRefObject<string | null>;
  roomRef: MutableRefObject<ReturnType<typeof connectRoom> | null>;
  // Level 2 (spec/75): the shared Yjs doc mirror, non-null only when the
  // flag is on. When set, the room seeds/syncs via `ydoc` ops instead of
  // `el`/`tab` ops. `tabsRef` gives the current tabs for a from-hydrate seed.
  yjsMirrorRef: MutableRefObject<YjsMirror | null>;
  tabsRef: MutableRefObject<Tab[]>;
  // Merge a peer's tab / diagram-meta change into the present, PRESERVING
  // the local undo / redo stacks (peers autosave ~600ms, so clearing
  // history on each would wipe undo continuously during a shared session).
  applyRemoteTabs: (updater: (prev: Tab[]) => Tab[]) => void;
  setLivePresence: Dispatch<SetStateAction<Participant[]>>;
  setRemoteSelections: Dispatch<SetStateAction<Map<string, RemoteSelection>>>;
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
  setRemoteTabFocus: Dispatch<SetStateAction<Map<string, string>>>;
  setRemoteLaserTrails: Dispatch<SetStateAction<Map<string, LaserTrail>>>;
  setChangeLog: Dispatch<SetStateAction<ChangeLogEntry[]>>;
  setDiagramName: Dispatch<SetStateAction<string>>;
  setSelfParticipant: Dispatch<SetStateAction<Participant>>;
}) {
  const {
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
    yjsMirrorRef,
    tabsRef,
    applyRemoteTabs,
    setLivePresence,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteTabFocus,
    setRemoteLaserTrails,
    setChangeLog,
    setDiagramName,
    setSelfParticipant,
  } = opts;

  useEffect(() => {
    // Open the realtime room for a shared diagram OR a team diagram
    // (spec/35): team members collaborate live on a team diagram with
    // no share link, so presence must work there too.
    if (!hydrated || !diagramId || (!diagramShareable && !diagramTeamId)) {
      // Make sure any state from a previous shared session is cleared
      // when we transition back to private (revoke share / leave team).
      setLivePresence([]);
      setRemoteSelections(new Map());
      return;
    }
    // Presence-packet coalescing: cursor / laser ops arrive at up to
    // 30 Hz per peer, and committing state per packet re-rendered the
    // whole editor tree per message (~90 renders/s with three peers,
    // while the local user is idle). Buffer them in refs and commit ONE
    // Map update per animation frame — the same rAF pattern the pan and
    // snap-guide paths use. Buffers live per-effect-run so a reconnect
    // starts clean.
    const pendingCursors = new Map<string, { tabId: string; x: number; y: number } | null>();
    const pendingLasers = new Map<string, LaserTrail>();
    let presenceRafId: number | null = null;
    const flushPresence = () => {
      presenceRafId = null;
      if (pendingCursors.size > 0) {
        const moves = new Map(pendingCursors);
        pendingCursors.clear();
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          for (const [id, pos] of moves) next.set(id, pos);
          return next;
        });
      }
      if (pendingLasers.size > 0) {
        const trails = new Map(pendingLasers);
        pendingLasers.clear();
        setRemoteLaserTrails((prev) => {
          const next = new Map(prev);
          for (const [id, incoming] of trails) {
            const existing = next.get(id);
            // A tab switch resets the buffer for that participant —
            // otherwise a peer who lasered on tab A then started
            // lasering on tab B would briefly render an interpolated
            // line across the gap.
            const points =
              existing && existing.tabId === incoming.tabId
                ? trimLaserBuffer([...existing.points, ...incoming.points])
                : incoming.points;
            next.set(id, { tabId: incoming.tabId, points });
          }
          return next;
        });
      }
    };
    const schedulePresenceFlush = () => {
      if (presenceRafId === null) presenceRafId = requestAnimationFrame(flushPresence);
    };

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
        setRemoteSelections((prev) => pruneMapToPresent(prev, present));
        setRemoteCursors((prev) => pruneMapToPresent(prev, present));
        // Same for the lastSeen idle tracker (a plain ref, not state):
        // drop departed peers so it can't grow unbounded over a
        // long-lived room with people joining / leaving via share links.
        for (const id of [...lastSeenRef.current.keys()]) {
          if (!present.has(id)) lastSeenRef.current.delete(id);
        }
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
          applyRemoteTabs((prev) => {
            const existing = prev.findIndex((t) => t.id === op.tabId);
            if (existing === -1) return [...prev, op.tab];
            const next = [...prev];
            // `folder` is per-diagram link metadata owned by the
            // diagram-meta op (spec/30), not by content. Keep the
            // local membership so a content edit can't clobber a
            // concurrent folder change.
            next[existing] = { ...op.tab, folder: next[existing]!.folder };
            return next;
          });
        } else if (op.kind === 'el') {
          // Peer changed a SINGLE element on a tab (spec/75, Level 0):
          // add / update / remove / reorder, applied by id. Two peers
          // editing different elements on the same tab now merge instead
          // of the whole-tab `tab` op clobbering (see element-ops.ts). An
          // op for a tab we don't have yet is dropped — a follow-up `tab`
          // or `diagram-meta` op will bring the tab in whole.
          remoteUpdateRef.current = true;
          applyRemoteTabs((prev) => {
            const i = prev.findIndex((t) => t.id === op.tabId);
            if (i === -1) return prev;
            const tab = prev[i]!;
            const elements = applyElementOp(tab.elements, op.op);
            // applyElementOp returns the same array reference on a no-op
            // (e.g. update for an already-removed id); keep tab identity
            // so the autosave content diff doesn't see a phantom change.
            if (elements === tab.elements) return prev;
            const next = [...prev];
            next[i] = { ...tab, elements };
            return next;
          });
        } else if (op.kind === 'tab-meta') {
          // Peer changed a tab's non-element metadata (name, background,
          // font, …) without touching its elements (spec/75, Level 0).
          // Merge the patch; `folder` stays owned by diagram-meta (spec/30)
          // so a content/meta edit can't clobber a concurrent folder move.
          remoteUpdateRef.current = true;
          applyRemoteTabs((prev) => {
            const i = prev.findIndex((t) => t.id === op.tabId);
            if (i === -1) return prev;
            const tab = prev[i]!;
            const { folder: _ignored, ...patch } = op.patch;
            const next = [...prev];
            next[i] = { ...tab, ...patch, folder: tab.folder };
            return next;
          });
        } else if (op.kind === 'ydoc') {
          // Level 2 (spec/75): a peer's Yjs update. Merge it into the shared
          // doc, then merge the doc's elements back into our tabs (keeping
          // each tab's local meta + order, which the diagram-meta op owns).
          // Field-level, so a concurrent local edit to a different field of
          // the same element survives.
          const mirror = yjsMirrorRef.current;
          if (mirror) {
            mirror.applyRemote(op.update);
            remoteUpdateRef.current = true;
            applyRemoteTabs((prev) => mirror.mergeInto(prev));
          }
        } else if (op.kind === 'ydoc-state') {
          // Level 2: the room's reply to our `ydoc-sync`, sent on every
          // (re)connect. `null` means no shared doc yet -> seed from our own
          // hydrate ONCE (the mirror broadcasts it for the room + peers to
          // adopt). A non-null state we always merge: applying full state is
          // an idempotent Yjs merge, so a RECONNECT re-syncs whatever we
          // missed while disconnected instead of diverging (ydoc ops bypass
          // the L1 op-log, so this is the only catch-up path for them).
          //
          // System-only: the room stamps its seed reply `from: 'system'` and
          // refuses to relay `ydoc-state` from a client socket. This check is
          // defence in depth (like share-revoked) so a peer can't force us to
          // adopt a crafted doc even if the server drop regresses.
          const mirror = from === 'system' ? yjsMirrorRef.current : null;
          if (mirror) {
            if (op.update === null) {
              if (!mirror.isSeeded) mirror.seedFromHydrate(tabsRef.current);
            } else {
              mirror.adoptSharedState(op.update);
              remoteUpdateRef.current = true;
              applyRemoteTabs((prev) => mirror.mergeInto(prev));
            }
          }
        } else if (op.kind === 'diagram-meta') {
          // Peer renamed the diagram or reordered tabs (incl. add /
          // delete). Reorder locally to match; new ids land as
          // placeholders that a follow-up `tab` op will populate.
          remoteUpdateRef.current = true;
          setDiagramName(op.name);
          applyRemoteTabs((prev) => {
            const localById = new Map(prev.map((t) => [t.id, t] as const));
            const mirror = yjsMirrorRef.current;
            return op.tabs.map((summary) => {
              const local = localById.get(summary.id);
              // diagram-meta owns folder membership (spec/30). Apply
              // the incoming folder, but only mint a new object when it
              // actually differs so unchanged tabs keep their identity
              // (the autosave content diff keys off identity).
              if (local) {
                const folder = summary.folder;
                return (local.folder ?? undefined) === (folder ?? undefined)
                  ? local
                  : { ...local, folder };
              }
              // Level 2 (spec/75): a tab this op just added may already have
              // its elements in the shared doc (a peer's `ydoc` op that landed
              // before the tab existed here). Seed them from the doc so it
              // isn't stuck empty until the next edit. Only NEW tabs read the
              // doc — existing tabs keep their local (possibly uncommitted)
              // elements untouched.
              const seeded = mirror?.isSeeded ? mirror.elementsFor(summary.id) : null;
              return {
                id: summary.id,
                name: summary.name,
                elements: seeded ?? [],
                folder: summary.folder,
              };
            });
          });
        } else if (op.kind === 'select') {
          setRemoteSelections((prev) => {
            const next = new Map(prev);
            // tabId scopes the badge + spec/07 lock to the sender's tab;
            // absent (older peer) = tab-unknown, shown everywhere.
            next.set(from, { elementId: op.elementId, tabId: op.tabId });
            return next;
          });
        } else if (op.kind === 'cursor') {
          // Coalesced: buffered into pendingCursors and committed once
          // per animation frame (see flushPresence below). Cursor
          // packets arrive at up to 30 Hz PER PEER, and a setState per
          // packet re-rendered the whole editor tree per message.
          pendingCursors.set(
            from,
            op.x !== null && op.y !== null ? { tabId: op.tabId, x: op.x, y: op.y } : null,
          );
          schedulePresenceFlush();
        } else if (op.kind === 'laser') {
          // Same coalescing as cursors; points accumulate in the buffer
          // and land in one Map commit per frame.
          const buffered = pendingLasers.get(from);
          pendingLasers.set(from, {
            tabId: op.tabId,
            points: [
              ...(buffered && buffered.tabId === op.tabId ? buffered.points : []),
              { x: op.x, y: op.y, t: performance.now() },
            ],
          });
          schedulePresenceFlush();
        } else if (op.kind === 'tab-focus') {
          setRemoteTabFocus((prev) => {
            const next = new Map(prev);
            next.set(from, op.tabId);
            return next;
          });
        } else if (op.kind === 'log') {
          // Remote participant just emitted an audit entry. Prepend it
          // to the local list (de-duped by id so a sender that round-
          // trips its own op doesn't show a duplicate). Cap at the same
          // limit the server hydrates so the panel stays consistent.
          setChangeLog((prev) => {
            if (prev.some((e) => e.id === op.entry.id)) return prev;
            return [op.entry, ...prev].slice(0, CHANGE_LOG_LIST_LIMIT);
          });
        } else if (op.kind === 'log-remove') {
          setChangeLog((prev) => prev.filter((e) => e.id !== op.entryId));
        } else if (op.kind === 'share-revoked') {
          // Owner revoked a share link. If our session is hydrated
          // against that exact code, the diagram is no longer ours
          // to read; hard-redirect to the explorer so we don't sit
          // on stale state. The check is per-client: an owner who
          // revoked their own outbound link to a different visitor
          // keeps their session. System-only: the worker emits this
          // via the DO's /broadcast with `from: 'system'` (and the DO
          // refuses to relay it from client sockets) — the sender
          // check here is defence in depth against a peer forging a
          // force-redirect.
          if (
            from === 'system' &&
            sessionShareCodeRef.current &&
            sessionShareCodeRef.current === op.code
          ) {
            window.location.assign('/explorer/recent');
          }
        }
      },
      onResync: () => {
        // The room couldn't bridge our reconnect gap from its op log
        // (spec/75, Level 1) -- we fell too far behind or it restarted.
        // Re-hydrate from D1 the same way the error boundary recovers: a
        // full reload. Rare (only after a real disconnect), so the coarse
        // recovery is acceptable; the telemetry makes regressions visible.
        track('Error', 'Client', 'RealtimeResync');
        window.location.reload();
      },
      onOpen: () => {
        // Level 2 (spec/75): on every (re)connect, ask the room for the
        // shared Yjs doc so we share one history before editing. The reply
        // (`ydoc-state`) either seeds us or tells us to seed ourselves.
        if (yjsMirrorRef.current) {
          roomRef.current?.send({ kind: 'op', op: { kind: 'ydoc-sync' } });
        }
      },
    };
    // Team diagrams need a one-time room ticket (spec/11): membership is
    // keyed on the VERIFIED Clerk id, which a WS upgrade can't carry, so
    // the ticket is minted over authenticated REST first. Personal /
    // share-code sessions skip the extra round trip — their legacy query
    // params (`o` exact-owner match, `s` share code) still resolve the
    // role. Connect is async only for the ticket fetch; `cancelled`
    // covers an unmount (or dep change) racing it.
    let cancelled = false;
    let openedRoom: ReturnType<typeof connectRoom> | null = null;
    void (async () => {
      const ticket = diagramTeamId
        ? await apiCreateRoomTicket(selfParticipant.id, diagramId, sessionShareCode)
        : null;
      if (cancelled) return;
      openedRoom = connectRoom(
        diagramId,
        { id: selfParticipant.id, name: selfParticipant.name, color: selfParticipant.color },
        handlers,
        {
          // The api worker resolves role from these on WS upgrade and
          // stamps it into the participant row via X-Verified-Role so
          // peers see a trustworthy Viewer / Editor badge.
          ticket,
          shareCode: sessionShareCode,
          // Always send our own id as `o`: the worker checks it against
          // the diagram's owner to resolve the edit role (team membership
          // rides the ticket above instead — a bare id isn't trusted for
          // it). A share-link visitor's id just won't match, and their
          // role comes from the code.
          ownerId: selfParticipant.id,
        },
      );
      roomRef.current = openedRoom;
      // Level 2 (spec/75): route the mirror's local doc updates out as `ydoc`
      // room ops. Reads roomRef.current at call time so it always uses the
      // live socket (survives reconnects).
      yjsMirrorRef.current?.onLocalUpdate((update) => {
        roomRef.current?.send({ kind: 'op', op: { kind: 'ydoc', update } });
      });
    })();
    return () => {
      cancelled = true;
      if (presenceRafId !== null) cancelAnimationFrame(presenceRafId);
      openedRoom?.close();
      roomRef.current = null;
    };
    // selfParticipant.id is stable across the session; name/color
    // changes don't warrant a reconnect. Deliberately omitted from
    // the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, diagramId, diagramShareable, diagramTeamId]);
}
