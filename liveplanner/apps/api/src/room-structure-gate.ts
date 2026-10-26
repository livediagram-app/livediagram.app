// The room's half of a tab-scoped Editor's limits (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"):
// whether an op from a session confined to one tab keeps that tab's structure (its name, the Plan elements that pull
// cards onto it, where its form's responses go). Pure, in two steps so the common op costs no read: `structureFirst`
// answers from the op alone where it can, and `structureAgainst` answers the rest from the stored tab.
import { elementReach } from '@liveplanner/items';
import { formLeavesTab, reachIndex, structureChange, type StructuredTab } from './tab-structure';

/** `relay` and `drop` are final; `stored` needs the stored tab (structureAgainst). */
export type StructureVerdict = 'relay' | 'drop' | 'stored';

// The element fields a patch never touches from a scoped session: they decide what the element pulls in.
const REACH_FIELDS = ['shape', 'planBoard', 'planCard'];

type LooseOp = {
  kind?: unknown;
  op?: { kind?: unknown; element?: unknown; set?: unknown; clear?: unknown };
  patch?: unknown;
  clear?: unknown;
};

const names = (list: unknown, key: string): boolean => Array.isArray(list) && list.includes(key);

export function structureFirst(op: unknown, scope: string): StructureVerdict {
  const o = (typeof op === 'object' && op !== null ? op : {}) as LooseOp;
  if (o.kind === 'tab') return 'stored';
  if (o.kind === 'tab-meta') {
    const patch = (typeof o.patch === 'object' && o.patch !== null ? o.patch : {}) as {
      form?: unknown;
    };
    if (Object.hasOwn(patch, 'name') || names(o.clear, 'name')) return 'drop';
    if (Object.hasOwn(patch, 'form') && formLeavesTab(undefined, patch.form, scope))
      return 'stored';
    return 'relay';
  }
  if (o.kind !== 'el') return 'relay';
  const inner = o.op ?? {};
  if (inner.kind === 'add') {
    const el = inner.element;
    return typeof el === 'object' && el !== null && elementReach(el) !== null ? 'drop' : 'relay';
  }
  if (inner.kind === 'patch') {
    const set = typeof inner.set === 'object' && inner.set !== null ? inner.set : {};
    const touches = REACH_FIELDS.some((f) => Object.hasOwn(set, f) || names(inner.clear, f));
    return touches ? 'drop' : 'relay';
  }
  if (inner.kind === 'update' || inner.kind === 'remove') return 'stored';
  return 'relay';
}

/** Whether an op `structureFirst` sent to the store keeps the stored tab's structure. */
export function structureAgainst(
  op: unknown,
  stored: StructuredTab | null,
  scope: string,
): boolean {
  const o = op as LooseOp & { tab?: StructuredTab };
  if (o.kind === 'tab') return o.tab ? structureChange(stored, o.tab, scope) === null : false;
  if (o.kind === 'tab-meta') {
    const patch = o.patch as { form?: unknown };
    return !formLeavesTab(stored?.form, patch.form, scope);
  }
  const inner = o.op as { kind?: unknown; element?: { id?: unknown }; id?: unknown };
  const id = inner.kind === 'remove' ? inner.id : inner.element?.id;
  if (typeof id !== 'string') return false;
  const was = reachIndex(stored?.elements).get(id) ?? null;
  if (inner.kind === 'remove') return was === null;
  const el = inner.element;
  return (typeof el === 'object' && el !== null ? elementReach(el) : null) === was;
}
