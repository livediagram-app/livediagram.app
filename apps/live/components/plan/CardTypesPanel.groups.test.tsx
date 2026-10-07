// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '@livediagram/items';
import { CardTypesPanel } from './CardTypesPanel';

// docs/specs/026-plan/item-types.md "The Card Types panel": the built-in types apart from the document's own.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => vi.fn() }));

afterEach(cleanup);

function panel(types: unknown[], canEdit = true) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, {
    types,
    canEdit,
    items: new Map(),
    editType: vi.fn(),
    itemTypes: { catalogue: null, restoreBuiltIns: vi.fn() },
  });
  render(<CardTypesPanel popoverOpen onPopoverClose={() => {}} />);
}

describe('the Card Types panel’s groups', () => {
  it('lists the built-in types and the document’s own apart', () => {
    const person = { ...ITEM_TYPES[1]!, id: 'person', label: 'Person' };
    panel([...ITEM_TYPES, person]);
    const builtIn = screen.getByRole('list', { name: 'Built-In Types' });
    const own = screen.getByRole('list', { name: 'Your Types' });
    expect(within(builtIn).getAllByRole('listitem')).toHaveLength(ITEM_TYPES.length);
    expect(within(own).getAllByRole('listitem')).toHaveLength(1);
    expect(within(own).getByText('Person')).toBeTruthy();
  });

  it('says where added types will go before there are any', () => {
    panel([...ITEM_TYPES]);
    expect(screen.queryByRole('list', { name: 'Your Types' })).toBeNull();
    expect(screen.getByText('Types you add show here.')).toBeTruthy();
  });

  it('drops the built-in heading once every built-in type is deleted', () => {
    const person = { ...ITEM_TYPES[1]!, id: 'person', label: 'Person' };
    panel([person]);
    expect(screen.queryByText('Built-In Types')).toBeNull();
    expect(
      within(screen.getByRole('list', { name: 'Your Types' })).getByText('Person'),
    ).toBeTruthy();
  });
});
