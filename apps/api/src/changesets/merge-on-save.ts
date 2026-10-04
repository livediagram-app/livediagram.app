import {
  elementFingerprint,
  mergeIncomingElement,
  type Element,
  type ElementOp,
  type Tab,
} from '@livediagram/document';
import type { ChangesetFingerprints, MergeEntry } from '../db/changesets';

// The merge on save (docs/specs/024-agents/agent-changesets.md "The write path" step 8): every
// recorded changeset after the revision an editor has seen is re-applied to the tab it saves,
// element by element, before the write. A changeset's version is taken only where the save still
// holds the element exactly as the changeset found it; anything else was changed by the person
// after, and their version stands (`superseded`). Taking it keeps the save's live fields, which the
// fingerprint ignores (CS44). Pure and idempotent.

export type MergeResult = { tab: Tab; merged: number; superseded: number };

export function mergeChangesetsIntoSave(save: Tab, entries: readonly MergeEntry[]): MergeResult {
  let elements = save.elements;
  let merged = 0;
  let superseded = 0;
  for (const { record, ops } of entries) {
    for (const op of ops) {
      const step = mergeOne(elements, op, record.fingerprints);
      elements = step.elements;
      if (step.outcome === 'merged') merged += 1;
      if (step.outcome === 'superseded') superseded += 1;
    }
  }
  return { tab: elements === save.elements ? save : { ...save, elements }, merged, superseded };
}

type Step = { elements: Element[]; outcome: 'merged' | 'superseded' | 'none' };

function mergeOne(elements: Element[], op: ElementOp, fps: ChangesetFingerprints): Step {
  const keep = (outcome: Step['outcome']): Step => ({ elements, outcome });
  if (op.kind === 'reorder') return mergeReorder(elements, op.ids, fps.beforeOrder);
  const id = op.kind === 'remove' ? op.id : op.element.id;
  const index = elements.findIndex((e) => e.id === id);
  const cur = index === -1 ? undefined : elements[index]!;
  const fp = cur ? elementFingerprint(cur) : null;
  switch (op.kind) {
    case 'add': {
      if (!cur) {
        const next = elements.slice();
        next.splice(Math.min(op.at, next.length), 0, op.element);
        return { elements: next, outcome: 'merged' };
      }
      return keep(fp === fps.after[id] ? 'none' : 'superseded');
    }
    case 'update': {
      if (cur && fp === fps.before[id]) {
        const next = elements.slice();
        next[index] = mergeIncomingElement(cur, op.element);
        return { elements: next, outcome: 'merged' };
      }
      return keep(cur && fp === fps.after[id] ? 'none' : 'superseded');
    }
    case 'remove': {
      if (cur && fp === fps.before[id]) {
        return { elements: elements.filter((e) => e.id !== id), outcome: 'merged' };
      }
      return keep(cur ? 'superseded' : 'none');
    }
  }
}

// A reorder lands only where the save still has the elements it moved in the order the changeset
// found them; their slots in the save then take the changeset's order.
function mergeReorder(
  elements: Element[],
  afterIds: readonly string[],
  beforeOrder: readonly string[] | undefined,
): Step {
  if (!beforeOrder) return { elements, outcome: 'none' };
  const present = new Set(elements.map((e) => e.id));
  const moved = new Set(beforeOrder.filter((id) => present.has(id)));
  const saveOrder = elements.filter((e) => moved.has(e.id)).map((e) => e.id);
  const foundOrder = beforeOrder.filter((id) => moved.has(id));
  const targetOrder = afterIds.filter((id) => moved.has(id));
  if (sameIds(saveOrder, targetOrder)) return { elements, outcome: 'none' };
  if (!sameIds(saveOrder, foundOrder)) return { elements, outcome: 'superseded' };
  const byId = new Map(elements.map((e) => [e.id, e] as const));
  let slot = 0;
  const next = elements.map((e) => (moved.has(e.id) ? byId.get(targetOrder[slot++]!)! : e));
  return { elements: next, outcome: 'merged' };
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
