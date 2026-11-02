// Which client ops a session may relay (docs/specs/013-workspace/share-roles.md "The level ladder"): the room's
// role gate as one pure decision, so every rule is testable without a socket. The room acts on the answer.
import { isPresenceOpKind, isSystemOpKind, parseStoredLevel } from '@livedesign/api-schema';
import { scopedSenderMayRelay } from './room-scope';

type OpGate =
  /** Never relayed, never answered. */
  | { kind: 'drop' }
  /** A Participant's `el` op: through the participant content rule, never relayed as sent. */
  | { kind: 'participant-content' }
  /** A Participant's own comment reaction: stamped and relayed as an Editor's, then written by the room. */
  | { kind: 'participant-reaction' }
  /** Relayed: unordered when `presence`. */
  | { kind: 'relay'; presence: boolean };

const DROP: OpGate = { kind: 'drop' };

// The tab fields a `tab-meta` patch never carries (the editor's tabMetaPatch skips them): the tab's id, its elements
// and its photos travel on their own ops, and a receiver spreads the patch over its tab.
const TAB_META_FIXED = ['id', 'elements', 'photos'] as const;

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

/** The sender as the gate needs it: its server-verified role, tab scope and the collab key its hello published. */
export type GateSender = {
  role: unknown;
  tabScope: string | null;
  key?: string;
};

// A comment reaction (docs/specs/012-collaboration/comment-reactions.md) naming its own sender: the one `el-delta`
// a Participant may send, since reacting is taking part. The key is the one its hello claimed, so this stops a
// Participant reacting in someone else's name in the same room.
export function reactsAsSelf(op: unknown, key: string | undefined): boolean {
  const o = op as { kind?: unknown; delta?: { kind?: unknown; by?: unknown } } | null;
  if (o?.kind !== 'el-delta' || typeof o.delta !== 'object' || o.delta === null) return false;
  return o.delta.kind === 'comment-react' && key !== undefined && o.delta.by === key;
}

export function gateClientOp(op: unknown, sender: GateSender): OpGate {
  // Presence ops (cursor / select / laser / tab-focus) are ephemeral
  // and mutate nothing, so they relay from ANY connected session —
  // that's how a view-only visitor still shows their cursor, current
  // selection, and which tab they're on to everyone else. Mutation
  // ops (tab content, design-meta) stay edit-role-only:
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
  // design's structure (docs/specs/013-workspace/tab-scoped-share-links.md).
  if (!scopedSenderMayRelay(op, sender.tabScope)) return DROP;
  // From anyone: a tab op's payload keeps to the tab it names.
  if (!keepsToItsTab(op)) return DROP;
  const presence = isPresenceOpKind(opKind);
  // The level ladder (docs/specs/013-workspace/share-roles.md): presence from anyone; a Participant's `el` op
  // goes through the participant content rule and never relays as sent; everything else needs an Editor.
  const level = parseStoredLevel(sender.role);
  // A Viewer only looks (docs/specs/013-workspace/share-roles.md): of the presence class, a reaction is taking
  // part, so it needs a Participant.
  if (level === 'view' && opKind === 'reaction') return DROP;
  if (!presence && level !== 'edit') {
    if (level === 'participate' && opKind === 'el') return { kind: 'participant-content' };
    if (level === 'participate' && reactsAsSelf(op, sender.key)) {
      return { kind: 'participant-reaction' };
    }
    return DROP;
  }
  // A drag preview (docs/specs/008-canvas/drag-preview.md) is presence, but shows elements moving: only
  // an editor's may reach anyone, so a viewer can never make others' elements appear to move.
  if (opKind === 'drag-preview' && sender.role !== 'edit') return DROP;
  return { kind: 'relay', presence };
}
