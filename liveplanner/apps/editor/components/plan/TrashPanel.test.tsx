// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, TRASH_STATUS, TRASHED_FROM_FIELD, type Item } from '@liveplanner/items';
import { TrashPanel } from './TrashPanel';

// docs/specs/026-plan/items.md "Trash": the popover's rows, its actions and its small empty state.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
const panelProps = vi.fn();
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children, ...props }: { children: ReactNode; popoverWidth?: string }) => {
    panelProps(props);
    return <div>{children}</div>;
  },
}));
vi.mock('@liveworkspace/workbench/components/primitives/ConfirmPopover', () => ({
  ConfirmPopover: ({ message, onConfirm }: { message: string; onConfirm: () => void }) => (
    <div role="dialog" aria-label={message}>
      <button type="button" onClick={onConfirm}>
        Confirm
      </button>
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  panelProps.mockClear();
});

const YOU = { id: 'p-you', name: 'You Person', color: '#000' };
const ANA = { id: 'p-ana', name: 'Ana', color: '#f00' };
function card(key: number, title: string, updatedAt: number, by = YOU, from?: string): Item {
  return {
    id: `item000${key}`,
    type: 'task',
    key,
    rank: 'a',
    fields: {
      title,
      status: TRASH_STATUS,
      ...(from ? { [TRASHED_FROM_FIELD]: from } : {}),
    },
    rev: 1,
    createdAt: 0,
    updatedAt,
    createdBy: by,
    updatedBy: by,
  };
}

function setPlan(items: Item[], canEdit = true) {
  const restoreItem = vi.fn();
  const deleteItem = vi.fn();
  Object.assign(plan, {
    items: new Map(items.map((it) => [it.id, it])),
    types: ITEM_TYPES,
    statusNames: new Map([['doing', 'Doing']]),
    canEdit,
    self: YOU,
    restoreItem,
    deleteItem,
    emptyTrash: vi.fn(),
    announce: vi.fn(),
  });
  return { restoreItem, deleteItem };
}

describe('the Trash popover', () => {
  it('is small when empty: the small empty state, no count, no Empty Trash', () => {
    setPlan([]);
    const { container } = render(<TrashPanel onPopoverClose={() => {}} />);
    expect(screen.getByText('No cards in the Trash')).toBeTruthy();
    expect(container.querySelector('[data-empty-state="small"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Empty Trash/ })).toBeNull();
    expect(panelProps).toHaveBeenLastCalledWith(expect.objectContaining({ popoverWidth: 'w-64' }));
  });

  it('lists cards newest first with a count, their type, where from, when and by whom', () => {
    const now = Date.now();
    setPlan([card(1, 'Older', now - 3 * 3600_000, ANA), card(2, '', now, YOU, 'doing')]);
    render(<TrashPanel onPopoverClose={() => {}} />);
    expect(panelProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ popoverWidth: 'w-[22rem]' }),
    );
    expect(screen.getByText('cards')).toBeTruthy();
    const rows = within(screen.getByRole('list', { name: 'Cards in the Trash' })).getAllByRole(
      'listitem',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Untitled');
    expect(rows[0]?.textContent).toMatch(/#2 · from DoingTrashed just now by you/);
    expect(rows[1]?.textContent).toContain('Older');
    expect(rows[1]?.textContent).toMatch(/#1Trashed 3 hours ago by Ana/);
  });

  it('restores to the status it came from, and deletes forever only after asking', () => {
    const { restoreItem, deleteItem } = setPlan([card(2, 'Launch', 0, YOU, 'doing')]);
    render(<TrashPanel onPopoverClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore #2 to Doing' }));
    expect(restoreItem).toHaveBeenCalledWith('item0002');
    fireEvent.click(screen.getByRole('button', { name: 'Delete #2 Forever' }));
    expect(deleteItem).not.toHaveBeenCalled();
    const ask = screen.getByRole('dialog', { name: /Delete #2 for good\?/ });
    fireEvent.click(within(ask).getByRole('button', { name: 'Confirm' }));
    expect(deleteItem).toHaveBeenCalledWith('item0002');
  });

  it('shows a viewer the rows without Restore, Delete Forever or Empty Trash', () => {
    setPlan([card(1, 'Launch', 0)], false);
    render(<TrashPanel onPopoverClose={() => {}} />);
    expect(screen.getByText('Launch')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
