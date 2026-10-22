// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoveColumnPopover } from './RemoveColumnPopover';

// docs/specs/026-plan/plan-board.md "The board set-up": removing a column that holds cards asks where they go.
afterEach(cleanup);

const column = { id: 'todo', status: 'todo', name: 'To Do' };
const others = [
  { id: 'doing', status: 'doing', name: 'Doing' },
  { id: 'done', status: 'done', name: 'Done' },
];

function draw(otherColumns = others) {
  const anchor = document.createElement('button');
  document.body.append(anchor);
  const onRemove = vi.fn();
  const onCancel = vi.fn();
  render(
    <RemoveColumnPopover
      anchor={anchor}
      column={column}
      others={otherColumns}
      cardCount={3}
      onCancel={onCancel}
      onRemove={onRemove}
    />,
  );
  return { onRemove, onCancel };
}

describe('removing a column with cards', () => {
  it('says where the cards are and moves them to the picked column by default', () => {
    const { onRemove } = draw();
    expect(screen.getByText(/Its 3 cards are in To Do, on every board that shows it/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Move the cards to'), { target: { value: 'done' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Status' }));
    expect(onRemove).toHaveBeenCalledWith({ kind: 'move', to: 'done' });
  });

  it('moves them to the Trash when that is picked', () => {
    const { onRemove } = draw();
    fireEvent.click(screen.getByRole('radio', { name: 'Move to the Trash' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Status' }));
    expect(onRemove).toHaveBeenCalledWith({ kind: 'trash' });
  });

  it('cancels without removing', () => {
    const { onRemove, onCancel } = draw();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });
});
