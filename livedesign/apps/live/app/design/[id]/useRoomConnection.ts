import { useEffect, useEffectEvent, useRef } from 'react';
import { noteAccessEnded } from '@/lib/access-notice';
import type { AgentPresence } from '@livedesign/api-schema';
import { nextFreeColor } from '@/lib/identity';
import { publishedPicture, useOwnPicture } from '@/lib/own-picture';
import { isProfilePictureUrl } from '@liveworkspace/sites/picture';
import {
  apiCreateRoomTicket,
  connectRoom,
  getSessionSharePassword,
  type RoomHandlers,
} from '@/lib/api-client';
import { keepDesignGrantFresh, designGrant } from '@/lib/api/design-grants';
import { createPresenceCoalescer, type PresenceCoalescer } from '@liveworkspace/workbench/lib/presence-coalescer';
import { migrateRoomOp } from './room-op-migrate';
import { roomOpIsWellFormed } from './room-op-shape';
import { presenceRows, syncRoomPresence } from '@liveworkspace/workbench/lib/room-presence';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { prunePeerDragPreviews } from '@/hooks/collab/peer-drag-previews';
import { joinRefusedBecauseTrashed } from './room-refusal';
import { receiveRoomOp } from './room-op-receive';
import type { RoomConnectionOptions } from './useRoomConnection.types';

