// Which client ops a session may relay (docs/specs/013-workspace/share-roles.md "The level ladder"): the room's
// role gate as one pure decision, so every rule is testable without a socket. The room acts on the answer.
import { isPresenceOpKind, isSystemOpKind, parseStoredLevel } from '@liveknowledge/api-schema';
import { scopedSenderMayRelay } from './room-scope';

type OpGate =
  /** Never relayed, never answered. */
  | { kind: 'drop' }
  /** Relayed: unordered when `presence`. */
  | { kind: 'relay'; presence: boolean };

const DROP: OpGate = { kind: 'drop' };

// The tab fields a `tab-meta` patch never carries (the editor's tabMetaPatch skips them): the tab's id, its elements
// and its articles' writing travel on their own ops, and a receiver spreads the patch over its tab.
const TAB_META_FIXED = ['id', 'elements', 'articles'] as const;

// Whether a tab-content op keeps to the tab it names. A receiver merges a `tab` op's payload over its own tab and
// spreads a `tab-meta` patch over it, so a payload naming another id would renumber the tab on every peer: their
// next save then writes it over that other tab, past the sender's own tab scope (and past nobody's edit gate).
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

/** Whether a server-verified role writes the knowledgebase: an Editor or a Participant. */
function writerLevel(role: unknown): boolean {
  const level = parseStoredLevel(role);
  return level === 'edit' || level === 'participate';
}

/** The sender as the gate needs it: its server-verified role and tab scope. */
export type GateSender = {
  role: unknown;
  tabScope: string | null;
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
  if (!keepsToItsTab(op)) return DROP;
  const presence = isPresenceOpKind(opKind);
  // The level ladder (docs/specs/013-workspace/share-roles.md): presence from anyone; every change needs a page
  // writer. In liveknowledge a Participant is an Editor minus the Knowledgebase Settings, the Knowledgebase Style and
  // automations (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles"), so its writing, its page
  // tree changes and its elements relay as an Editor's. Neither the settings nor the style ever rides a socket's
  // `document-meta` (document-room-frames.ts strips both, whoever sent it): the api alone sends them.
  const writes = writerLevel(sender.role);
  if (!presence && !writes) return DROP;
  // A drag preview (docs/specs/008-canvas/drag-preview.md) is presence, but shows elements moving: only a writer's
  // may reach anyone, so a viewer can never make others' elements appear to move.
  if (opKind === 'drag-preview' && !writes) return DROP;
  // Who is editing a page, and a page saved (docs/specs/030-knowledgebase/editing.md): only a writer edits a page,
  // so nobody else can claim to be editing one or say they saved it.
  if ((opKind === 'page-editing' || opKind === 'page-saved') && !writes) return DROP;
  return { kind: 'relay', presence };
}
