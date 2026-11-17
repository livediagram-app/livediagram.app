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

// Work Tracker 945: each row is memoised, compared by its page's fields, so a typing commit (rows rebuilt equal but
// for the card being written), a picture's settle and a menu opening render only the rows they change.
describe('ContentsList rows', () => {
  const many = (n: number, over: Partial<ContentsRowBase> = {}, at = -1): ContentsRowBase[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      number: i + 1,
      name: `Card ${i + 1}`,
      line: 'Flashcard',
      locked: false,
      aspect: 5 / 3,
      ...(i === at ? over : {}),
    }));
  const thumbOf = (id: string, markup = `<rect id="${id}-pic"/>`) => ({
    markup,
    viewBox: '0 0 5 3',
  });

  function setup(n = 100) {
    const drawn: string[] = [];
    // The badges run once per row drawn: the count of rows rendered.
    const badges = (row: ContentsRowBase) => {
      drawn.push(row.id);
      return null;
    };
    const thumbs = new Map(many(n).map((r) => [r.id, thumbOf(r.id)]));
    const remove = vi.fn<(id: string) => void>();
    const edit = (
      rows: ContentsRowBase[],
      over: Partial<ContentsListState<ContentsRowBase>> = {},
    ) =>
      state({
        rows,
        thumbs,
        reorder: {
          beginDrag: vi.fn(),
          moveDrag: vi.fn(),
          endDrag: vi.fn(),
          caretBefore: () => false,
          caretAfterLast: false,
          moving: false,
          draggingId: null,
        } as unknown as ContentsListState<ContentsRowBase>['reorder'],
        // A new function on every render, as the hook makes it.
        actionsFor: (row) => ({
          groups: [],
          ...(row.locked ? {} : { remove: () => remove(row.id) }),
        }),
        ...over,
      }).contents;
    return { drawn, badges, thumbs, remove, edit };
  }

  it('renders only the row being written in on a typing commit, and shows its new words', () => {
    const { drawn, badges, edit } = setup();
    const { rerender, container } = render(
      <ContentsList contents={edit(many(100))} variant="film" badges={badges} />,
    );
    expect(drawn).toHaveLength(100);
    drawn.length = 0;
    // The editor rebuilds every row object on a commit; only card 51's name changed.
    rerender(
      <ContentsList
        contents={edit(many(100, { name: 'Card 51 typed' }, 50))}
        variant="film"
        badges={badges}
      />,
    );
    expect(drawn).toEqual(['p50']);
    expect(container.querySelector('[data-page-row="p50"]')?.getAttribute('aria-label')).toBe(
      'Card 51 typed',
    );
  });

  it('redraws a row whose picture settled, and only it, with the new picture', () => {
    const { drawn, badges, thumbs, edit } = setup();
    const rows = many(100);
    const { rerender, container } = render(
      <ContentsList contents={edit(rows)} variant="list" badges={badges} />,
    );
    drawn.length = 0;
    thumbs.set('p7', thumbOf('p7', '<rect id="p7-new"/>'));
    rerender(<ContentsList contents={edit(rows)} variant="list" badges={badges} />);
    expect(drawn).toEqual(['p7']);
    expect(container.querySelector('#p7-new')).not.toBeNull();
    expect(container.querySelector('#p7-pic')).toBeNull();
  });

  it('redraws the rows a here or a lock changes', () => {
    const { drawn, badges, edit } = setup(5);
    const rows = many(5);
    const { rerender, container } = render(
      <ContentsList contents={edit(rows)} variant="film" badges={badges} />,
    );
    drawn.length = 0;
    rerender(
      <ContentsList contents={edit(rows, { current: 'p2' })} variant="film" badges={badges} />,
    );
    expect(drawn).toEqual(['p2']);
    drawn.length = 0;
    const locked = many(5, { locked: true }, 3);
    rerender(
      <ContentsList contents={edit(locked, { current: 'p2' })} variant="film" badges={badges} />,
    );
    expect(drawn).toEqual(['p3']);
    // A locked page has no Delete.
    expect(container.querySelector('[aria-label="Delete Card 4"]')).toBeNull();
    expect(container.querySelector('[aria-label="Delete Card 3"]')).not.toBeNull();
  });

  it("runs the newest actions from a row that didn't render", () => {
    const { remove, edit } = setup(3);
    const rows = many(3);
    const first = vi.fn();
    const { rerender, container } = render(
      <ContentsList
        contents={edit(rows, { actionsFor: () => ({ groups: [], remove: first }) })}
        variant="film"
      />,
    );
    // The list renders again with new actions; the rows, unchanged, don't.
    rerender(<ContentsList contents={edit(rows)} variant="film" />);
    fireEvent.click(container.querySelector('[aria-label="Delete Card 2"]')!);
    expect(first).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('p1');
  });

  it("opens a row's menu from a right-click, and none for a reader", () => {
    const { edit } = setup(2);
    const rows = many(2);
    const editor = render(<ContentsList contents={edit(rows)} variant="list" />);
    fireEvent.contextMenu(editor.container.querySelectorAll('[role="listitem"]')[1]!);
    expect(
      document
        .querySelector('[aria-label="More Actions for Card 2"]')
        ?.getAttribute('aria-expanded'),
    ).toBe('true');
    cleanup();
    const reader = render(
      <ContentsList
        contents={edit(rows, { actionsFor: () => null, reorderable: false })}
        variant="list"
      />,
    );
    fireEvent.contextMenu(reader.container.querySelectorAll('[role="listitem"]')[1]!);
    expect(document.querySelector('[aria-label^="More Actions"]')).toBeNull();
  });
});
