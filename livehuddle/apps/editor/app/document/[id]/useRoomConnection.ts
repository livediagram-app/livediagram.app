import { useEffect, useEffectEvent, useRef } from 'react';
import { syncRemoteBesideTabs } from '@liveworkspace/workbench/lib/split-presence';
import { noteAccessEnded } from '@/lib/access-notice';
import type { AgentPresence } from '@livehuddle/api-schema';
import { nextFreeColor } from '@/lib/identity';
import { useDeferredAuth } from '@liveworkspace/workbench/components/providers/deferred-auth';
import {
  apiCreateRoomTicket,
  connectRoom,
  getSessionSharePassword,
  type RoomHandlers,
} from '@/lib/api-client';
import { keepDocumentGrantFresh, documentGrant } from '@/lib/api/document-grants';
import { createPresenceCoalescer, type PresenceCoalescer } from './presence-coalescer';
import { createPresenceChimes } from '@/lib/sounds/presence-chimes';
import { unlockAudioOnGesture } from '@/lib/sounds/audio';
import { pruneMapToPresent } from './editor-page-helpers';
import { migrateRoomOp } from './room-op-migrate';
import { roomOpIsWellFormed } from './room-op-shape';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { prunePeerDragPreviews } from '@/hooks/collab/peer-drag-previews';
import { joinRefusedBecauseTrashed } from './room-refusal';
import { resetSpeechBubbles } from '@livehuddle/avatar/speech-store';
import {
  noteRoomDropped,
  pruneCallPeers,
  resetCallPeers,
  setCallLevels,
} from '@/lib/calls/calls-store';
import type { RoomConnectionOptions } from './useRoomConnection.types';
import { receiveRoomOp } from './room-op-receive';

