// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
