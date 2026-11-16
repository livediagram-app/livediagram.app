// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, READY_MADE_CARD_TYPES } from '@liveplanner/items';
import { CardTypesPanel } from './CardTypesPanel';

// docs/specs/026-plan/item-types.md "The Card Types panel": one list, no type set apart, and no Add Default Types button.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

function panel(types: unknown[], canEdit = true) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, {
    types,
    canEdit,
    items: new Map(),
    editType: vi.fn(),
    itemTypes: { catalogue: null },
  });
  render(<CardTypesPanel popoverOpen onPopoverClose={() => {}} />);
}

const role = READY_MADE_CARD_TYPES.find((t) => t.id === 'role')!;

describe('the Card Types panel’s list', () => {
  it('lists every type in one list, in the catalogue’s order, with no headings', () => {
    panel([role, ...ITEM_TYPES]);
    const list = screen.getByRole('list', { name: 'Card Types' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(ITEM_TYPES.length + 1);
    expect(within(rows[0]!).getByText('Role')).toBeTruthy();
    expect(screen.queryByText('Built-In Types')).toBeNull();
    expect(screen.queryByText('Your Types')).toBeNull();
  });

  it('never offers Add Default Types, whatever the plan holds', () => {
    panel([...ITEM_TYPES]);
    expect(screen.queryByRole('button', { name: 'Add Default Types' })).toBeNull();
    cleanup();
    panel([role]);
    expect(screen.queryByRole('button', { name: 'Add Default Types' })).toBeNull();
    expect(screen.getByRole('button', { name: /Add Card Type|Add Type/ })).toBeTruthy();
    cleanup();
    panel([]);
    expect(screen.queryByRole('button', { name: 'Add Default Types' })).toBeNull();
    expect(
      screen.getByText('Add a card type of your own, or add a board that brings its types.'),
    ).toBeTruthy();
  });

  it('shows no edit controls to someone who may only view', () => {
    panel([role], false);
    expect(screen.queryByRole('button', { name: 'Add Default Types' })).toBeNull();
  });
});
