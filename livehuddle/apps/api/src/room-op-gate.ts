// Which client ops a session may relay (docs/specs/013-workspace/share-roles.md "The level ladder"): the room's
// role gate as one pure decision, so every rule is testable without a socket. The room acts on the answer.
import {
  isParticipationOp,
  isPresenceOpKind,
  isRetiredOpKind,
  isSystemOpKind,
  parseAvatarBell,
  parseAvatarHand,
  parseAvatarKnock,
  parseAvatarKnockAnswer,
  parseAvatarLetSpeak,
  parseAvatarPush,
  parseAvatarSay,
  parseAvatarVoice,
  parseCallSession,
  parseCallStopShare,
  parseCallsCheck,
  parseCallTrack,
  parseGameEvent,
  parseGameInput,
  parseStoredLevel,
  parseViewport,
} from '@livehuddle/api-schema';
import { answersAsSelf } from './document-room-rules';
import { scopedRenames, scopedSenderMayRelay } from './room-scope';

type OpGate =
  /** Never relayed, never answered. */
  | { kind: 'drop' }
  /** A Participant's `el` op: through the participant content rule, never relayed as sent. */
  | { kind: 'participant-content' }
  /**
   * Relayed: unordered when `presence`; a Participant's answers also schedule their write. `op` is the parsed copy
   * for a kind the gate parses (a speech bubble, a knock, a ring, a hand, a let-speak, a voice level, a track, a game
   * move): what the room acts on and relays, so a field the wire does not define never reaches a peer.
   */
  | { kind: 'relay'; presence: boolean; participantAnswers: boolean; op?: unknown };

const DROP: OpGate = { kind: 'drop' };

// The tab fields a `tab-meta` patch never carries (the editor's tabMetaPatch skips the id and elements, and articles
// went with Pages): the tab's id is fixed, its elements travel on their own ops, and a receiver spreads the patch
// over its tab.
const TAB_META_FIXED = ['id', 'elements', 'articles'] as const;

// Whether a tab-content op keeps to the tab it names. A receiver merges a `tab` op's payload over its own tab and
// spreads a `tab-meta` patch over it, so a payload naming another id would renumber the tab on every peer: their
// next save then writes it over that other tab, past the sender's own tab scope.
function keepsToItsTab(op: unknown): boolean {
  const o = op as { kind?: unknown; tabId?: unknown; tab?: unknown; patch?: unknown };
  if (o.kind === 'tab') {
    const tab = o.tab as { id?: unknown } | null | undefined;
    return typeof tab === 'object' && tab !== null && tab.id === o.tabId;
  }
  if (o.kind === 'tab-meta') {
    const patch = o.patch;
    if (typeof patch !== 'object' || patch === null) return false;
    return !TAB_META_FIXED.some((key) => Object.hasOwn(patch, key));
  }
  return true;
}

/** The sender as the gate needs it: its server-verified role, tab scope, published key and adder key. */
export type GateSender = {
  role: unknown;
  tabScope: string | null;
  key: string | undefined;
  // A Participant's server-verified adder key (X-Verified-Adder): what signs its notice board notes.
  adderKey?: string | null;
};

