// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TABLE_MARK_TEXT, type TableElement, type TablePatch } from '@livedocuments/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { TableView } from './TableView';

// Touch keeps the ⋯ triggers on screen without a hover (TableAxisTriggers).
vi.mock('@liveworkspace/workbench/lib/responsive', async (load) => ({
  ...(await load<object>()),
  isMobileViewportSync: () => true,
}));

const table = {
  id: 't',
  type: 'table',
  x: 0,
  y: 0,
  width: 200,
  height: 80,
  cells: [
    ['a', 'b'],
    ['c', 'd'],
  ],
} as TableElement;

// docs/specs/004-interface-design/menus.md: the column / row ⋯ menu is a command menu.
describe('TableView column and row menu', () => {
  it('opens as a menu of items, takes focus, and closes on Escape back to its trigger', async () => {
    render(
      <TableView
        element={table}
        isSelected
        readOnly={false}
        tabSummaries={[]}
        onCommitTable={vi.fn()}
      />,
    );
    const trigger = screen.getAllByRole('button', { name: 'Column options' })[0]!;
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    trigger.focus();
    act(() => {
      fireEvent.click(trigger);
    });
    const menu = await screen.findByRole('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual([
      'Insert Left',
      'Insert Right',
      'Move Left',
      'Move Right',
      'Delete Column',
      'Highlight Column',
    ]);
    // The first column cannot move left: still an item (the arrow keys reach it), marked disabled.
    expect(screen.getByRole('menuitem', { name: 'Move Left' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(menu.contains(document.activeElement)).toBe(true);
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

// docs/specs/009-elements/comparison-tables.md: the recommended column and the cell menu's marks.
describe('TableView comparison tables', () => {
  const show = (element: TableElement, opts: { readOnly?: boolean; cellsOnly?: boolean } = {}) => {
    const onCommitTable = vi.fn<(id: string, patch: TablePatch) => void>();
    const view = render(
      <EditorContext.Provider value={{ tabs: [], activeTab: { theme: 'ocean' } } as never}>
        <TableView
          element={element}
          isSelected
          readOnly={opts.readOnly ?? false}
          cellsOnly={opts.cellsOnly}
          tabSummaries={[]}
          onCommitTable={onCommitTable}
        />
      </EditorContext.Provider>,
    );
    return { onCommitTable, view };
  };
  const openColumnMenu = async (c: number) => {
    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Column options' })[c]!);
    });
    await screen.findByRole('menu');
  };

  it('highlights a column from its menu, and takes the highlight off again', async () => {
    const first = show(table);
    await openColumnMenu(1);
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Highlight Column' }));
    });
    expect(first.onCommitTable).toHaveBeenCalledWith('t', { highlightColumn: 1 });
    cleanup();
    const second = show({ ...table, highlightColumn: 1 });
    expect(second.view.container.querySelector('[data-table-highlight]')).not.toBeNull();
    await openColumnMenu(1);
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Remove Highlight' }));
    });
    expect(second.onCommitTable).toHaveBeenCalledWith('t', { highlightColumn: undefined });
  });

  it('carries the highlight when a column is inserted before it', async () => {
    const { onCommitTable } = show({ ...table, highlightColumn: 1 });
    await openColumnMenu(0);
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Insert Left' }));
    });
    expect(onCommitTable.mock.calls.at(-1)![1].highlightColumn).toBe(2);
  });

  it('draws a tick or a cross cell as a mark read as Yes or No', () => {
    show(
      {
        ...table,
        cells: [
          ['✓', 'b'],
          ['c', '✗'],
        ],
      },
      { readOnly: true },
    );
    expect(screen.getByRole('img', { name: 'Yes' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'No' })).toBeTruthy();
  });

  it("marks the selected cells from the cell menu's Marks row", () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const { onCommitTable } = show(table);
    const cell = screen.getAllByRole('cell')[0]!;
    act(() => {
      fireEvent.contextMenu(cell);
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Tick (Yes)' }));
    });
    expect(onCommitTable).toHaveBeenCalledWith('t', {
      cells: [
        [TABLE_MARK_TEXT.tick, 'b'],
        ['c', 'd'],
      ],
    });
    vi.unstubAllGlobals();
  });

  it('a Participant (cells only) and a Viewer get neither the column menu nor the cell menu', () => {
    for (const opts of [{ cellsOnly: true }, { readOnly: true }]) {
      show({ ...table, highlightColumn: 0 }, opts);
      expect(screen.queryAllByRole('button', { name: 'Column options' })).toEqual([]);
      act(() => {
        fireEvent.contextMenu(screen.getAllByRole('cell')[0]!);
      });
      expect(screen.queryByRole('button', { name: 'Tick (Yes)' })).toBeNull();
      cleanup();
    }
  });
});
