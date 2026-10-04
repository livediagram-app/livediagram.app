import {
  elementFingerprint,
  mergeIncomingElement,
  type Element,
  type ElementOp,
  type Tab,
} from '@livediagram/document';
import type { RevertKept } from '@livediagram/api-schema';
import type { ChangesetFingerprints } from '../db/changesets';

// A revert (docs/specs/024-agents/agent-changesets.md "Revert"): the changeset's inverse applied to
// the tab as it is now, element by element. An element changed since the changeset (its fingerprint
// differs from the after-image) is left as it is and listed as kept; the rest are reverted. Taking
// the before-image keeps the current element's live fields (CS44). Pure.

export type RevertPlan = { elements: Element[]; reverted: number; kept: RevertKept[] };

export function planRevert(
  current: Tab,
  ops: readonly ElementOp[],
  inverse: readonly ElementOp[],
  fps: ChangesetFingerprints,
): RevertPlan {
  const beforeImage = new Map<string, { element: Element; at: number | null }>();
  let beforeIds: string[] | null = null;
  for (const op of inverse) {
    if (op.kind === 'add') beforeImage.set(op.element.id, { element: op.element, at: op.at });
    if (op.kind === 'update') beforeImage.set(op.element.id, { element: op.element, at: null });
    if (op.kind === 'reorder') beforeIds = op.ids;
  }

  let elements = current.elements;
  let reverted = 0;
  const kept: RevertKept[] = [];
  const find = (id: string) => elements.findIndex((e) => e.id === id);
  const asLeft = (index: number, id: string) =>
    index !== -1 && elementFingerprint(elements[index]!) === fps.after[id];

  for (const op of ops) {
    if (op.kind === 'reorder') continue;
    const id = op.kind === 'remove' ? op.id : op.element.id;
    const index = find(id);
    if (op.kind === 'add') {
      if (!asLeft(index, id)) {
        kept.push({ id, reason: index === -1 ? 'gone' : 'changed' });
        continue;
      }
      elements = elements.filter((e) => e.id !== id);
    } else if (op.kind === 'update') {
      const before = beforeImage.get(id);
      if (!before || !asLeft(index, id)) {
        kept.push({ id, reason: index === -1 ? 'gone' : 'changed' });
        continue;
      }
      elements = elements.slice();
      elements[index] = mergeIncomingElement(elements[index]!, before.element);
    } else {
      const before = beforeImage.get(id);
      if (index !== -1 || !before) {
        kept.push({ id, reason: 'present' });
        continue;
      }
      elements = elements.slice();
      elements.splice(Math.min(before.at ?? elements.length, elements.length), 0, before.element);
    }
    reverted += 1;
  }

  const reorder = ops.find(
    (op): op is Extract<ElementOp, { kind: 'reorder' }> => op.kind === 'reorder',
  );
  if (reorder && beforeIds && fps.beforeOrder) {
    const order = revertOrder(elements, reorder.ids, fps.beforeOrder);
    if (order === null) kept.push({ id: fps.beforeOrder[0] ?? '', reason: 'order' });
    else elements = order;
  }
  return { elements, reverted, kept };
}

// The elements in the order the changeset found them, when they still sit in the order it left;
// null when somebody reordered them since.
function revertOrder(
  elements: Element[],
  afterIds: readonly string[],
  beforeOrder: readonly string[],
): Element[] | null {
  const present = new Set(elements.map((e) => e.id));
  const moved = new Set(beforeOrder.filter((id) => present.has(id)));
  const nowOrder = elements.filter((e) => moved.has(e.id)).map((e) => e.id);
  const leftOrder = afterIds.filter((id) => moved.has(id));
  if (!nowOrder.every((id, i) => id === leftOrder[i]) || nowOrder.length !== leftOrder.length) {
    return null;
  }
  const target = beforeOrder.filter((id) => moved.has(id));
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  let slot = 0;
  return elements.map((e) => (moved.has(e.id) ? byId.get(target[slot++]!)! : e));
}
