import { describe, expect, it } from 'vitest';
import { elementFingerprint, type Element, type ElementOp, type Tab } from '@livediagram/document';
import type { ChangesetFingerprints, MergeEntry } from '../db/changesets';
import { mergeChangesetsIntoSave } from './merge-on-save';

// docs/specs/024-agents/agent-changesets.md "The write path" step 8, each rule of the blueprint's
// table: a person's save built from a copy without a changeset keeps the changeset's version only
// where the save still holds the element as the changeset found it.

const box = (id: string, label = id, over: Partial<Element> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    label,
    ...over,
  }) as Element;
const fp = elementFingerprint;
const tab = (elements: Element[]): Tab => ({ id: 't1', name: 'T', elements });
const ids = (t: Tab) => t.elements.map((e) => e.id);

function entry(ops: ElementOp[], fingerprints: ChangesetFingerprints, rev = 2): MergeEntry {
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
    const saved = box('a', 'old', { commentThread: thread } as Partial<Element>);
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
    const reorder: ElementOp = { kind: 'reorder', ids: ['c', 'a', 'b'] };
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
      entry([{ kind: 'update', element: n2 }], { before: { n: fp(n1) }, after: { n: fp(n2) } }, 3),
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
