import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Tab } from '@livediagram/diagram';
import { nextFreeColor, type Participant } from '@/lib/identity';
import { connectRoom, type ChangeLogEntry, type RoomHandlers } from '@/lib/api-client';
import { trimLaserBuffer, type LaserPoint } from '@/lib/laser-buffer';
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
  selfParticipant: Participant;
  isOwner: boolean;
  sessionShareCode: string | null;
  lastSeenRef: MutableRefObject<Map<string, number>>;
  selfParticipantRef: MutableRefObject<Participant>;
  remoteUpdateRef: MutableRefObject<boolean>;
  sessionShareCodeRef: MutableRefObject<string | null>;
  roomRef: MutableRefObject<ReturnType<typeof connectRoom> | null>;
  resetTabs: (updater: (prev: Tab[]) => Tab[]) => void;
  setLivePresence: Dispatch<SetStateAction<Participant[]>>;
  setRemoteSelections: Dispatch<SetStateAction<Map<string, string | null>>>;
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
  } = opts;

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
        setRemoteTabFocus((prev) => pruneMapToPresent(prev, present));
        setRemoteSelections((prev) => pruneMapToPresent(prev, present));
        setRemoteCursors((prev) => pruneMapToPresent(prev, present));
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
}
