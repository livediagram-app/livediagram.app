// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '@livediagram/items';
import { NewCardPanel } from './NewCardPanel';

const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
// The docked panel's chrome is MovablePanel's own (tested there): here, only what it holds.
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
afterEach(cleanup);

// docs/specs/026-plan/items.md "New Card".
describe('the New Card panel', () => {
  const setPlan = (over: Record<string, unknown>) => {
    for (const k of Object.keys(plan)) delete plan[k];
    Object.assign(
      plan,
      {
        canEdit: true,
        types: ITEM_TYPES,
        statusNames: new Map([
          ['backlog', 'Backlog'],
          ['todo', 'To Do'],
        ]),
        addItem: vi.fn(),
        openNewItem: vi.fn(),
        editType: vi.fn(),
      },
      over,
    );
  };

  it('offers every card type, makes the one picked off any board, closes and opens it', () => {
    setPlan({});
    const onClose = vi.fn();
    render(<NewCardPanel onPopoverClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    const add = plan['addItem'] as ReturnType<typeof vi.fn>;
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task', fields: { title: 'New task' }, after: null }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(plan['openNewItem']).toHaveBeenCalledWith(add.mock.calls[0]![0].id);
  });

  it('offers no Create Card Type (types are made from Edit Cards or a board)', () => {
    setPlan({});
    render(<NewCardPanel onPopoverClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add New Card Type' })).toBeNull();
  });

  it('is not there for someone who may only view', () => {
    setPlan({ canEdit: false });
    render(<NewCardPanel onPopoverClose={vi.fn()} />);
    expect(screen.queryByRole('region', { name: 'New Card' })).toBeNull();
  });
});
