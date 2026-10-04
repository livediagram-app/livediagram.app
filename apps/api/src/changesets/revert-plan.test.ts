import { describe, expect, it } from 'vitest';
import {
  diffToElementOps,
  elementFingerprint,
  invertElementOps,
  type Element,
  type Tab,
} from '@livediagram/document';
import { planRevert } from './revert-plan';

// docs/specs/024-agents/agent-changesets.md "Revert": the inverse as a new changeset, leaving any
// element changed since, listed as kept.

const box = (id: string, label = id): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, label }) as Element;
const fp = elementFingerprint;
const tab = (elements: Element[]): Tab => ({ id: 't1', name: 'T', elements });

// A changeset from `before` to `after`, as the pipeline records it.
function changeset(before: Element[], after: Element[]) {
  const ops = diffToElementOps(before, after);
  const touched = new Set(
    ops.flatMap((op) =>
      op.kind === 'remove' ? [op.id] : op.kind === 'reorder' ? [] : [op.element.id],
    ),
  );
  const map = (els: Element[]) =>
    Object.fromEntries(els.filter((e) => touched.has(e.id)).map((e) => [e.id, fp(e)]));
  return {
    ops,
    inverse: invertElementOps(before, ops),
    fingerprints: { before: map(before), after: map(after) },
  };
}

describe('planRevert', () => {
  const before = [box('a', 'old'), box('b'), box('gone')];
  const after = [box('a', 'new'), box('b'), box('n')];
  const cs = changeset(before, after);

  it('undoes every element nobody touched since', () => {
    const out = planRevert(tab(after), cs.ops, cs.inverse, cs.fingerprints);
    expect(out.elements).toEqual(before);
    expect(out).toMatchObject({ reverted: 3, kept: [] });
  });

  it('keeps an element changed since, a removed one put back, and an added one gone', () => {
    const now = [box('a', 'person'), box('b'), box('gone')];
    const out = planRevert(tab(now), cs.ops, cs.inverse, cs.fingerprints);
    expect(out.elements).toEqual([box('a', 'person'), box('b'), box('gone')]);
    // In the record's op order: removes first, then adds and updates in element order.
    expect(out.kept).toEqual([
      { id: 'gone', reason: 'present' },
      { id: 'a', reason: 'changed' },
      { id: 'n', reason: 'gone' },
    ]);
    expect(out.reverted).toBe(0);
  });

  it('reverting twice keeps everything and changes nothing', () => {
    const once = planRevert(tab(after), cs.ops, cs.inverse, cs.fingerprints);
    const twice = planRevert(tab(once.elements), cs.ops, cs.inverse, cs.fingerprints);
    expect(twice.elements).toEqual(once.elements);
    expect(twice.reverted).toBe(0);
  });

  it('empties a tab the changeset created', () => {
    const made = changeset([], [box('x'), box('y')]);
    const out = planRevert(tab([box('x'), box('y')]), made.ops, made.inverse, made.fingerprints);
    expect(out.elements).toEqual([]);
  });

  it('reverts a reorder only while the order is as the changeset left it', () => {
    const order = changeset([box('a'), box('b')], [box('b'), box('a')]);
    const fps = { ...order.fingerprints, beforeOrder: ['a', 'b'] };
    expect(
      planRevert(tab([box('b'), box('a')]), order.ops, order.inverse, fps).elements.map(
        (e) => e.id,
      ),
    ).toEqual(['a', 'b']);
    const moved = planRevert(tab([box('a'), box('b'), box('c')]), order.ops, order.inverse, fps);
    expect(moved.kept).toEqual([{ id: 'a', reason: 'order' }]);
  });
});
