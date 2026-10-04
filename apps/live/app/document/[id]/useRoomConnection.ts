import {
  useEffect,
  useEffectEvent,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { QaNote, Tab } from '@livediagram/document';
import {
  type AvatarPresence,
  type ChangesetRoomOp,
  type FacilitatorReason,
  type LivePoll,
} from '@livediagram/api-schema';
import { nextFreeColor, type Participant } from '@/lib/identity';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import { usePublishedPicture } from '@/hooks/persistence/usePublishedPicture';
import { apiCreateRoomTicket, connectRoom, type RoomHandlers } from '@/lib/api-client';
import { parseLaserConfig } from '@/lib/laser-config';
import {
  createPresenceCoalescer,
  type CursorPos,
  type LaserTrail,
  type PresenceCoalescer,
} from './presence-coalescer';
import type { RemoteSelection } from '@/lib/presence-rows';
import { pruneMapToPresent } from './editor-page-helpers';
import { applyRoomOpToTabs } from './room-op-apply';
import { migrateRoomOp } from './room-op-migrate';
import { foldRemoteOpIntoBaseline, type SaveBaselineRefs } from './save-baseline';
import { shareLinkOpEffect } from './share-link-ops';
import {
  endPeerDragPreview,
  prunePeerDragPreviews,
  receivePeerDragPreview,
} from '@/hooks/collab/peer-drag-previews';
import { joinRefusedBecauseTrashed } from './room-refusal';

// Realtime room: one WebSocket per document, opened for every document saved on
// the server (docs/specs/024-agents/agent-changesets.md "Rooms for personal documents"). Lifted out of editor-page.tsx verbatim — the
// presence reconciliation (unique-colour, idle seeding, leaver cleanup)
// and the onOp application (tab / document-meta / select / cursor /
// laser / tab-focus / log / share-revoked) are unchanged. All the state
// it drives lives in the page and is passed in; the deps array stays
// [hydrated, documentId, documentServerStored] (a name/colour change must not
// reconnect), so the exhaustive-deps disable rides along.
export function useRoomConnection(opts: {
  hydrated: boolean;
  documentId: string | null;
  // Saved on the server, so it has a room: every such document, personal ones included, since an
  // agent writing through the api is a second writer even where nobody else can open it.
  documentServerStored: boolean;
  // The document's team (docs/specs/013-workspace/team-shared-documents.md), null for a personal document. A team
  // document is a live room for its members even without a share link,
  // so presence opens for it the same way a shared document does.
  documentTeamId: string | null;
  selfParticipant: Participant;
  sessionShareCode: string | null;
  lastSeenRef: MutableRefObject<Map<string, number>>;
  // Bumps a peer's last-seen (usePresenceState), publishing when they arrive or return from idle.
  markSeen: (participantId: string) => void;
  selfParticipantRef: MutableRefObject<Participant>;
  // The autosave's baseline (docs/specs/012-collaboration/collab-race-hardening.md): every document op a peer sends is
  // folded into it as well as into the tabs on screen, so the next local save
  // neither mistakes it for ours nor ships it back out.
  saveBaseline: SaveBaselineRefs;
  // Counts a peer op applied to `tabs` (useEditorState's opsApplied, read by the autosave).
  countAppliedOp: () => void;
  sessionShareCodeRef: MutableRefObject<string | null>;
  roomRef: MutableRefObject<ReturnType<typeof connectRoom> | null>;
  // Merge a peer's tab / document-meta change into the present, PRESERVING
  // the local undo / redo stacks (peers autosave ~600ms, so clearing
  // history on each would wipe undo continuously during a shared session).
  applyRemoteTabs: (updater: (prev: Tab[]) => Tab[]) => void;
  setLivePresence: Dispatch<SetStateAction<Participant[]>>;
  setRemoteSelections: Dispatch<SetStateAction<Map<string, RemoteSelection>>>;
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
  setRemoteTabFocus: Dispatch<SetStateAction<Map<string, string>>>;
  setRemoteLaserTrails: Dispatch<SetStateAction<Map<string, LaserTrail>>>;
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): peers' walking characters, latest snapshot each.
  setRemoteAvatars: Dispatch<
    SetStateAction<Map<string, { tabId: string; avatar: AvatarPresence }>>
  >;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): where each peer is looking, latest sample each.
  // Only read while somebody is being followed; kept for everyone because the
  // op is unsolicited (see the RoomOp comment).
  setRemoteViewports: Dispatch<
    SetStateAction<Map<string, { tabId: string; pan: { x: number; y: number }; zoom: number }>>
  >;
  setDocumentName: Dispatch<SetStateAction<string>>;
  setSelfParticipant: Dispatch<SetStateAction<Participant>>;
  // Live poll (docs/specs/012-collaboration/live-poll.md) inbound handlers, owned by useLivePoll. Stable
  // (useCallback with no changing deps) so they don't reopen the socket —
  // the effect's dep list stays [hydrated, documentId, documentServerStored].
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): somebody pushed our character. Stable, like the
  // poll handlers below, so it can't reopen the socket.
  receiveAvatarPush: (dx: number, dy: number) => void;
  // A peer set off a reaction pad (docs/specs/009-elements/reaction-pad.md). Purely visual: nothing is
  // written, so there is nothing here to persist, order, or undo.
  receiveReaction: (elementId: string, reaction: string) => void;
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): somebody is asking the room to come and look.
  receiveFocusHere: (
    from: string,
    tabId: string,
    at: { x: number; y: number },
    zoom: number,
  ) => void;
  // The facilitator baton (docs/specs/012-collaboration/facilitator.md): the room's answer, and the token we
  // present on every hello so a refresh keeps it.
  receiveFacilitator: (msg: {
    holder: string | null;
    by?: string;
    reason: FacilitatorReason;
    token?: string;
  }) => void;
  readFacilitatorToken: () => string | null;
  // The facilitator freed an element we were holding (docs/specs/007-editor/live-app.md lock). Only our
  // socket is sent this, so there is nothing to check it against.
  receiveSelectionReleased: (msg: { elementId: string; by: string }) => void;
  receivePoll: (poll: LivePoll) => void;
  receivePollAnswer: (from: string, pollId: string, value: string | null, key?: string) => void;
  receivePollEnd: (pollId: string) => void;
  // A Q&A board's authoritative state after a server write (docs/specs/012-collaboration/qa-board.md).
  // Stable, like the poll handlers, so it can't reopen the socket.
  receiveQa: (tabId: string, elementId: string, notes: QaNote[], rev: number) => void;
  // The document went to the Trash (docs/specs/013-workspace/trash.md): the
  // worker's document-trashed op, or the room closing the socket with 4004.
  // Stable, like the others, so it can't reopen the socket.
  receiveDocumentTrashed: () => void;
  // Re-hydrate tab content from D1 when the room can't replay our gap
  // (docs/specs/012-collaboration/resync-without-reload.md). Stable, like the poll handlers, so it can't reopen the
  // socket — the effect's dep list stays [hydrated, documentId, shareable].
  resyncFromServer: () => Promise<void>;
  // An agent's changeset (docs/specs/024-agents/agent-changesets.md "In the editor"), relayed by the
  // worker; useChangesetFeed decides what to do with it.
  receiveChangeset: (op: ChangesetRoomOp) => void;
  // The room has greeted this connection (its first presence list): what was relayed before it
  // joined is caught up through the api (useChangesetFeed's checkSinceLoad).
  onRoomJoined: () => void;
}) {
  const {
    hydrated,
    documentId,
    documentServerStored,
    documentTeamId,
    selfParticipant,
    sessionShareCode,
    lastSeenRef,
    markSeen,
    selfParticipantRef,
    saveBaseline,
    countAppliedOp,
    sessionShareCodeRef,
    roomRef,
    applyRemoteTabs,
    setLivePresence,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteTabFocus,
    setRemoteLaserTrails,
    setRemoteAvatars,
    setRemoteViewports,
    setDocumentName,
    setSelfParticipant,
    receiveAvatarPush,
    receiveReaction,
    receiveFocusHere,
    receiveFacilitator,
    receiveSelectionReleased,
    readFacilitatorToken,
    receivePoll,
    receivePollAnswer,
    receivePollEnd,
    receiveQa,
    receiveDocumentTrashed,
    resyncFromServer,
    receiveChangeset,
    onRoomJoined,
  } = opts;

  // Who we connect as, read when the socket opens: the id is stable for the session, and a name or colour
  // change goes out over the open socket rather than warranting a reconnect.
  //
  // A signed-in session joins with a room ticket so the room knows it is an account (the only kind
  // that may publish a profile picture or see others'), and says hello with its published picture
  // (docs/specs/014-identity/profile-picture.md §6).
  const { isSignedIn } = useDeferredAuth();
  const picture = usePublishedPicture();
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
    signedIn: isSignedIn,
  }));
  // The switch flipped, or the picture changed: tell the open room, which updates the roster in
  // place (switch off = initials for everyone from this update on).
  const announceSelf = useEffectEvent(() => roomRef.current?.updateSelf(selfForRoom()));
  useEffect(() => {
    announceSelf();
  }, [picture]);
  // Each peer's server-verified role by presence id, refreshed with every presence list.
  const roleByPresenceRef = useRef<Map<string, string | undefined>>(new Map());
  // The facilitator token is read on demand by the room, always as it is now.
  const roomReadFacilitatorToken = useEffectEvent(() => readFacilitatorToken());

  // Whether this connection has had its first presence list: reset by every (re)open below.
  const joinedRef = useRef(false);
  const roomJoined = useEffectEvent(() => onRoomJoined());
  // The room's handlers, as effect events: the socket opens once per document (the effect below), and each
  // message still runs against the current props, which is what a handler must see.
  const roomPresence = useEffectEvent(
    (participants: Parameters<NonNullable<RoomHandlers['onPresence']>>[0]) => {
      const now = Date.now();
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
          // Only ever present when the room judged us an account session
          // (docs/specs/014-identity/profile-picture.md §5).
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
      setRemoteSelections((prev) => pruneMapToPresent(prev, present));
      setRemoteCursors((prev) => pruneMapToPresent(prev, present));
      // A peer who disconnects takes their character with them (docs/specs/008-canvas/avatar-mode.md),
      // so a closed tab can't leave someone standing on the canvas forever.
      setRemoteAvatars((prev) => pruneMapToPresent(prev, present));
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
        op.kind === 'document-meta'
      ) {
        // A document change from a peer: a whole tab, one element (docs/specs/012-collaboration/realtime-conflict-resolution.md),
        // one dot (docs/specs/012-collaboration/session-tools.md), one answer / idea / tick / comment (docs/specs/012-collaboration/collab-race-hardening.md),
        // non-element tab fields, or the document's name
        // and tab list. One pure function applies each (room-op-apply.ts),
        // to the tabs on screen AND to the autosave's baseline, so the
        // change is known to be the peer's and is never saved or broadcast
        // back as if it were ours (docs/specs/012-collaboration/collab-race-hardening.md).
        if (op.kind === 'document-meta') setDocumentName(op.name);
        // A dragger's real change has arrived: their live preview has done its job.
        endPeerDragPreview(from);
        applyRemoteTabs((prev) => applyRoomOpToTabs(prev, op));
        foldRemoteOpIntoBaseline(saveBaseline, op);
        // In the same batch as the tabs update, so the render that shows the op also counts it.
        countAppliedOp();
      } else if (op.kind === 'select') {
        setRemoteSelections((prev) => {
          const next = new Map(prev);
          // tabId scopes the badge + docs/specs/007-editor/live-app.md lock to the sender's tab;
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
      } else if (op.kind === 'laser') {
        // Same coalescing as cursors; points accumulate in the buffer
        // and land in one Map commit per frame.
        presence.laser(from, {
          tabId: op.tabId,
          point: { x: op.x, y: op.y, t: performance.now() },
          // The sender's pen (docs/specs/008-canvas/laser-panel.md), parsed field by field so a token
          // from a newer client costs that field and not the trail.
          config: op.look ? parseLaserConfig(op.look) : undefined,
        });
      } else if (op.kind === 'drag-preview') {
        // A collaborator mid-drag (docs/specs/008-canvas/drag-preview.md): drawn, never written.
        receivePeerDragPreview(from, op, (id) => roleByPresenceRef.current.get(id));
      } else if (op.kind === 'avatar') {
        // Latest-wins per peer (no accumulation, unlike laser points): the
        // character has one position at a time.
        presence.avatar(from, op.avatar ? { tabId: op.tabId, avatar: op.avatar } : null);
      } else if (op.kind === 'viewport') {
        // Latest-wins per peer, like the avatar: a camera has one position.
        // Applied straight through rather than batched with the presence
        // flush — a follower's view should track the presenter's hand, and a
        // 10 Hz stream needs no coalescing.
        setRemoteViewports((prev) => {
          const next = new Map(prev);
          next.set(from, { tabId: op.tabId, pan: op.pan, zoom: op.zoom });
          return next;
        });
      } else if (op.kind === 'avatar-push') {
        // A shove is ADDRESSED: the room delivers it to the named session and
        // nobody else, so anything that arrives here was aimed at us. We
        // can't check that ourselves — peers are identified by server-minted
        // presence ids precisely so nobody learns anyone's real owner id
        // (docs/specs/015-api/public-api-and-tokens.md §6), and that includes not recognising our own. Nothing is
        // written to the document either way: our client decides what to do
        // with the request, and does nothing if we've left the mode.
        receiveAvatarPush(op.dx, op.dy);
      } else if (op.kind === 'reaction') {
        // No tab check here, unlike the laser: a burst is keyed to the
        // ELEMENT, and only the active tab's elements are rendered, so a
        // burst for a pad on another tab has nothing to draw itself on and
        // expires quietly.
        receiveReaction(op.elementId, op.reaction);
      } else if (op.kind === 'focus-here') {
        // No tab check: the invitation names its own tab and taking it is
        // what switches you, so one sent from another tab is exactly the
        // case this element exists for.
        receiveFocusHere(from, op.tabId, op.at, op.zoom);
      } else if (op.kind === 'tab-focus') {
        setRemoteTabFocus((prev) => {
          const next = new Map(prev);
          next.set(from, op.tabId);
          return next;
        });
      } else if (op.kind === 'poll-start') {
        // Live poll (docs/specs/012-collaboration/live-poll.md). Purely ephemeral: it lands in the poll
        // hook's memory and never touches tabs or autosave, so there is
        // nothing here to persist or undo.
        receivePoll(op.poll);
      } else if (op.kind === 'poll-answer') {
        // `from` keys the answer so a peer changing their mind replaces
        // it. It is never rendered — results carry no identity.
        receivePollAnswer(from, op.pollId, op.value, op.key);
      } else if (op.kind === 'poll-end') {
        receivePollEnd(op.pollId);
      } else if (op.kind === 'qa') {
        // The api's word on a Q&A board (docs/specs/012-collaboration/qa-board.md). System-only: the worker
        // sends it through /broadcast after the write is already in D1, and
        // the room refuses it from a client socket, so the sender check is
        // defence in depth like share-revoked's below.
        if (from === 'system') receiveQa(op.tabId, op.elementId, op.notes, op.rev);
      } else if (op.kind === 'share-revoked' || op.kind === 'share-rescoped') {
        // The owner revoked or rescoped a share link (share-link-ops.ts).
        // A session hydrated with that exact code leaves the editor on a
        // revoke and reloads into the new scope on a rescope; the room
        // closes its socket either way. Everyone else keeps their session.
        const effect = shareLinkOpEffect(op, from, sessionShareCodeRef.current);
        if (effect === 'leave') window.location.assign('/explorer');
        else if (effect === 'reload') window.location.reload();
      } else if (op.kind === 'changeset') {
        // An agent's changeset, applied, outlined and toasted by useChangesetFeed. System-only, like
        // the share ops: the room refuses one from a client socket.
        if (from === 'system') receiveChangeset(op);
      } else if (op.kind === 'document-trashed') {
        // The document went to the Trash. System-only, like the share ops:
        // the room refuses it from a client socket.
        if (from === 'system') receiveDocumentTrashed();
      }
    },
  );

  const roomFacilitator = useEffectEvent(
    (msg: Parameters<NonNullable<RoomHandlers['onFacilitator']>>[0]) => receiveFacilitator(msg),
  );

  const roomSelectionReleased = useEffectEvent(
    (msg: Parameters<NonNullable<RoomHandlers['onSelectionReleased']>>[0]) =>
      receiveSelectionReleased(msg),
  );

  const roomDocumentTrashed = useEffectEvent(() => receiveDocumentTrashed());
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
    if (!hydrated || !documentId || !documentServerStored) {
      // Make sure any state from a previous shared session is cleared
      // when we transition back to private (revoke share / leave team).
      setLivePresence([]);
      setRemoteSelections(new Map());
      prunePeerDragPreviews(new Set());
      return;
    }
    joinedRef.current = false;
    // Batched cursor / laser / avatar presence, committed one Map update
    // per animation frame instead of one per packet — see the coalescer.
    // Created per effect run, so a reconnect starts with empty buffers.
    const presence = createPresenceCoalescer({
      setRemoteCursors,
      setRemoteLaserTrails,
      setRemoteAvatars,
    });

    const handlers: RoomHandlers = {
      onPresence: (participants) => roomPresence(participants),
      // Elements in a former stored shape from a peer loaded before a deploy are migrated
      // before anything applies them (docs/specs/006-document/stroke-points.md).
      onOp: (from, op) => roomOp(from, migrateRoomOp(op), presence),
      onFacilitator: (msg) => roomFacilitator(msg),
      onSelectionReleased: (msg) => roomSelectionReleased(msg),
      onDocumentTrashed: () => roomDocumentTrashed(),
      onRefused: () => roomRefused(),
      onResync: () => roomResync(),
    };
    // Team documents need a one-time room ticket (docs/specs/015-api/api.md): membership is
    // keyed on the VERIFIED Clerk id, which a WS upgrade can't carry, so
    // the ticket is minted over authenticated REST first. A signed-in
    // session mints one too, because only a ticket can tell the room it is an
    // account (docs/specs/014-identity/profile-picture.md §6). Guest personal /
    // share-code sessions skip the extra round trip — their legacy query
    // params (`o` exact-owner match, `s` share code) still resolve the
    // role. Connect is async only for the ticket fetch; `cancelled`
    // covers an unmount (or dep change) racing it.
    let cancelled = false;
    let openedRoom: ReturnType<typeof connectRoom> | null = null;
    void (async () => {
      const { self, shareCode, signedIn } = connectAs();
      const ticket =
        documentTeamId || signedIn
          ? await apiCreateRoomTicket(self.id, documentId, shareCode)
          : null;
      if (cancelled) return;
      openedRoom = connectRoom(
        documentId,
        self,
        handlers,
        {
          // The api worker resolves role from these on WS upgrade and
          // stamps it into the participant row via X-Verified-Role so
          // peers see a trustworthy Viewer / Editor badge.
          ticket,
          shareCode,
          // Always send our own id as `o`: the worker checks it against
          // the document's owner to resolve the edit role (team membership
          // rides the ticket above instead — a bare id isn't trusted for
          // it). A share-link visitor's id just won't match, and their
          // role comes from the code.
          ownerId: self.id,
        },
        roomReadFacilitatorToken,
      );
      roomRef.current = openedRoom;
    })();
    return () => {
      cancelled = true;
      presence.cancel();
      openedRoom?.close();
      roomRef.current = null;
    };
  }, [
    hydrated,
    documentId,
    documentServerStored,
    documentTeamId,
    roomRef,
    setLivePresence,
    setRemoteSelections,
    setRemoteCursors,
    setRemoteLaserTrails,
    setRemoteAvatars,
  ]);
}
