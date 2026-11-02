// The realtime room's half of tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md):
// what a session confined to one tab may receive and may send. Pure, so every
// rule is tested without a socket; the room applies them to each frame.
//
// Both directions fail closed: an op kind nobody taught these rules about is
// withheld from, and refused from, a scoped session.

// Ops that carry no tab and say nothing about one, which a scoped session
// still receives: session tools and the worker's share-link and Trash notices.
const TAB_LESS_DELIVERED = new Set([
  'poll-start',
  'poll-answer',
  'poll-end',
  'share-revoked',
  'share-rescoped',
  'document-trashed',
]);

// The tab-less ops a scoped session may itself send.
// A follow (docs/specs/012-collaboration/follow-me-viewport.md) names a person, not a tab, so a scoped visitor may follow too.
const TAB_LESS_SENDABLE = new Set(['poll-start', 'poll-answer', 'poll-end', 'follow']);

type LooseOp = { kind?: unknown; tabId?: unknown; tabs?: unknown };

function asOp(op: unknown): LooseOp | null {
  return typeof op === 'object' && op !== null ? op : null;
}

// Whether an op is about the scoped tab. `undefined` = the op names no tab
// at all, so the caller decides by kind.
function onScope(o: LooseOp, tabScope: string): boolean | undefined {
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
  if (o.kind === 'document-meta') return redactDocumentMeta(o, tabScope);
  const mine = onScope(o, tabScope);
  if (mine !== undefined) return mine ? op : null;
  return typeof o.kind === 'string' && TAB_LESS_DELIVERED.has(o.kind) ? op : null;
}

// Whether a session scoped to `tabScope` may put this op into the room.
// The role gate runs separately; this only confines the tab.
export function scopedSenderMayRelay(op: unknown, tabScope: string | null): boolean {
  if (tabScope === null) return true;
  const o = asOp(op);
  if (!o || o.kind === 'document-meta') return false;
  const mine = onScope(o, tabScope);
  if (mine !== undefined) return mine;
  return typeof o.kind === 'string' && TAB_LESS_SENDABLE.has(o.kind);
}

// A tab's name is structure, so a scoped session never renames its tab
// (docs/specs/013-workspace/tab-scoped-share-links.md "No rename from a scoped session"). Its `tab-meta` rename is
// refused by scopedRenames below; its whole-`tab` op, which every receiver merges name and all, goes out stamped
// with the stored name. `storedName` reads the room's store and is called only for that one case; a tab the store
// does not name (null) passes as sent.
export function scopedTabOp(
  op: unknown,
  tabScope: string | null,
  storedName: (tabId: string) => string | null,
): unknown {
  if (tabScope === null) return op;
  const o = op as { kind?: unknown; tabId?: unknown; tab?: unknown } | null;
  if (o?.kind !== 'tab' || typeof o.tabId !== 'string') return op;
  if (typeof o.tab !== 'object' || o.tab === null) return op;
  const name = storedName(o.tabId);
  if (name === null) return op;
  return { ...o, tab: { ...o.tab, name } };
}

// Whether a scoped session's op renames its tab: a `tab-meta` patch that sets `name` or clears it.
export function scopedRenames(op: unknown, tabScope: string | null): boolean {
  if (tabScope === null) return false;
  const o = op as { kind?: unknown; patch?: unknown; clear?: unknown } | null;
  if (o?.kind !== 'tab-meta') return false;
  const patch = o.patch;
  if (typeof patch === 'object' && patch !== null && Object.hasOwn(patch, 'name')) return true;
  return Array.isArray(o.clear) && o.clear.includes('name');
}

// document-meta carries every tab's name and folder. Other tabs keep their id
// and position and are marked out of scope, exactly like the REST document
// (redactDocumentForScope).
function redactDocumentMeta(o: LooseOp, tabScope: string): unknown {
  if (!Array.isArray(o.tabs)) return null;
  return {
    ...o,
    tabs: (o.tabs as { id: string; orderIndex: number }[]).map((t) =>
      t.id === tabScope ? t : { id: t.id, name: '', orderIndex: t.orderIndex, outOfScope: true },
    ),
  };
}
