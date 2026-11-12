// Realtime room op classes: which kinds are presence, mutation or system, and the membership tests the
// room's ordering and role gate read. Re-exported from room-messages.ts.

// Room op kinds that are ephemeral signals: they mutate no document state,
// so they relay unordered (no seq) and from any role.
//
// `avatar` (docs/specs/008-canvas/avatar-mode.md) is presence in the plainest sense: someone's walking
// character, at cursor rates, mutating nothing. View-role senders included,
// an audience member walking around a document they were shown a link to is
// the same kind of harmless as their cursor.
// This classification used to live inside the room worker while the editor kept
// its own list of the kinds it sends and handles, in another app, with nothing
// comparing them. That is how `viewport` shipped absent from here (see its note
// below): the mutation branch is the fall-through, so a presence kind nobody
// classified silently becomes a logged, ordered, replayed mutation. The
// dangerous direction is worse, a MUTATION kind added to this list hands
// view-role visitors a write path, because the role gate only stops non-presence
// ops. So the whole vocabulary lives here now, in the package both ends already
// import, split into exactly three kinds with no room for a fourth.
export const PRESENCE_OP_KINDS = [
  'cursor',
  'select',
  'tab-focus',
  'avatar',
  // A shove (docs/specs/008-canvas/avatar-mode.md) moves nothing on the server and nothing in the
  // document, it asks one peer to step aside. Same trust level as `avatar`.
  'avatar-push',
  // A character saying something (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): a message that floats
  // away in seconds, so nothing to order, log or replay. The room relays it from an Editor or a Participant only.
  'avatar-say',
  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md "The wire"): how loudly a walker is talking, a
  // sample like `avatar`, and where to ask for their microphone. Neither carries audio, neither is worth replaying,
  // and the room relays both from an Editor or a Participant only.
  'avatar-voice',
  'call-track',
  // A silent publishing call's nudge for the room to read the calls kill switch (docs/specs/016-platform/
  // calls-kill-switch.md "The room tells its clients"): consumed by the room, never relayed, never logged.
  'calls-check',
  // Raise hand (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"): a stage's audience asking to
  // speak, and a speaker letting them, both about a moment, so never ordered, logged or replayed. From an Editor or
  // a Participant only; a let-speak is ADDRESSED to the hand's owner, as a shove is.
  'avatar-hand',
  'avatar-let-speak',
  // A call proving its Realtime session to the room (proximity-audio.md "The wire"), so the mint route can ask the room
  // who may hear whom: consumed by the room, never relayed, from any level. And an Editor asking someone to stop their
  // screen share (video-and-screen-bubbles.md "Share roles"): ADDRESSED to the sharer, as a let-speak is.
  'call-session',
  'call-stop-share',
  // A knock on a room and its answer (docs/specs/012-collaboration/knock.md): a moment, from any level, never ordered,
  // logged or replayed. A knock is broadcast and each receiver checks it stands inside; an answer is ADDRESSED to the
  // knocker, as a shove is.
  'avatar-knock',
  'avatar-knock-answer',
  // A ring of a Reception Desk's bell (docs/specs/009-elements/workday-pieces.md "The wire"): a moment, from any level,
  // broadcast like a knock; each receiver checks it stands in earshot.
  'avatar-bell',
  // A nudge from the Collaborators list (docs/specs/012-collaboration/nudge.md "The wire"): a moment, ADDRESSED to its
  // target alone as a shove is, from an Editor or a Participant; the room holds each pair to one per 2 minutes.
  'nudge',
  // A game at a piece (docs/specs/009-elements/social-pieces.md "Ping-Pong Table", "The wire"): a player's paddle, a
  // sample at most 20 a second, and a moment of the game (a serve, a strike, a miss), sent by the player whose moment
  // it is. Neither is worth ordering, logging or replaying: a reconnect misses moments, never the document. The room
  // relays both from an Editor or a Participant only; a Viewer watches.
  'game-input',
  'game-event',
  // Where the sender is looking, for anyone following them (docs/specs/012-collaboration/follow-me-viewport.md). Its
  // own wire contract calls it "ephemeral presence exactly like cursor /
  // laser / avatar: throttled, never logged, never ordered (no `seq`), never
  // replayed to a reconnecting client", and while it was missing from this
  // set it was all four of those things, because the mutation branch is the
  // fall-through.
  //
  // The client publishes it on every pan or zoom, throttled to 10 Hz, so ~26
  // seconds of one editor navigating filled all 256 slots of the catch-up log
  // with camera positions and pushed `floor` past every real mutation. The
  // next peer whose socket blipped then failed the `lastSeq + 1 >= floor`
  // check and was sent `resync`, re-hydrating every loaded tab from D1,
  // exactly the storm the comment below this block says was hunted down once
  // already, reopened by somebody merely scrolling. It also cost a
  // `storage.put` per frame, 10 a second per navigating editor.
  //
  // And because the role gate drops any non-presence op from a view-role
  // sender, a view-only visitor could not be FOLLOWED at all, contradicting
  // docs/specs/012-collaboration/follow-me-viewport.md's "the audience on a view link is exactly who most needs it".
  'viewport',
  // "Come and look at this" (docs/specs/012-collaboration/bring-focus.md). Ephemeral for the same reason a laser
  // is: a request to look somewhere is about a moment, and one replayed to a
  // late joiner is answering a sentence nobody is still saying.
  'focus-here',
  // A dragger's preview (docs/specs/008-canvas/drag-preview.md): where the elements they are moving are
  // right now, at cursor rates, writing nothing; the real change follows on release as element ops.
  // The room relays it only from an editor (receivers check too): a viewer must never make others'
  // elements appear to move.
  'drag-preview',
  // Who the sender is following (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"). The room
  // keeps it on the session and is the only one who reads it: it tells each person, on their own socket, who
  // follows them (`followers`). Never relayed, from any session (a viewer follows too).
  'follow',
] as const;

