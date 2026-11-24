// Every product api's tests of the changeset plans (../changeset-plans.ts), run by its
// apps/api/src/changesets/plans.test.ts over the plans it bound to its own model: its real fingerprint, its real
// whole-element merge and its element ops. One case per rule of each product's
// docs/specs/024-agents/blueprints/agent-changesets.md tables (the base check, the merge on save, the revert).

import { describe, expect, it } from 'vitest';
import type {
  ChangesetFingerprints,
  createChangesetPlans,
  PlanElement,
  PlanOp,
} from '../changeset-plans';

export type ChangesetPlanFacts<E extends PlanElement> = {
  /** The product's `createChangesetPlans` binding. */
  plans: ReturnType<typeof createChangesetPlans<E>>;
  elementFingerprint: (element: E) => string;
  diffToElementOps: (before: E[], after: E[]) => PlanOp<E>[];
  invertElementOps: (before: E[], ops: PlanOp<E>[]) => PlanOp<E>[];
  /** A small labelled box of the product's own kind, with any fields laid over it. */
  box: (id: string, label: string, over?: Record<string, unknown>) => E;
};

export function describeChangesetPlans<E extends PlanElement>(f: ChangesetPlanFacts<E>): void {
  const { checkBase, mergeChangesetsIntoSave, planRevert } = f.plans;
  const { diffToElementOps, invertElementOps } = f;
  const fp = f.elementFingerprint;
  const box = (id: string, label = id, over: Record<string, unknown> = {}): E =>
    f.box(id, label, over);
  const stored = (rev: number, elements: E[]) => ({ id: 't1', name: 'T', elements, rev });
  const tab = (elements: E[]) => ({ id: 't1', name: 'T', elements });
  const ids = (t: { elements: E[] }) => t.elements.map((e) => e.id);

  describe('checkBase', () => {
    const now = stored(5, [box('a'), box('b'), box('c')]);

    it('refuses strict without a base', () => {
      expect(checkBase(undefined, now, ['a'], [], true)).toEqual({
        ok: false,
        status: 400,
        error: 'strict_needs_base',
      });
    });

    it('applies without a base, warning no_base', () => {
      expect(checkBase(undefined, now, ['a'], [], false)).toEqual({
        ok: true,
        rebasedOver: 0,
        warnings: ['no_base'],
      });
    });

    it('refuses a base newer than the tab, or than a tab not yet made', () => {
      expect(checkBase({ rev: 6 }, now, [], [], false)).toMatchObject({
        status: 400,
        error: 'invalid_base',
      });
      expect(checkBase({ rev: 1 }, null, [], [], false)).toMatchObject({
        status: 400,
        error: 'invalid_base',
      });
      expect(checkBase({ rev: 0 }, null, [], ['n'], false)).toEqual({
        ok: true,
        rebasedOver: 0,
        warnings: [],
      });
    });

    it('applies on an unchanged revision, strict included', () => {
      expect(checkBase({ rev: 5 }, now, ['a'], [], true)).toEqual({
        ok: true,
        rebasedOver: 0,
        warnings: [],
      });
    });

    it('answers stale_tab for strict on a changed revision', () => {
      expect(checkBase({ rev: 3, elements: { a: fp(box('a')) } }, now, ['a'], [], true)).toEqual({
        ok: false,
        status: 412,
        error: 'stale_tab',
        rev: 5,
      });
    });

    it('rebases over other writes when every target is as read', () => {
      const base = { rev: 3, elements: { a: fp(box('a')), b: fp(box('b')) } };
      expect(checkBase(base, now, ['a', 'b', 'n'], ['n'], false)).toEqual({
        ok: true,
        rebasedOver: 2,
        warnings: [],
      });
    });

    it('collects every conflict: changed, vanished, and a target the base never read', () => {
      const base = { rev: 3, elements: { a: fp(box('a', 'old')), gone: fp(box('gone')) } };
      const out = checkBase(base, now, ['a', 'c', 'gone'], [], false);
      expect(out).toEqual({
        ok: false,
        status: 409,
        error: 'changeset_conflict',
        rev: 5,
        conflicts: [
          { id: 'a', reason: 'changed', readFingerprint: fp(box('a', 'old')), now: box('a') },
          { id: 'gone', reason: 'vanished', readFingerprint: fp(box('gone')), now: null },
          { id: 'c', reason: 'resolves_differently', readFingerprint: null, now: box('c') },
        ],
      });
    });

    it('a base carrying only a revision resolves every target differently once the tab moved', () => {
      const out = checkBase({ rev: 4 }, now, ['b'], [], false);
      expect(out).toMatchObject({
        status: 409,
        conflicts: [{ id: 'b', reason: 'resolves_differently' }],
      });
    });

    it('ignores live fields: a comment added since is no conflict', () => {
      const commented = {
        ...box('a'),
        commentThread: {
          resolved: false,
          comments: [{ id: 'c', text: 'hi', createdAt: 1, authorName: 'B', authorColor: '#f00' }],
        },
      } as unknown as E;
      const out = checkBase(
        { rev: 3, elements: { a: fp(box('a')) } },
        stored(5, [commented]),
        ['a'],
        [],
        false,
      );
      expect(out).toEqual({ ok: true, rebasedOver: 2, warnings: [] });
    });
  });

  function entry(ops: PlanOp<E>[], fingerprints: ChangesetFingerprints, rev = 2) {
    return {
      record: {
        id: `cs_${String(rev).padStart(10, '0')}`,
        documentId: 'D',
        tabId: 't1',
        rev,
        baseRev: null,
        authorId: 'u',
        authorName: 'W',
        authorColor: '#000',
        tokenId: 'tok',
        summary: null,
        fingerprints,
        counts: { added: 0, changed: 0, removed: 0 },
        createdTab: false,
        revertOf: null,
        createdAt: 1,
      },
      ops,
    };
  }

  describe('mergeChangesetsIntoSave', () => {
    it('adds back an element the changeset added and the save lacks, at its index', () => {
      const added = box('n');
      const out = mergeChangesetsIntoSave(tab([box('a'), box('b')]), [
        entry([{ kind: 'add', element: added, at: 1 }], { before: {}, after: { n: fp(added) } }),
      ]);
      expect(ids(out.tab)).toEqual(['a', 'n', 'b']);
      expect(out).toMatchObject({ merged: 1, superseded: 0 });
    });

    it('keeps a save that holds the added id in another form, counting it superseded', () => {
      const out = mergeChangesetsIntoSave(tab([box('n', 'mine')]), [
        entry([{ kind: 'add', element: box('n'), at: 0 }], {
          before: {},
          after: { n: fp(box('n')) },
        }),
      ]);
      expect(out.tab.elements[0]).toMatchObject({ label: 'mine' });
      expect(out).toMatchObject({ merged: 0, superseded: 1 });
    });

    it("takes the changeset's update where the save holds the element as it was found, keeping the save's live fields", () => {
      const thread = {
        resolved: false,
        comments: [{ id: 'c', text: 'hi', createdAt: 1, authorName: 'B', authorColor: '#f00' }],
      };
      const saved = box('a', 'old', { commentThread: thread });
      const out = mergeChangesetsIntoSave(tab([saved]), [
        entry([{ kind: 'update', element: box('a', 'new') }], {
          before: { a: fp(box('a', 'old')) },
          after: { a: fp(box('a', 'new')) },
        }),
      ]);
      expect(out.tab.elements[0]).toMatchObject({ label: 'new', commentThread: thread });
      expect(out.merged).toBe(1);
    });

    it("keeps a person's later change over the changeset's update", () => {
      const out = mergeChangesetsIntoSave(tab([box('a', 'person')]), [
        entry([{ kind: 'update', element: box('a', 'agent') }], {
          before: { a: fp(box('a', 'old')) },
          after: { a: fp(box('a', 'agent')) },
        }),
      ]);
      expect(out.tab.elements[0]).toMatchObject({ label: 'person' });
      expect(out).toMatchObject({ merged: 0, superseded: 1 });
    });

    it('removes what the changeset removed only when the save still holds it as found', () => {
      const fingerprints = { before: { a: fp(box('a')) }, after: {} };
      const removed = mergeChangesetsIntoSave(tab([box('a'), box('b')]), [
        entry([{ kind: 'remove', id: 'a' }], fingerprints),
      ]);
      expect(ids(removed.tab)).toEqual(['b']);
      const edited = mergeChangesetsIntoSave(tab([box('a', 'edited'), box('b')]), [
        entry([{ kind: 'remove', id: 'a' }], fingerprints),
      ]);
      expect(ids(edited.tab)).toEqual(['a', 'b']);
      expect(edited.superseded).toBe(1);
    });

    it('re-applies a reorder only when the save keeps the order the changeset found', () => {
      const fingerprints = { before: {}, after: {}, beforeOrder: ['a', 'b', 'c'] };
      const reorder: PlanOp<E> = { kind: 'reorder', ids: ['c', 'a', 'b'] };
      const kept = mergeChangesetsIntoSave(tab([box('a'), box('x'), box('b'), box('c')]), [
        entry([reorder], fingerprints),
      ]);
      expect(ids(kept.tab)).toEqual(['c', 'x', 'a', 'b']);
      const moved = mergeChangesetsIntoSave(tab([box('b'), box('a'), box('c')]), [
        entry([reorder], fingerprints),
      ]);
      expect(ids(moved.tab)).toEqual(['b', 'a', 'c']);
      expect(moved.superseded).toBe(1);
    });

    it('applies several changesets in revision order', () => {
      const n1 = box('n', 'first');
      const n2 = box('n', 'second');
      const out = mergeChangesetsIntoSave(tab([]), [
        entry([{ kind: 'add', element: n1, at: 0 }], { before: {}, after: { n: fp(n1) } }, 2),
        entry(
          [{ kind: 'update', element: n2 }],
          { before: { n: fp(n1) }, after: { n: fp(n2) } },
          3,
        ),
      ]);
      expect(out.tab.elements).toEqual([n2]);
    });

    it('is idempotent: a save already holding the after-images is unchanged', () => {
      const after = tab([box('a', 'new'), box('n')]);
      const out = mergeChangesetsIntoSave(after, [
        entry(
          [
            { kind: 'update', element: box('a', 'new') },
            { kind: 'add', element: box('n'), at: 1 },
            { kind: 'remove', id: 'gone' },
          ],
          {
            before: { a: fp(box('a', 'old')), gone: fp(box('gone')) },
            after: { a: fp(box('a', 'new')), n: fp(box('n')) },
          },
        ),
      ]);
      expect(out).toEqual({ tab: after, merged: 0, superseded: 0 });
    });
  });

  // A changeset from `before` to `after`, as the pipeline records it.
  function changeset(before: E[], after: E[]) {
    const ops = diffToElementOps(before, after);
    const touched = new Set(
      ops.flatMap((op) =>
        op.kind === 'remove' ? [op.id] : op.kind === 'reorder' ? [] : [op.element.id],
      ),
    );
    const map = (els: E[]) =>
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
}
