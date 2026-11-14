// ---------------------------------------------------------------------
// Realtime room op kinds
// ---------------------------------------------------------------------

// Room op kinds that are ephemeral signals: they mutate no document state,
// so they relay unordered (no seq) and from any role.
//
// `poll-answer` (docs/specs/012-collaboration/live-poll.md) is here for the ROLE half rather than the
// presence half: answering a poll changes nothing on the document, and a
// presenter pulse-checking an audience on a view link is the main thing
// polls are for, so a view-role participant must be able to send one.
// `poll-start` / `poll-end` are deliberately NOT here, they stay behind
// the edit-role gate below, so an audience member can answer a poll but
// can't start one or end someone else's.
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
  'laser',
  'tab-focus',
  'poll-answer',
  // A reaction burst (docs/specs/009-elements/reaction-pad.md) is pure theatre: nothing on the server,
  // nothing in the document, and nothing worth replaying to somebody who
  // arrives after it finished.
  'reaction',
  // Where the sender is looking, for anyone following them (docs/specs/012-collaboration/follow-me-viewport.md). Its
  // own wire contract calls it "ephemeral presence exactly like cursor /
  // laser: throttled, never logged, never ordered (no `seq`), never
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
//
// `poll-start` / `poll-end` sit here rather than with `poll-answer` above on
// purpose: an audience member on a view link may answer a poll but must not be
// able to start one or end someone else's (docs/specs/012-collaboration/live-poll.md).
export const MUTATION_OP_KINDS = [
  'tab',
  'tab-meta',
  'el',
  // One dot placed or taken back (docs/specs/012-collaboration/session-tools.md). A mutation like any other, it
  // gets a seq, lands in the catch-up log, and is refused from a view-role
  // sender, because casting already requires edit rights.
  'vote',
  // One answer, idea, checklist tick or comment change on one element
  // (docs/specs/012-collaboration/collab-race-hardening.md). A mutation for the same reasons as a dot.
  'el-delta',
  // An Editor's save landed, its revision and digest (docs/specs/006-document/delta-saves.md "A peer's save moves the
  // base copy"). A mutation for its ORDER: it must reach peers after the save's element ops, and a reconnecting peer
  // replays it after them. It writes nothing; a forged one only fails a peer's digest check.
  'tab-saved',
  'document-meta',
  'poll-start',
  'poll-end',
] as const;

// Op kinds only the WORKER may originate, stamped `from: 'system'` and pushed
// through the room's /broadcast endpoint. The room drops them outright when they
// arrive on a client socket: without that, any edit-role peer could forge
// `share-revoked` carrying the code from their own URL and force-redirect every
// collaborator out of the session (docs/specs/013-workspace/share-password.md).
//
// `qa` (docs/specs/012-collaboration/qa-board.md) is here for the same reason: it is the api's authoritative
// word on a Q&A board after a write it has already persisted. A client that
// could send one could rewrite every peer's board without touching D1. Unlike
// `share-revoked` it is SEQUENCED into the catch-up log (the worker asks for
// that on the /broadcast body), because it changes the document.
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
export const SYSTEM_OP_KINDS = [
  'share-revoked',
  'share-rescoped',
  'qa',
  'document-trashed',
  'changeset',
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

// Membership test for the room's ordering + role gate. Takes a loose string
// because it reads `op.kind` off an `unknown` wire payload (see ServerMessage
// in room-messages.ts on why the op itself stays untyped).
export function isMutationOpKind(kind: unknown): kind is (typeof MUTATION_OP_KINDS)[number] {
  return typeof kind === 'string' && (MUTATION_OP_KINDS as readonly string[]).includes(kind);
}

export function isPresenceOpKind(kind: unknown): kind is PresenceOpKind {
  return typeof kind === 'string' && (PRESENCE_OP_KINDS as readonly string[]).includes(kind);
}

// A participation act (docs/specs/013-workspace/share-roles.md "Integrity"): a person's own dot, response or idea.
// A Participant's socket may send these beside presence; every other mutation from it is dropped, except an `el`
// op, which the room applies through the participant content rule instead of relaying.
const PARTICIPATION_OP_KINDS = ['vote'] as const;
// A comment reaction is taking part too (docs/specs/012-collaboration/comment-reactions.md): whoever may comment
// may react, and the room writes a Participant's reactions as it writes its answers.
const PARTICIPATION_DELTA_KINDS = ['response', 'idea', 'comment-react'] as const;

export function isParticipationOp(op: unknown): boolean {
  if (typeof op !== 'object' || op === null) return false;
  const { kind, delta } = op as { kind?: unknown; delta?: unknown };
  if ((PARTICIPATION_OP_KINDS as readonly unknown[]).includes(kind)) return true;
  if (kind !== 'el-delta' || typeof delta !== 'object' || delta === null) return false;
  return (PARTICIPATION_DELTA_KINDS as readonly unknown[]).includes(
    (delta as { kind?: unknown }).kind,
  );
}

export function isSystemOpKind(kind: unknown): kind is (typeof SYSTEM_OP_KINDS)[number] {
  return typeof kind === 'string' && (SYSTEM_OP_KINDS as readonly string[]).includes(kind);
}

// Retired ops (docs/specs/015-api/api.md "Retired ops are ignored"): Avatar mode's character, shove and speech
// bubble, gone to livehuddle (docs/specs/002-project-scope/not-in-livediagram.md). An older editor still open in a
// tab may send them; the room drops them without a word rather than refusing, so that editor keeps working. Kept
// out of ROOM_OP_KINDS, whose mutation branch is the fall-through.
export const RETIRED_OP_KINDS = ['avatar', 'avatar-push', 'avatar-say'] as const;

export function isRetiredOpKind(kind: unknown): kind is (typeof RETIRED_OP_KINDS)[number] {
  return typeof kind === 'string' && (RETIRED_OP_KINDS as readonly string[]).includes(kind);
}
