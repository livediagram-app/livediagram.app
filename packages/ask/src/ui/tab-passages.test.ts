import { describe, expect, it } from 'vitest';
import { ASK_MAX_LABEL_CHARS } from '../limits';
import { tabPassages, type PassageTab } from './tab-passages';

// An editor's elements carry more than the walk names: any of it may be there.
const tab = (
  id: string,
  name: string,
  elements: (PassageTab['elements'][number] & Record<string, unknown>)[],
): PassageTab => ({
  id,
  name,
  elements,
});

const tabs = [
  tab('t1', 'Checkout Flow', [
    { id: 'a', type: 'shape', label: '  Payment Service  ' },
    { id: 'blank', type: 'shape', label: '   ' },
    { id: 'none', type: 'arrow' },
    { id: 'num', type: 'shape', label: 7 },
    {
      id: 'table',
      type: 'table',
      cells: [['Step', ' Owner '], 'not a row', ['', ''], [1, 'Platform']],
    },
    { id: 'note', type: 'sticky-note', label: 'First line\nSecond line' },
  ]),
  tab('t2', 'Ownership', [{ id: 'c', type: 'link_card', label: 'Docs', cells: 'x' }]),
];

describe('an item as passages', () => {
  it('makes a passage of each element that holds words, in tab then element order', () => {
    expect(tabPassages(tabs)).toEqual([
      {
        id: 't1:a',
        tabId: 't1',
        tabName: 'Checkout Flow',
        elementId: 'a',
        kind: 'Shape',
        title: 'Payment Service',
        text: 'Payment Service',
      },
      {
        id: 't1:table',
        tabId: 't1',
        tabName: 'Checkout Flow',
        elementId: 'table',
        kind: 'Table',
        title: 'Step | Owner',
        text: 'Step | Owner\nPlatform',
      },
      {
        id: 't1:note',
        tabId: 't1',
        tabName: 'Checkout Flow',
        elementId: 'note',
        kind: 'Sticky Note',
        title: 'First line',
        text: 'First line\nSecond line',
      },
      {
        id: 't2:c',
        tabId: 't2',
        tabName: 'Ownership',
        elementId: 'c',
        kind: 'Link Card',
        title: 'Docs',
        text: 'Docs',
      },
    ]);
    expect(tabPassages([])).toEqual([]);
  });

  it("reads the app's own kinds and words, each piece once", () => {
    const passages = tabPassages(
      [
        tab('t', 'T', [
          { id: 'a', type: 'shape', label: 'Title' },
          { id: 'b', type: 'shape' },
        ]),
      ],
      {
        kindOf: () => 'Board',
        textOf: (element) =>
          element.id === 'a' ? ['Title', ' Body ', null, undefined] : ['L'.repeat(500)],
      },
    );
    expect(passages[0]).toMatchObject({ kind: 'Board', title: 'Title', text: 'Title\nBody' });
    expect(passages[1]!.title).toHaveLength(ASK_MAX_LABEL_CHARS);
  });
});