// Room op kinds that DO change the document: they get a monotonic `seq` within
// the room's epoch, land in the bounded catch-up log so a reconnecting peer can
// replay them (docs/specs/012-collaboration/realtime-conflict-resolution.md), and are refused from a view-role sender.
export const MUTATION_OP_KINDS = [
  'tab',
  'tab-meta',
  'el',
  // One checklist tick or comment change on one element
  // (docs/specs/012-collaboration/collab-race-hardening.md).
  'el-delta',
  'document-meta',
] as const;

// Op kinds only the WORKER may originate, stamped `from: 'system'` and pushed
// through the room's /broadcast endpoint. The room drops them outright when they
// arrive on a client socket: without that, any edit-role peer could forge
// `share-revoked` carrying the code from their own URL and force-redirect every
// collaborator out of the session (docs/specs/013-workspace/share-password.md).
//
// `share-rescoped` (docs/specs/013-workspace/tab-scoped-share-links.md) for the same reason as
// `share-revoked`: a forged one would reload every holder of a code.
//
// `document-trashed` (docs/specs/013-workspace/trash.md): the document went to the
// Trash, so every session ends with the deleted state. A forged one would end
// everyone's session.
//
// `changeset` (docs/specs/024-agents/agent-changesets.md): one write the api applied and recorded,
// sequenced through /mutation. A forged one would show people a change nobody made (CS24).
//
// `calls-mode` (docs/specs/016-platform/calls-kill-switch.md "The room tells its clients"): the room's own word that
// the calls kill switch changed. A forged one would end everyone's call.
export const SYSTEM_OP_KINDS = [
  'share-revoked',
  'share-rescoped',
  'document-trashed',
  'changeset',
  'calls-mode',
  // The room refusing a nudge sent inside its 2 minutes (docs/specs/012-collaboration/nudge.md "The wire"), to the
  // sender alone: a client forging one could start someone's countdown, so none is relayed from a client.
  'nudge-refused',
] as const;