export function gateClientOp(op: unknown, sender: GateSender): OpGate {
  // Presence ops (cursor / select / laser / tab-focus) are ephemeral
  // and mutate nothing, so they relay from ANY connected session —
  // that's how a view-only visitor still shows their cursor, current
  // selection, and which tab they're on to everyone else. Mutation
  // ops (tab content, document-meta) stay edit-role-only:
  // a viewer must not be able to inject edits into peers' canvases.
  // The role is the server-verified one (X-Verified-Role, re-stamped
  // in hello), not anything the client claims.
  const opKind = (op as { kind?: unknown } | null | undefined)?.kind;
  // System-only ops never relay from a client socket: they're
  // emitted exclusively by the worker via /broadcast (stamped
  // `from: 'system'`). Without this drop, any edit-role peer
  // could forge `share-revoked` with the code from their own URL
  // and force-redirect every collaborator out of the session.
  if (isSystemOpKind(opKind)) return DROP;
  // An op of a feature livehuddle no longer has, from an older client (the Vote's `vote`,
  // docs/specs/002-project-scope/not-in-livehuddle.md "The Vote"): dropped from every session, so it is never
  // sequenced, relayed, logged for catch-up or noted in the ledger.
  if (isRetiredOpKind(opKind)) return DROP;
  // A tab-scoped session acts on its own tab only, and never on the
  // document's structure (docs/specs/013-workspace/tab-scoped-share-links.md).
  if (!scopedSenderMayRelay(op, sender.tabScope)) return DROP;
  // Nor its tab's name, which is structure too.
  if (scopedRenames(op, sender.tabScope)) return DROP;
  if (!keepsToItsTab(op)) return DROP;
  const presence = isPresenceOpKind(opKind);
  // The level ladder (docs/specs/013-workspace/share-roles.md): presence from anyone; a Participant's comment
  // reactions relay like an Editor's; its `el` op goes through the participant content rule and
  // never relays as sent; everything else needs an Editor.
  const level = parseStoredLevel(sender.role);
  // Speaking is taking part too (docs/specs/008-canvas/avatar-mode.md "Who may speak"), and a message is held to
  // the limits here as every receiver holds it, so a malformed one reaches nobody.
  // The room relays the checked copy, trimmed and clamped, so a field the wire does not define never reaches a peer.
  let parsed: unknown = undefined;
  if (opKind === 'avatar-say') {
    const say = level === 'view' ? null : parseAvatarSay(op);
    if (!say) return DROP;
    parsed = { kind: 'avatar-say', ...say };
  }
  // So is talking (docs/specs/012-collaboration/proximity-audio.md "Share roles"): a Viewer listens, so it shows no
  // equaliser and publishes no microphone, and a malformed level or locator reaches nobody.
  if (opKind === 'avatar-voice' && (level === 'view' || !(parsed = parseAvatarVoice(op))))
    return DROP;
  // A silent call's nudge to read the kill switch (docs/specs/016-platform/calls-kill-switch.md "The room tells its
  // clients"): a publisher's, so never a Viewer's; the room consumes it.
  if (opKind === 'calls-check' && (level === 'view' || !parseCallsCheck(op))) return DROP;
  // Raising a hand and letting one speak are taking part (docs/specs/012-collaboration/meeting-rooms-and-stage.md
  // "Share roles"): a Viewer listens. Whether a let-speak's sender is an Editor or stands on a stage the room checks
  // next, from where it last placed them (room-calls.ts, #495).
  if (opKind === 'avatar-hand' && (level === 'view' || !(parsed = parseAvatarHand(op))))
    return DROP;
  if (opKind === 'avatar-let-speak' && (level === 'view' || !(parsed = parseAvatarLetSpeak(op))))
    return DROP;
  // A call proving its session to the room (proximity-audio.md "The wire"): any level, a Viewer subscribes too; the
  // room checks the token and consumes it. Stopping someone else's share is an Editor's
  // (video-and-screen-bubbles.md "Share roles", #469).
  if (opKind === 'call-session' && !parseCallSession(op)) return DROP;
  if (opKind === 'call-stop-share' && (level !== 'edit' || !(parsed = parseCallStopShare(op))))
    return DROP;
  // A knock and its answer (docs/specs/012-collaboration/knock.md): presence from any level, a Viewer walks too; a
  // malformed one reaches nobody. The room throttles knocks next.
  // A shove (docs/specs/008-canvas/avatar-mode.md "You can push each other"): presence from any level, addressed to
  // one peer, whose character a direction that is not a number would send to NaN; so a malformed one reaches nobody.
  if (opKind === 'avatar-push' && !(parsed = parseAvatarPush(op))) return DROP;
  if (opKind === 'avatar-knock' && !(parsed = parseAvatarKnock(op))) return DROP;
  if (opKind === 'avatar-knock-answer' && !(parsed = parseAvatarKnockAnswer(op))) return DROP;
  // A ring of a Reception Desk's bell (docs/specs/009-elements/workday-pieces.md "Share roles"): presence from any
  // level, as a knock is, a Viewer at the front desk above all; a malformed one reaches nobody. The room throttles it next.
  if (opKind === 'avatar-bell' && !(parsed = parseAvatarBell(op))) return DROP;
  // A camera (docs/specs/012-collaboration/follow-me-viewport.md): presence from any level, which a follower applies
  // to its own view, so a malformed one (a zoom of 0 or NaN) reaches nobody.
  if (opKind === 'viewport' && !(parsed = parseViewport(op))) return DROP;
  // Playing a game at a piece is taking part (docs/specs/009-elements/social-pieces.md "Share roles"): a Viewer
  // watches, so its paddle and its moments reach nobody, and a malformed one from anyone reaches nobody. Each screen
  // then checks the sender sits on the seat it names.
  if (opKind === 'game-input' && (level === 'view' || !(parsed = parseGameInput(op)))) return DROP;
  if (opKind === 'game-event' && (level === 'view' || !(parsed = parseGameEvent(op)))) return DROP;
  if (opKind === 'call-track') {
    const track = level === 'view' ? null : parseCallTrack(op);
    if (!track) return DROP;
    // Sharing a screen is an Editor's (docs/specs/012-collaboration/video-and-screen-bubbles.md "Share roles").
    if (track.screen && level !== 'edit') return DROP;
    parsed = track;
  }
  // Bring Focus moves everyone's view (docs/specs/012-collaboration/bring-focus.md): running the session, so an
  // Editor's alone.
  if (opKind === 'focus-here' && level !== 'edit') return DROP;
  let participantAnswers = false;
  if (!presence && level !== 'edit') {
    if (level !== 'participate') return DROP;
    if (opKind === 'el') return { kind: 'participant-content' };
    if (!isParticipationOp(op) || !answersAsSelf(op, sender.key, sender.adderKey ?? null))
      return DROP;
    participantAnswers = true;
  }
  // A drag preview (docs/specs/008-canvas/drag-preview.md) is presence, but shows elements moving: only
  // an editor's may reach anyone, so a viewer can never make others' elements appear to move.
  if (opKind === 'drag-preview' && level !== 'edit') return DROP;
  return parsed
    ? { kind: 'relay', presence, participantAnswers, op: parsed }
    : { kind: 'relay', presence, participantAnswers };
}