// Realtime room: one WebSocket per design, opened for every design saved on
// the server (docs/specs/024-agents/agent-changesets.md "Rooms for personal designs"). Lifted out of editor-page.tsx verbatim — the
// presence reconciliation (unique-colour, idle seeding, leaver cleanup)
// and the onOp application (tab / design-meta / select / cursor /
// laser / tab-focus / log / share-revoked) are unchanged. All the state
// it drives lives in the page and is passed in; the deps array stays
// [hydrated, designId, designServerStored] (a name/colour change must not
// reconnect), so the exhaustive-deps disable rides along.
export function useRoomConnection(opts: RoomConnectionOptions) {
  const {
    hydrated,
    designId,
    designServerStored,
    enabled = true,
    onWorkbenchEnded,
    onRoomFull,
    designTeamId,
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
    setRemoteLaserTrails,
    setSelfParticipant,
    receiveSelectionReleased,
    setFollowerIds,
    readFollowing,
    receiveDesignTrashed,
    resyncFromServer,
    onRoomJoined,
    onAdderKey,
  } = opts;

  // Who we connect as, read when the socket opens: the id is stable for the session, and a name or colour
  // change goes out over the open socket rather than warranting a reconnect.
  //
  // A signed-in person says hello with their Google picture while Show My Google Picture is on; the room keeps it
  // only from an account session (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures").
  const picture = publishedPicture(useOwnPicture());
  const selfForRoom = () => ({
    id: selfParticipant.id,
    key: selfParticipant.key,
    name: selfParticipant.name,
    color: selfParticipant.color,
    ...(picture ? { picture } : {}),
  });
  const connectAs = useEffectEvent(() => ({
    self: selfForRoom(),
    shareCode: sessionShareCode,
  }));
  // The switch flipped, or the picture changed: tell the open room, which updates the roster in place (off =
  // initials for everyone from this update on).
  const announceSelf = useEffectEvent(() => roomRef.current?.updateSelf(selfForRoom()));
  const announcedPicture = useRef(picture);
  useEffect(() => {
    if (announcedPicture.current === picture) return;
    announcedPicture.current = picture;
    announceSelf();
  }, [picture]);
  const announceAdderKey = useEffectEvent((key: string | null) => onAdderKey?.(key));
  // Each peer's server-verified role by presence id, refreshed with every presence list.
  const roleByPresenceRef = useRef<Map<string, string | undefined>>(new Map());
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
  // The room's handlers, as effect events: the socket opens once per design (the effect below), and each
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
      setLivePresence(presenceRows(participants, lastSeenRef.current, now, isProfilePictureUrl));
      // Each arrival seeded, the colour a later joiner yields, and what goes with whoever left
      // (@liveworkspace/workbench/lib/room-presence).
      syncRoomPresence(participants, {
        lastSeen: lastSeenRef.current,
        markSeen,
        // Read through selfParticipantRef: this handler must not act on a stale snapshot of the participant.
        self: () => selfParticipantRef.current,
        nextFreeColor,
        takeColour: (color) => setSelfParticipant((prev) => ({ ...prev, color })),
        prunePeerDragPreviews,
        setRemoteTabFocus,
        setRemoteSelections,
        setRemoteCursors,
      });
    },
  );

  const roomOp = useEffectEvent(
    (
      from: Parameters<NonNullable<RoomHandlers['onOp']>>[0],
      op: Parameters<NonNullable<RoomHandlers['onOp']>>[1],
      presence: PresenceCoalescer,
      // What each kind does lives in room-op-receive.ts.
    ) => receiveRoomOp(from, op, presence, opts, roleByPresenceRef),
  );

  const roomSelectionReleased = useEffectEvent(
    (msg: Parameters<NonNullable<RoomHandlers['onSelectionReleased']>>[0]) =>
      receiveSelectionReleased(msg),
  );

  const roomDesignTrashed = useEffectEvent(() => receiveDesignTrashed());
  // A workbench frame cannot reload into another access path: an access change ends its session.
  const roomAccessChanged = useEffectEvent(() => {
    if (onWorkbenchEnded) return onWorkbenchEnded();
    // Whatever the reload's access check answers, a refusal says why (lib/access-notice.ts).
    noteAccessEnded(designId, 'changed');
    window.location.reload();
  });
  const roomWorkbenchEnded = useEffectEvent(() => onWorkbenchEnded?.());
  const roomFull = useEffectEvent(() => onRoomFull?.());
  // A join turned away (docs/specs/013-workspace/trash.md): trashed between our load and our join, the room
  // refuses us instead of telling us. Ask the api once per refusal (one probe at a time); only a trashed
  // answer changes anything.
  const refusalProbeRef = useRef(false);
  const roomRefused = useEffectEvent(() => {
    if (!designId || refusalProbeRef.current) return;
    refusalProbeRef.current = true;
    void joinRefusedBecauseTrashed({
      designId,
      selfId: selfParticipant.id,
      shareCode: sessionShareCodeRef.current,
    })
      .then((trashed) => {
        if (trashed) receiveDesignTrashed();
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
    // Open the realtime room for every server-stored design: shared and team designs for their
    // people (docs/specs/013-workspace/team-shared-designs.md), and personal ones too, so an agent's
    // changeset reaches the person working on it (docs/specs/024-agents/agent-changesets.md).
    if (!enabled || !hydrated || !designId || !designServerStored) {
      // Make sure any state from a previous shared session is cleared
      // when we transition back to private (revoke share / leave team).
      setLivePresence([]);
      setLiveAgents([]);
      setRemoteSelections(new Map());
      prunePeerDragPreviews(new Set());
      return;
    }
    joinedRef.current = false;
    // Batched cursor / laser presence, committed one Map update
    // per animation frame instead of one per packet — see the coalescer.
    // Created per effect run, so a reconnect starts with empty buffers.
    const presence = createPresenceCoalescer({
      setRemoteCursors,
      setRemoteLaserTrails,
    });

    const handlers: RoomHandlers = {
      onCollabKey: (key) => roomCollabKey(key),
      onPresence: (participants, agents) => roomPresence(participants, agents),
      // Elements in a former stored shape from a peer loaded before a deploy are migrated
      // before anything applies them (docs/specs/006-design/stroke-points.md); an op that is not the
      // shape its kind promises is dropped first (room-op-shape.ts).
      onOp: (from, op) => {
        if (!roomOpIsWellFormed(op)) {
          debugLog('[room] malformed op dropped', { kind: (op as { kind?: unknown }).kind });
          return;
        }
        roomOp(from, migrateRoomOp(op), presence);
      },
      onSelectionReleased: (msg) => roomSelectionReleased(msg),
      // Called for this socket alone: being called is the addressing (we never learn our own presence id).
      onFollowers: (ids) => roomFollowers(ids),
      onDesignTrashed: () => roomDesignTrashed(),
      // Reload so the access gates run again (a password prompt, a refusal page, or the editor).
      onAccessChanged: () => roomAccessChanged(),
      onWorkbenchEnded: () => roomWorkbenchEnded(),
      onRoomFull: () => roomFull(),
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
    // design is open (design-grants.ts), so neither a save nor a renewal waits on the index.
    const stopGrant = keepDesignGrantFresh(designId, share);
    let firstMint = true;
    const openedRoom = connectRoom(designId, self, handlers, {
      // The api worker resolves the role the mint stored on the ticket and
      // stamps it into the participant row via X-Verified-Role so
      // peers see a trustworthy Viewer / Editor badge. Each connect needs its
      // own ticket: the upgrade spends the one it admits.
      mintTicket: async () => {
        const minted = await apiCreateRoomTicket(self.id, designId, shareCode);
        // A Participant's key comes back with every ticket (the same key, derived per design); the
        // first answer also says when there is none.
        if (minted?.adderKey || firstMint) announceAdderKey(minted?.adderKey ?? null);
        firstMint = false;
        return minted?.ticket ?? null;
      },
      readFollowing: roomReadFollowing,
      renewGrant: async () => (await designGrant(designId, share))?.grant ?? null,
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
    designId,
    designServerStored,
    designTeamId,
    roomRef,
    setLivePresence,
    setLiveAgents,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteLaserTrails,
  ]);
}
