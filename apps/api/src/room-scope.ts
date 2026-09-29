// The realtime room's half of tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md):
// what a session confined to one tab may receive and may send. Pure, so every
// rule is tested without a socket; the room applies them to each frame.
//
// Both directions fail closed: an op kind nobody taught these rules about is
// withheld from, and refused from, a scoped session.

// Ops that carry no tab and say nothing about one, which a scoped session
// still receives: session tools and the worker's share-link and Trash notices.
const TAB_LESS_DELIVERED = new Set([
  'log-remove',
  'poll-start',
  'poll-answer',
  'poll-end',
  'share-revoked',
  'share-rescoped',
  'document-trashed',
]);

// The tab-less ops a scoped session may itself send.
const TAB_LESS_SENDABLE = new Set(['log-remove', 'poll-start', 'poll-answer', 'poll-end']);

type LooseOp = { kind?: unknown; tabId?: unknown; entry?: { tabId?: unknown }; tabs?: unknown };

function asOp(op: unknown): LooseOp | null {
  return typeof op === 'object' && op !== null ? (op as LooseOp) : null;
}

// Whether an op is about the scoped tab. `undefined` = the op names no tab
// at all, so the caller decides by kind.
function onScope(o: LooseOp, tabScope: string): boolean | undefined {
  if (o.kind === 'log') return o.entry?.tabId === tabScope;
  if ('tabId' in o) return o.tabId === tabScope;
  if (o.kind === 'select') return false;
  return undefined;
}

// The op as a session scoped to `tabScope` should see it, or null to
// withhold it. `tabScope` null (owner, team member, All-tabs link) passes
// every op through untouched.
export function opForScope(op: unknown, tabScope: string | null): unknown {
  if (tabScope === null) return op;
  const o = asOp(op);
  if (!o) return null;
  if (o.kind === 'diagram-meta') return redactDocumentMeta(o, tabScope);
  const mine = onScope(o, tabScope);
  if (mine !== undefined) return mine ? op : null;
  return typeof o.kind === 'string' && TAB_LESS_DELIVERED.has(o.kind) ? op : null;
}

// Whether a session scoped to `tabScope` may put this op into the room.
// The role gate runs separately; this only confines the tab.
export function scopedSenderMayRelay(op: unknown, tabScope: string | null): boolean {
  if (tabScope === null) return true;
  const o = asOp(op);
  if (!o || o.kind === 'diagram-meta') return false;
  const mine = onScope(o, tabScope);
  if (mine !== undefined) return mine;
  return typeof o.kind === 'string' && TAB_LESS_SENDABLE.has(o.kind);
}

// diagram-meta carries every tab's name and folder. Other tabs keep their id
// and position and are marked out of scope, exactly like the REST diagram
// (redactDiagramForScope).
function redactDocumentMeta(o: LooseOp, tabScope: string): unknown {
  if (!Array.isArray(o.tabs)) return null;
  return {
    ...o,
    tabs: (o.tabs as { id: string; orderIndex: number }[]).map((t) =>
      t.id === tabScope ? t : { id: t.id, name: '', orderIndex: t.orderIndex, outOfScope: true },
    ),
  };
}
