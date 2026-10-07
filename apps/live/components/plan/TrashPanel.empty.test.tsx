// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, TRASH_STATUS, type Item } from '@livediagram/items';
import { TrashPanel } from './TrashPanel';

// docs/specs/026-plan/items.md "Trash": Empty Trash, once confirmed, deletes them all and closes the panel.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => async () => true }));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
afterEach(cleanup);

const PERSON = { id: 'p', name: 'A', color: '#000' };
const card: Item = {
  id: 'item0001',
  type: 'task',
  key: 1,
  rank: 'a',
  fields: { title: 'Old', status: TRASH_STATUS },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
};

describe('emptying the Trash', () => {
  it('deletes every card and closes the panel', async () => {
    const emptyTrash = vi.fn();
    const onClose = vi.fn();
    Object.assign(plan, {
      items: new Map([[card.id, card]]),
      types: ITEM_TYPES,
      statusNames: new Map(),
      canEdit: true,
      emptyTrash,
      announce: vi.fn(),
    });
    render(<TrashPanel onPopoverClose={onClose} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Empty Trash/ }));
    });
    expect(emptyTrash).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
