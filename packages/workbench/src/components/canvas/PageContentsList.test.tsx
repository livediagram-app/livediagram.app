// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentsRowBase } from '../../lib/page-contents';
import { ContentsList, type ContentsListState } from './PageContentsList';

// docs/specs/007-editor/pages-mode.md "Contents": the list's pointer wiring and its pictures, driven
// with the state a Contents hook hands it, so every branch of the rows is reached on its own.
afterEach(cleanup);

const ROWS: ContentsRowBase[] = [
  { id: 'a', number: 1, name: 'A', line: 'Slide', locked: false, aspect: 1 },
  { id: 'b', number: 2, name: 'B', line: 'Slide', locked: false, aspect: 1 },
];

function state(over: Partial<ContentsListState<ContentsRowBase>> = {}) {
  const reorder = {
    beginDrag: vi.fn(),
    moveDrag: vi.fn(),
    endDrag: vi.fn(),
    caretBefore: (i: number) => i === 1,
    caretAfterLast: true,
    moving: true,
    draggingId: 'a',
  };
  const go = vi.fn();
  const contents = {
    pages: [],
    rows: ROWS,
    current: 'a',
    list: { current: null },
    registerRow: () => {},
    reorder,
    reorderable: true,
    go,
    onListKey: () => {},
    thumbs: new Map(),
    actionsFor: () => null,
    ...over,
  } as unknown as ContentsListState<ContentsRowBase>;
  return { contents, reorder, go };
}

describe('ContentsList', () => {
  it('drags a row by a mouse, its grip by a finger, and opens the page on a click anywhere on the row', () => {
    const { contents, reorder, go } = state();
    const { container } = render(<ContentsList contents={contents} variant="list" />);
    const rows = container.querySelectorAll('[role="listitem"]');
    // The row being dragged fades; the drop caret shows before row 2 and after the last.
    expect(rows[0]!.className).toContain('opacity-50');
    expect(rows[1]!.className).not.toContain('opacity-50');
    expect(container.querySelectorAll('[data-contents-grip]')).toHaveLength(2);
    fireEvent.pointerDown(rows[0]!, { pointerType: 'mouse' });
    expect(reorder.beginDrag).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(rows[0]!, { pointerType: 'touch' });
    expect(reorder.beginDrag).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(container.querySelector('[data-contents-grip]')!, {
      pointerType: 'touch',
    });
    expect(reorder.beginDrag).toHaveBeenCalledTimes(2);
    fireEvent.pointerDown(container.querySelector('[data-contents-grip]')!, {
      pointerType: 'mouse',
    });
    expect(reorder.beginDrag).toHaveBeenCalledTimes(3);
    fireEvent.click(rows[1]!);
    expect(go).toHaveBeenCalledWith(ROWS[1], expect.any(Number));
  });

  it('leaves the grip out of a list that cannot be reordered', () => {
    const { contents } = state({ reorderable: false });
    const { container } = render(<ContentsList contents={contents} variant="film" />);
    expect(container.querySelector('[data-contents-grip]')).toBeNull();
  });

  it('draws a picture from its markup, or from its parts, each set as markup', () => {
    const { contents } = state({
      thumbs: new Map([
        ['a', { markup: '<rect id="whole"/>', viewBox: '0 0 1 1' }],
        [
          'b',
          {
            markup: '',
            viewBox: '0 0 2 2',
            parts: [
              { key: 'p1', markup: '<rect id="part1"/>' },
              { key: 'p2', markup: '<rect id="part2"/>' },
            ],
          },
        ],
      ]),
    });
    const { container } = render(<ContentsList contents={contents} variant="film" />);
    expect(container.querySelector('#whole')).not.toBeNull();
    expect(container.querySelector('#part1')).not.toBeNull();
    expect(container.querySelector('#part2')).not.toBeNull();
  });
});
