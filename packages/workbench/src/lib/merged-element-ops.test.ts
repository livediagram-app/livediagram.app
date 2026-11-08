import { describe, expect, it } from 'vitest';
import { seededRandom } from '@liveworkspace/model-core/seeded-random';
import { applyMergedElementOps, type ElementOpOf } from './merged-element-ops';

// docs/specs/024-agents/agent-changesets.md "In the editor": a changeset's ops apply as a peer's would, each merged
// over the element as the ops before it left it. The one-pass version must give exactly what one op at a time gave.

// A toy element: `live` is a field the merge folds from the receiver's copy (as answers and comments are), `rev` one
// the apply keeps the newer of (as a Q&A board's notes are).
type El = { id: string; v: number; live?: number; rev?: number };
type Op = ElementOpOf<El>;

const merge = (local: El, incoming: El): El => ({
  ...incoming,
  live: (local.live ?? 0) + (incoming.live ?? 0) + (local.rev ?? 0),
});
const put = (current: El, incoming: El): El =>
  (current.rev ?? 0) > (incoming.rev ?? 0) ? { ...incoming, rev: current.rev } : incoming;

// One op, shaped like each editor's applyElementOp.
function applyOne(elements: El[], op: Op): El[] {
  switch (op.kind) {
    case 'add': {
      if (elements.some((e) => e.id === op.element.id)) {
        return elements.map((e) => (e.id === op.element.id ? put(e, op.element) : e));
      }
      const next = elements.slice();
      next.splice(Math.max(0, Math.min(op.at, next.length)), 0, op.element);
      return next;
    }
    case 'update':
      return elements.some((e) => e.id === op.element.id)
        ? elements.map((e) => (e.id === op.element.id ? put(e, op.element) : e))
        : elements;
    case 'remove':
      return elements.filter((e) => e.id !== op.id);
    case 'reorder': {
      const byId = new Map(elements.map((e) => [e.id, e]));
      const ids = new Set(op.ids);
      const ordered = [...ids].map((id) => byId.get(id)).filter((e): e is El => e !== undefined);
      return [...ordered, ...elements.filter((e) => !ids.has(e.id))];
    }
  }
}
const applyAll = (elements: El[], ops: Op[]) => ops.reduce(applyOne, elements);

// The loop this replaced: look the element up, merge, apply, per op.
function oneAtATime(elements: El[], ops: Op[]): El[] {
  let out = elements;
  for (const op of ops) {
    if (op.kind === 'add' || op.kind === 'update') {
      const local = out.find((e) => e.id === op.element.id);
      out = applyOne(out, local ? { ...op, element: merge(local, op.element) } : op);
    } else out = applyOne(out, op);
  }
  return out;
}

function randomCase(rand: () => number): { elements: El[]; ops: Op[] } {
  const id = () => `e${Math.floor(rand() * 12)}`;
  const el = (): El => ({
    id: id(),
    v: Math.floor(rand() * 100),
    ...(rand() < 0.5 ? { live: Math.floor(rand() * 9) } : {}),
    ...(rand() < 0.3 ? { rev: Math.floor(rand() * 4) } : {}),
  });
  // Ids may repeat in the tab: a peer's racing double-add can leave one there twice.
  const elements = Array.from({ length: Math.floor(rand() * 10) }, el);
  const ops = Array.from({ length: Math.floor(rand() * 25) }, (): Op => {
    const roll = rand();
    if (roll < 0.45) return { kind: 'update', element: el() };
    if (roll < 0.7) return { kind: 'add', element: el(), at: Math.floor(rand() * 12) - 1 };
    if (roll < 0.9) return { kind: 'remove', id: id() };
    return { kind: 'reorder', ids: Array.from({ length: Math.floor(rand() * 8) }, id) };
  });
  return { elements, ops };
}

describe('applyMergedElementOps', () => {
  it('equals applying the ops one at a time, over random changesets', () => {
    const rand = seededRandom(7);
    for (let n = 0; n < 4000; n++) {
      const { elements, ops } = randomCase(rand);
      const expected = oneAtATime(elements, ops);
      const actual = applyMergedElementOps(elements, ops, merge, applyAll);
      expect(actual).toEqual(expected);
      // Unchanged stays the same array, so the tab keeps its identity.
      if (expected === elements) expect(actual).toBe(elements);
    }
  });

  it('merges over what an earlier op in the run left', () => {
    const elements: El[] = [{ id: 'a', v: 1, live: 5 }];
    const ops: Op[] = [
      { kind: 'update', element: { id: 'a', v: 2, live: 1 } },
      { kind: 'remove', id: 'a' },
      { kind: 'add', element: { id: 'a', v: 3, live: 7 }, at: 0 },
      { kind: 'update', element: { id: 'a', v: 4 } },
    ];
    // The add found no element (the remove took it), so it lands as given; the update then merges over it.
    expect(applyMergedElementOps(elements, ops, merge, applyAll)).toEqual([
      { id: 'a', v: 4, live: 7 },
    ]);
  });

  it('returns the elements themselves for no ops', () => {
    const elements: El[] = [{ id: 'a', v: 1 }];
    expect(applyMergedElementOps(elements, [], merge, applyAll)).toBe(elements);
  });
});
