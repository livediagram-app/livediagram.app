import { useEffect, useEffectEvent, useRef } from 'react';
import { noteAccessEnded } from '@/lib/access-notice';
import type { AgentPresence } from '@livedocuments/api-schema';
import { nextFreeColor } from '@/lib/identity';
import { publishedPicture, useOwnPicture } from '@/lib/own-picture';
import {
  apiCreateRoomTicket,
  connectRoom,
  getSessionSharePassword,
  type RoomHandlers,
} from '@/lib/api-client';
import { keepDocumentGrantFresh, documentGrant } from '@/lib/api/document-grants';
import { createPresenceCoalescer, type PresenceCoalescer } from './presence-coalescer';
import { migrateRoomOp } from './room-op-migrate';
import { roomOpIsWellFormed } from './room-op-shape';
import { presenceRows, syncRoomPresence } from '@liveworkspace/workbench/lib/room-presence';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { prunePeerDragPreviews } from '@/hooks/collab/peer-drag-previews';
import { joinRefusedBecauseTrashed } from './room-refusal';
import { resetArticlePeers, syncArticlePeople } from '@/lib/article/article-carets-store';
import { receiveRoomOp } from './room-op-receive';
import type { RoomConnectionOptions } from './useRoomConnection.types';

// Realtime room: one WebSocket per document, opened for every document saved on
// the server (docs/specs/024-agents/agent-changesets.md "Rooms for personal documents"). Lifted out of editor-page.tsx verbatim — the
// presence reconciliation (unique-colour, idle seeding, leaver cleanup)
// and the onOp application (tab / document-meta / select / cursor /
// laser / tab-focus / log / share-revoked) are unchanged. All the state
// it drives lives in the page and is passed in; the deps array stays
// [hydrated, documentId, documentServerStored] (a name/colour change must not
// reconnect), so the exhaustive-deps disable rides along.
export function useRoomConnection(opts: RoomConnectionOptions) {
  const {
    hydrated,
    documentId,
    documentServerStored,
    enabled = true,
    onWorkbenchEnded,
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
    setRemoteLaserTrails,
    setSelfParticipant,
    receiveSelectionReleased,
    setFollowerIds,
    readFollowing,
    receiveDocumentTrashed,
    resyncFromServer,
    onRoomJoined,
  } = opts;

  // Who we connect as, read when the socket opens: the id is stable for the session, and a name or colour
  // change goes out over the open socket rather than warranting a reconnect.
  //
  // A signed-in session says hello with its published Google picture, and a Show My Google Picture change goes out
  // over the open socket too (docs/specs/014-identity/profile-picture.md §2); the room keeps it only from an account.
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
  const announceSelf = useEffectEvent(() => roomRef.current?.updateSelf(selfForRoom()));
  const announcedPicture = useRef(picture);
  useEffect(() => {
    if (announcedPicture.current === picture) return;
    announcedPicture.current = picture;
    announceSelf();
  }, [picture]);
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
      setLivePresence(presenceRows(participants, lastSeenRef.current, now));
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
        // Collaborators' carets in the writing take their names and colours from here, and go with
        // whoever left (docs/specs/007-editor/article-pages.md "Collaboration").
        onPresent: (people) => syncArticlePeople(people),
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

  const roomDocumentTrashed = useEffectEvent(() => receiveDocumentTrashed());
  // A workbench frame cannot reload into another access path: an access change ends its session.
  const roomAccessChanged = useEffectEvent(() => {
    if (onWorkbenchEnded) return onWorkbenchEnded();
    // Whatever the reload's access check answers, a refusal says why (lib/access-notice.ts).
    noteAccessEnded(documentId, 'changed');
    window.location.reload();
  });
  const roomWorkbenchEnded = useEffectEvent(() => onWorkbenchEnded?.());
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
      resetArticlePeers();
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
      // before anything applies them (docs/specs/006-document/stroke-points.md); an op that is not the
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
      onDocumentTrashed: () => roomDocumentTrashed(),
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
    // document is open (document-grants.ts), so neither a save nor a renewal waits on the index.
    const stopGrant = keepDocumentGrantFresh(documentId, share);
    const openedRoom = connectRoom(documentId, self, handlers, {
      // The api worker resolves the role the mint stored on the ticket and
      // stamps it into the participant row via X-Verified-Role so
      // peers see a trustworthy Viewer / Editor badge. Each connect needs its
      // own ticket: the upgrade spends the one it admits.
      mintTicket: async () => {
        const minted = await apiCreateRoomTicket(self.id, documentId, shareCode);
        return minted?.ticket ?? null;
      },
      readFollowing: roomReadFollowing,
      renewGrant: async () => (await documentGrant(documentId, share))?.grant ?? null,
    });
    roomRef.current = openedRoom;
    return () => {
      stopGrant();
      presence.cancel();
      resetArticlePeers();
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
    setRemoteLaserTrails,
  ]);
}