// Realtime room: one WebSocket per document, opened for every document saved on
// the server (docs/specs/024-agents/agent-changesets.md "Rooms for personal documents"). Lifted out of editor-page.tsx verbatim — the
// presence reconciliation (unique-colour, idle seeding, leaver cleanup)
// and the onOp application (tab / document-meta / select / cursor /
// tab-focus / log / share-revoked) are unchanged. All the state
// it drives lives in the page and is passed in; the deps array stays
// [hydrated, documentId, documentServerStored] (a name/colour change must not
// reconnect), so the exhaustive-deps disable rides along.
export function useRoomConnection(opts: RoomConnectionOptions) {
  const {
    hydrated,
    documentId,
    documentServerStored,
    enabled = true,
    onRoomFull,
    documentTeamId,
    selfParticipant,
    sessionShareCode,
    lastSeenRef,
    markSeen,
    selfParticipantRef,
    sessionShareCodeRef,
    roomRef,
    setLivePresence,
    setLiveAgents,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteTabFocus,
    setRemoteAvatars,
    setRemoteViewports,
    setSelfParticipant,
    receiveFacilitator,
    receiveSelectionReleased,
    readFacilitatorToken,
    setFollowerIds,
    readFollowing,
    receiveDocumentTrashed,
    resyncFromServer,
    onRoomJoined,
    onAdderKey,
  } = opts;

  // Who we connect as, read when the socket opens: the id is stable for the session, and a name or colour
  // change goes out over the open socket rather than warranting a reconnect.
  //
  // A signed-in session says hello with its Google picture unless Show My Google Picture is off; the room keeps it
  // only from an account session and sends it only to account sessions (liveworkspace/docs/specs/003-accounts/accounts.md "Profile
  // pictures"). A switch flipped mid-session reaches the room on the next connect.
  const authUser = useDeferredAuth().user;
  const helloPicture = authUser && !authUser.pictureHidden ? (authUser.picture ?? null) : null;
  const connectAs = useEffectEvent(() => ({
    self: {
      id: selfParticipant.id,
      key: selfParticipant.key,
      name: selfParticipant.name,
      color: selfParticipant.color,
      ...(helloPicture ? { picture: helloPicture } : {}),
    },
    shareCode: sessionShareCode,
  }));
  const announceAdderKey = useEffectEvent((key: string | null) => onAdderKey?.(key));
  // Each peer's server-verified role by presence id, refreshed with every presence list.
  const roleByPresenceRef = useRef<Map<string, string | undefined>>(new Map());
  // Each peer's presence name, to say who switched a tab's mode.
  const nameByPresenceRef = useRef<Map<string, string>>(new Map());
  // The facilitator token is read on demand by the room, always as it is now.
  const roomReadFacilitatorToken = useEffectEvent(() => readFacilitatorToken());
  const roomReadFollowing = useEffectEvent(() => readFollowing());
  const roomFollowers = useEffectEvent((ids: string[]) => setFollowerIds(ids));

  // Whether this connection has had its first presence list: reset by every (re)open below.
  const joinedRef = useRef(false);
  // The collab key the room pinned on this session (docs/specs/013-workspace/share-roles.md "The collab key"): our
  // answers and reactions are recorded under it from now on, the same on every device we sign in on. Unchanged, it
  // changes nothing, so the hello a new key sets off ends there.
  const roomCollabKey = useEffectEvent((key: string) =>
    setSelfParticipant((prev) => (prev.key === key ? prev : { ...prev, key })),
  );
  const roomJoined = useEffectEvent(() => onRoomJoined());
  // The room's handlers, as effect events: the socket opens once per document (the effect below), and each
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
      // And who may speak from a stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Share roles").
      setCallLevels(participants);
      nameByPresenceRef.current = new Map(participants.map((p) => [p.id, p.name] as const));
      setLivePresence(
        participants.map((p) => ({
          id: p.id,
          // The peer's document-write id (docs/specs/012-collaboration/participant-responses.md), claimed in their
          // hello and relayed unchanged — it is what joins their saved
          // answer on a done check / estimate card back to their avatar.
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
          // Only ever present when the room judged us an account session.
          ...(p.picture ? { picture: p.picture } : {}),
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
      // A departed peer's camera goes with them too: a follower or a "focus here"
      // must not read the view of someone no longer in the room.
      setRemoteViewports((prev) => pruneMapToPresent(prev, present));
      // A peer who disconnects takes their character with them (docs/specs/008-canvas/avatar-mode.md),
      // so a closed tab can't leave someone standing on the canvas forever.
      setRemoteAvatars((prev) => pruneMapToPresent(prev, present));
      // Their talking level and microphone go too (docs/specs/012-collaboration/proximity-audio.md).
      pruneCallPeers(present);
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
    ) => receiveRoomOp(from, op, presence, opts, roleByPresenceRef),
  );

  const roomFacilitator = useEffectEvent(
    (msg: Parameters<NonNullable<RoomHandlers['onFacilitator']>>[0]) => receiveFacilitator(msg),
  );

  const roomSelectionReleased = useEffectEvent(
    (msg: Parameters<NonNullable<RoomHandlers['onSelectionReleased']>>[0]) =>
      receiveSelectionReleased(msg),
  );

  const roomDocumentTrashed = useEffectEvent(() => receiveDocumentTrashed());
  const roomAccessChanged = useEffectEvent(() => {
    // Whatever the reload's access check answers, a refusal says why (lib/access-notice.ts).
    noteAccessEnded(documentId, 'changed');
    window.location.reload();
  });
  const roomFull = useEffectEvent(() => onRoomFull?.());
  // A join turned away (docs/specs/013-workspace/trash.md): trashed between our load and our join, the room
  // refuses us instead of telling us. Ask the api once per refusal (one probe at a time); only a trashed
  // answer changes anything.
  const refusalProbeRef = useRef(false);
  const roomRefused = useEffectEvent(() => {
    if (!documentId || refusalProbeRef.current) return;
    refusalProbeRef.current = true;
    void joinRefusedBecauseTrashed({
      documentId,
      selfId: selfParticipant.id,
      shareCode: sessionShareCodeRef.current,
    })
      .then((trashed) => {
        if (trashed) receiveDocumentTrashed();
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
    // Open the realtime room for every server-stored document: shared and team documents for their
    // people (docs/specs/013-workspace/team-shared-documents.md), and personal ones too, so an agent's
    // changeset reaches the person working on it (docs/specs/024-agents/agent-changesets.md).
    if (!enabled || !hydrated || !documentId || !documentServerStored) {
      // Make sure any state from a previous shared session is cleared
      // when we transition back to private (revoke share / leave team).
      setLivePresence([]);
      setLiveAgents([]);
      setRemoteSelections(new Map());
      prunePeerDragPreviews(new Set());
      return;
    }
    joinedRef.current = false;
    // Batched cursor / avatar presence, committed one Map update
    // per animation frame instead of one per packet — see the coalescer.
    // Created per effect run, so a reconnect starts with empty buffers.
    const presence = createPresenceCoalescer({
      setRemoteCursors,
      setRemoteAvatars,
    });
    // Join and leave sounds (docs/specs/012-collaboration/join-and-leave-sounds.md): one watcher per document, so a
    // reconnect of our own socket keeps who it has met; sound unlocks on the first press in the tab.
    const chimes = createPresenceChimes({ selfKey: connectAs().self.key });
    const stopUnlock = unlockAudioOnGesture();

    const handlers: RoomHandlers = {
      onCollabKey: (key) => roomCollabKey(key),
      onPresence: (participants, agents) => {
        // Buffered packets from anyone who has left go before the roster prunes their state, so
        // the next frame's flush cannot bring a departed peer's cursor back.
        presence.prune(new Set(participants.map((p) => p.id)));
        chimes.update(participants);
        roomPresence(participants, agents);
      },
      // Elements in a former stored shape from a peer loaded before a deploy are migrated
      // before anything applies them (docs/specs/006-document/stroke-points.md); an op that is not the
      // shape its kind promises is dropped first (room-op-shape.ts).
      onOp: (from, op) => {
        if (!roomOpIsWellFormed(op)) {
          debugLog('[room] malformed op dropped', { kind: (op as { kind?: unknown }).kind });
          return;
        }
        roomOp(from, migrateRoomOp(op), presence);
      },
      onFacilitator: (msg) => roomFacilitator(msg),
      onSelectionReleased: (msg) => roomSelectionReleased(msg),
      // Called for this socket alone: being called is the addressing (we never learn our own presence id).
      onFollowers: (ids) => roomFollowers(ids),
      onDocumentTrashed: () => roomDocumentTrashed(),
      // Reload so the access gates run again (a password prompt, a refusal page, or the editor).
      onAccessChanged: () => roomAccessChanged(),
      onRoomFull: () => roomFull(),
      onRefused: () => roomRefused(),
      onResync: () => roomResync(),
      // Our own socket dropped (it reconnects as a new presence): the room lowered our raised hand for everyone, so
      // the Call dock lowers it too (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand").
      onClose: () => noteRoomDropped(),
    };
    // Every session joins through a one-time room ticket (docs/specs/015-api/api.md "Realtime model"),
    // minted over REST, where the access gates already read the index's grant (and through it the share code,
    // its password and team membership) as headers. The WS upgrade can't carry headers, so before tickets
    // those rode the upgrade URL, which is logged; now only the spent-on-use ticket does. The connector
    // mints its first ticket itself, so it exists while that request runs and keeps what the editor
    // says meanwhile (its selection, its tab) for the room.
    const { self, shareCode } = connectAs();
    const share = shareCode ? { code: shareCode, password: getSessionSharePassword() } : null;
    // The grant every request and the room's ticket carry, fetched again a minute before it lapses while the
    // canvas is open (document-grants.ts), so neither a save nor a renewal waits on the index.
    const stopGrant = keepDocumentGrantFresh(documentId, share);
    let firstMint = true;
    const openedRoom = connectRoom(
      documentId,
      self,
      handlers,
      {
        // The api worker resolves the role the mint stored on the ticket and
        // stamps it into the participant row via X-Verified-Role so
        // peers see a trustworthy Viewer / Editor badge. Each connect needs its
        // own ticket: the upgrade spends the one it admits.
        mintTicket: async () => {
          const minted = await apiCreateRoomTicket(self.id, documentId, shareCode);
          // A Participant's key comes back with every ticket (the same key, derived per document); the
          // first answer also says when there is none.
          if (minted?.adderKey || firstMint) announceAdderKey(minted?.adderKey ?? null);
          firstMint = false;
          return minted?.ticket ?? null;
        },
        readFollowing: roomReadFollowing,
        renewGrant: async () => (await documentGrant(documentId, share))?.grant ?? null,
      },
      roomReadFacilitatorToken,
    );
    roomRef.current = openedRoom;
    return () => {
      stopGrant();
      presence.cancel();
      chimes.dispose();
      stopUnlock();
      // Nobody's words outlive the room they were said in.
      resetSpeechBubbles();
      // Nobody's level or microphone outlives the room either.
      resetCallPeers();
      openedRoom.close();
      roomRef.current = null;
    };
  }, [
    enabled,
    hydrated,
    documentId,
    documentServerStored,
    documentTeamId,
    roomRef,
    setLivePresence,
    setLiveAgents,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteAvatars,
  ]);
}
