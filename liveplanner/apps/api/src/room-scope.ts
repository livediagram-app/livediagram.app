// The realtime room's half of tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md):
// what a session confined to one tab may receive and may send. Pure, so every
// rule is tested without a socket; the room applies them to each frame.
//
// Both directions fail closed: an op kind nobody taught these rules about is
// withheld from, and refused from, a scoped session.

// Ops that carry no tab and say nothing about one, which a scoped session
// still receives: the worker's share-link and Trash notices.
const TAB_LESS_DELIVERED = new Set([
  'share-revoked',
  'share-rescoped',
  'project-trashed',
  // The type catalogue holds no content and every tab's cards need it
  // (docs/specs/026-plan/item-types.md "Storage and sync").
  'item-types',
]);

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
  if (o.kind === 'project-meta') return redactProjectMeta(o, tabScope);
  // Item writes may touch items another tab shows: a scoped session hears that the store
  // moved on, without the items, and refetches the ones its tab shows
  // (docs/specs/026-plan/items.md "Who may do what").
  if (o.kind === 'items') return { ...o, upserts: [], removed: [] };
  const mine = onScope(o, tabScope);
  if (mine !== undefined) return mine ? op : null;
  return typeof o.kind === 'string' && TAB_LESS_DELIVERED.has(o.kind) ? op : null;
}

// Whether a session scoped to `tabScope` may put this op into the room: only an op about its own tab, and, unless the
// tab already showed every card when it joined (`tabShowsAll`), never one carrying a board or plan view, which would
// widen what the link reaches (docs/specs/026-plan/items.md "Who may do what").
// The role gate runs separately; this only confines the tab.
export function scopedSenderMayRelay(
  op: unknown,
  tabScope: string | null,
  tabShowsAll = false,
): boolean {
  if (tabScope === null) return true;
  const o = asOp(op);
  if (!o || o.kind === 'project-meta') return false;
  return onScope(o, tabScope) === true && (tabShowsAll || !carriesEveryCardElement(op));
}

const EVERY_CARD_SHAPES = new Set(['plan-board', 'plan-view']);
// An op nests its elements a few levels down at most (`tab.elements[]`, `ops[].element`); deeper is refused as one.
const OP_SCAN_DEPTH = 8;

// Whether an op holds, anywhere in its payload, an element that shows every card. Fails closed past OP_SCAN_DEPTH.
function carriesEveryCardElement(value: unknown, depth = 0): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (depth > OP_SCAN_DEPTH) return true;
  if (Array.isArray(value)) return value.some((v) => carriesEveryCardElement(v, depth + 1));
  const shape = (value as { shape?: unknown }).shape;
  if (typeof shape === 'string' && EVERY_CARD_SHAPES.has(shape)) return true;
  return Object.values(value).some((v) => carriesEveryCardElement(v, depth + 1));
}

// project-meta carries every tab's name and folder. Other tabs keep their id
// and position and are marked out of scope, exactly like the REST project
// (redactProjectForScope).
function redactProjectMeta(o: LooseOp, tabScope: string): unknown {
  if (!Array.isArray(o.tabs)) return null;
  return {
    ...o,
    tabs: (o.tabs as { id: string; orderIndex: number }[]).map((t) =>
      t.id === tabScope ? t : { id: t.id, name: '', orderIndex: t.orderIndex, outOfScope: true },
    ),
  };
}