// The whole vocabulary. Every op the editor sends or handles is one of these
// three kinds of thing, and which one it is decides its ordering, its role gate,
// and whether it may come from a client at all.
export const ROOM_OP_KINDS = [
  ...PRESENCE_OP_KINDS,
  ...MUTATION_OP_KINDS,
  ...SYSTEM_OP_KINDS,
] as const;

type PresenceOpKind = (typeof PRESENCE_OP_KINDS)[number];

// Op kinds of features livehuddle no longer has, which an older client may still send: the Vote's one-dot `vote`
// op (docs/specs/002-project-scope/not-in-livehuddle.md "The Vote"), and the laser's trail and a Reaction Pad's
// burst (docs/specs/002-project-scope/not-in-livehuddle.md "The presenting tools, Isometric and Zen"). The wire carries an op as `unknown`, so one
// still parses; the room drops it at its op gate, so it is never sequenced, relayed, logged for catch-up or noted
// in the collaboration ledger. Kept out of ROOM_OP_KINDS: nothing sends or handles one now.
export const RETIRED_OP_KINDS = ['vote', 'laser', 'reaction'] as const;

export function isRetiredOpKind(kind: unknown): boolean {
  return typeof kind === 'string' && (RETIRED_OP_KINDS as readonly string[]).includes(kind);
}

// Element deltas of a feature livehuddle no longer has: a comment's add, removal, id swap, resolve and reaction
// (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes"). An older client may still
// send one in an `el-delta` op; the room drops it at its op gate, as it drops a retired op kind, so no comment reaches
// a stored thread or a peer.
export const RETIRED_DELTA_KINDS = [
  'comment-add',
  'comment-remove',
  'comment-rekey',
  'comment-resolve',
  'comment-react',
] as const;

export function isRetiredDeltaOp(op: unknown): boolean {
  if (typeof op !== 'object' || op === null) return false;
  const { kind, delta } = op as { kind?: unknown; delta?: unknown };
  if (kind !== 'el-delta' || typeof delta !== 'object' || delta === null) return false;
  return (RETIRED_DELTA_KINDS as readonly unknown[]).includes((delta as { kind?: unknown }).kind);
}

// Membership test for the room's ordering + role gate. Takes a loose string
// because it reads `op.kind` off an `unknown` wire payload (see ServerMessage in
// room-messages.ts on why the op itself stays untyped).
export function isMutationOpKind(kind: unknown): kind is (typeof MUTATION_OP_KINDS)[number] {
  return typeof kind === 'string' && (MUTATION_OP_KINDS as readonly string[]).includes(kind);
}

export function isPresenceOpKind(kind: unknown): kind is PresenceOpKind {
  return typeof kind === 'string' && (PRESENCE_OP_KINDS as readonly string[]).includes(kind);
}

// A participation act (docs/specs/013-workspace/share-roles.md "Integrity"): a notice board pin or unpin
// (docs/specs/009-elements/social-pieces.md "Notice Board"), which the room writes as it writes a Participant's
// answers, and a Timer's or
// Stopwatch's press (docs/specs/009-elements/timer-and-stopwatch.md "Share roles"), and an Arcade Machine score
// (docs/specs/009-elements/social-pieces.md "High Scores"; its clear is an Editor's). A Participant's
// socket may send these beside presence; every other mutation from it is dropped, except an `el` op, which the room
// applies through the participant content rule instead of relaying.
const PARTICIPATION_DELTA_KINDS = [
  'notice-pin',
  'notice-unpin',
  'piece-timer',
  'arcade-score',
] as const;

export function isParticipationOp(op: unknown): boolean {
  if (typeof op !== 'object' || op === null) return false;
  const { kind, delta } = op as { kind?: unknown; delta?: unknown };
  if (kind !== 'el-delta' || typeof delta !== 'object' || delta === null) return false;
  return (PARTICIPATION_DELTA_KINDS as readonly unknown[]).includes(
    (delta as { kind?: unknown }).kind,
  );
}

export function isSystemOpKind(kind: unknown): kind is (typeof SYSTEM_OP_KINDS)[number] {
  return typeof kind === 'string' && (SYSTEM_OP_KINDS as readonly string[]).includes(kind);
}
