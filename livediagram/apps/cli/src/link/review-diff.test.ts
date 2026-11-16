import { describe, expect, it } from 'vitest';
import { arrow, box, pullFileOf, tab } from '../testing/review-fixtures';
import { reviewDocuments, type ReviewFile } from './review-diff';

// What a change did to the mirror files (docs/specs/027-repositories/blueprints/link-review.md step 4, RL45).

const file = (path: string, ...args: Parameters<typeof pullFileOf>): ReviewFile => ({
  path,
  file: pullFileOf(...args),
});

const flowBefore = tab('flow', 'Flow', [
  box('a', 'Cart', 0),
  box('b', 'Pay', 200),
  arrow('x', 'a', 'b'),
]);
const flowAfter = tab('flow', 'Flow', [
  box('a', 'Cart', 0),
  box('b', 'Pay now', 200),
  box('c', 'Done', 400),
]);
const same = tab('same', 'Same', [box('s', 'S', 0)]);

describe('reviewDocuments', () => {
  it('splits a changed tab into added, changed and removed elements, and skips an equal tab', () => {
    const { documents, skipped } = reviewDocuments(
      [file('d.livediagram.json', 'd1', 'Shop', [flowBefore, same])],
      [file('d.livediagram.json', 'd1', 'Shop', [flowAfter, same])],
    );
    expect(skipped).toEqual([]);
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: 'd1',
      name: 'Shop',
      status: 'changed',
      path: 'd.livediagram.json',
    });
    expect(documents[0]!.tabs).toEqual([
      {
        tabId: 'flow',
        name: 'Flow',
        status: 'changed',
        before: flowBefore,
        after: flowAfter,
        added: ['c'],
        changed: ['b'],
        removed: ['x'],
      },
    ]);
  });

  it('orders head’s tabs, then the removed ones; a settings change alone is a change with no elements', () => {
    const themed = { ...same, theme: 'dark' } as typeof same;
    const added = tab('new', 'New', [box('n', 'N', 0)]);
    const { documents } = reviewDocuments(
      [file('d.livediagram.json', 'd1', 'Shop', [flowBefore, same])],
      [file('d.livediagram.json', 'd1', 'Shop', [added, themed])],
    );
    expect(
      documents[0]!.tabs.map((t) => [t.tabId, t.status, t.added, t.changed, t.removed]),
    ).toEqual([
      ['new', 'added', ['n'], [], []],
      ['same', 'changed', [], [], []],
      ['flow', 'removed', [], [], ['a', 'b', 'x']],
    ]);
  });

  it('pairs a moved file by its document, and keeps added and removed documents', () => {
    const { documents } = reviewDocuments(
      [
        file('old/d.livediagram.json', 'd1', 'Shop', [flowBefore]),
        file('gone.livediagram.json', 'd2', 'Gone', [same]),
      ],
      [
        file('new/d.livediagram.json', 'd1', 'Shop', [flowAfter]),
        file('add.livediagram.json', 'd3', 'Add', [same]),
      ],
    );
    expect(documents.map((d) => [d.id, d.status, d.path])).toEqual([
      ['d1', 'changed', 'new/d.livediagram.json'],
      ['d3', 'added', 'add.livediagram.json'],
      ['d2', 'removed', 'gone.livediagram.json'],
    ]);
  });

  it('drops a document with no changed tab, and skips a second file claiming one document', () => {
    const { documents, skipped } = reviewDocuments(
      [file('a.livediagram.json', 'd1', 'Shop', [same])],
      [
        file('a.livediagram.json', 'd1', 'Shop', [same]),
        file('b.livediagram.json', 'd1', 'Shop', [flowAfter]),
      ],
    );
    expect(documents).toEqual([]);
    expect(skipped).toEqual([
      { path: 'b.livediagram.json', reason: 'same document as a.livediagram.json' },
    ]);
  });
});
