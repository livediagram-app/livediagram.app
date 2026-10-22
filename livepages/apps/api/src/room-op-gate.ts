// Which client ops a session may relay (docs/specs/013-workspace/share-roles.md "The level ladder"): the room's
// role gate as one pure decision, so every rule is testable without a socket. The room acts on the answer.
import {
  isParticipationOp,
  isPresenceOpKind,
  isSystemOpKind,
  parseAvatarSay,
  parseStoredLevel,
} from '@livepages/api-schema';
import { answersAsSelf } from './document-room-rules';
import { scopedSenderMayRelay } from './room-scope';

type OpGate =
  /** Never relayed, never answered. */
  | { kind: 'drop' }
  /** A Participant's `el` op: through the participant content rule, never relayed as sent. */
  | { kind: 'participant-content' }
  /** Relayed: unordered when `presence`; a Participant's answers also schedule their write. */
  | { kind: 'relay'; presence: boolean; participantAnswers: boolean };

const DROP: OpGate = { kind: 'drop' };

/** The sender as the gate needs it: its server-verified role, tab scope and published key. */
export type GateSender = {
  role: unknown;
  tabScope: string | null;
  key: string | undefined;
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
  // A tab-scoped session acts on its own tab only, and never on the
  // document's structure (docs/specs/013-workspace/tab-scoped-share-links.md).
  if (!scopedSenderMayRelay(op, sender.tabScope)) return DROP;
  const presence = isPresenceOpKind(opKind);
  // The level ladder (docs/specs/013-workspace/share-roles.md): presence from anyone; a Participant's dots,
  // responses and ideas relay like an Editor's; its `el` op goes through the participant content rule and
  // never relays as sent; everything else needs an Editor.
  const level = parseStoredLevel(sender.role);
  // A Viewer only looks (docs/specs/013-workspace/share-roles.md): of the presence class, a reaction is taking
  // part, so it needs a Participant.
  if (level === 'view' && opKind === 'reaction') return DROP;
  // Speaking is taking part too (docs/specs/008-canvas/avatar-mode.md "Who may speak"), and a message is held to
  // the limits here as every receiver holds it, so a malformed one reaches nobody.
  if (opKind === 'avatar-say' && (level === 'view' || !parseAvatarSay(op))) return DROP;
  // Bring Focus moves everyone's view (docs/specs/012-collaboration/bring-focus.md): running the session, so an
  // Editor's alone.
  if (opKind === 'focus-here' && level !== 'edit') return DROP;
  let participantAnswers = false;
  if (!presence && level !== 'edit') {
    if (level !== 'participate') return DROP;
    if (opKind === 'el') return { kind: 'participant-content' };
    if (!isParticipationOp(op) || !answersAsSelf(op, sender.key)) return DROP;
    participantAnswers = true;
  }
  // A drag preview (docs/specs/008-canvas/drag-preview.md) is presence, but shows elements moving: only
  // an editor's may reach anyone, so a viewer can never make others' elements appear to move.
  if (opKind === 'drag-preview' && sender.role !== 'edit') return DROP;
  return { kind: 'relay', presence, participantAnswers };
}
