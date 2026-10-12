// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetSetup, statusColumn } from '@livediagram/items';
import { PlanColumnPopover } from './PlanColumnPopover';

// docs/specs/026-plan/plan-board.md "Column settings": Remove Column takes the column off this board and keeps
// the state; Delete Status deletes the state, its columns coming off every board.
const plan = { items: new Map(), statusNames: new Map() };
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
afterEach(cleanup);

const setup = {
  ...presetSetup('kanban'),
  columns: [statusColumn('todo', 'To Do'), statusColumn('done', 'Done')],
};

function open() {
  const fns = { onChange: vi.fn(), onDeleteStatus: vi.fn(), onClose: vi.fn() };
  render(
    <PlanColumnPopover
      getAnchor={() => document.body}
      setup={setup}
      column={setup.columns[0]!}
      onMoveCards={() => {}}
      onTrashCards={() => {}}
      {...fns}
    />,
  );
  return fns;
}

describe('removing a column', () => {
  it('Remove Column takes it off this board only', () => {
    const fns = open();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Column' }));
    expect(fns.onChange.mock.lastCall![0].columns.map((c: { status: string }) => c.status)).toEqual(
      ['done'],
    );
    expect(fns.onDeleteStatus).not.toHaveBeenCalled();
  });

  it('Delete Status, with no cards in it, deletes the state from every board at once', () => {
    const fns = open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Status' }));
    expect(fns.onChange).toHaveBeenCalled();
    expect(fns.onDeleteStatus).toHaveBeenCalledWith('todo');
  });
});

// docs/specs/026-plan/plan-board.md "A column's own settings": the toolbar on top.
describe('the column toolbar', () => {
  it('holds Move Left and Move Right at the start and Remove Column at the end', () => {
    open();
    const bar = screen.getByRole('toolbar', { name: 'Column actions' });
    const names = [...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Move Left', 'Move Right', 'Remove Column']);
    // Above the name.
    const name = screen.getByRole('textbox', { name: 'Column name' });
    expect(bar.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('turns Move Left off on the first column and moves it right', () => {
    const fns = open();
    expect(screen.getByRole('button', { name: 'Move Left' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Move Right' }));
    expect(fns.onChange.mock.lastCall![0].columns.map((c: { status: string }) => c.status)).toEqual(
      ['done', 'todo'],
    );
    expect(fns.onChange.mock.lastCall![1]).toBe('ColumnReordered');
  });
});

// docs/specs/026-plan/plan-board.md "A column's own settings": the popover goes with its column as it glides.
describe('the popover following its column', () => {
  it('settles under the cog’s new place once the column has moved', async () => {
    const cog = document.createElement('button');
    document.body.append(cog);
    let right = 300;
    cog.getBoundingClientRect = () =>
      ({ left: right - 24, right, top: 40, bottom: 64, width: 24, height: 24 }) as DOMRect;
    const props = {
      getAnchor: () => cog,
      onMoveCards: () => {},
      onTrashCards: () => {},
      onChange: vi.fn(),
      onClose: vi.fn(),
    };
    const { rerender } = render(
      <PlanColumnPopover {...props} setup={setup} column={setup.columns[0]!} />,
    );
    const box = () => screen.getByRole('dialog', { name: 'To Do column' });
    expect(box().style.left).toBe(`${300 - 288}px`);
    // Moved right: the board re-renders with the column second, and the cog has travelled.
    right = 600;
    const moved = { ...setup, columns: [setup.columns[1]!, setup.columns[0]!] };
    rerender(<PlanColumnPopover {...props} setup={moved} column={moved.columns[1]!} />);
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(box().style.left).toBe(`${600 - 288}px`);
    cog.remove();
  });
});
