// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, READY_MADE_CARD_TYPES } from '@livediagram/items';
import { CardTypesPanel, addDefaultTypesMessage } from './CardTypesPanel';

// docs/specs/026-plan/item-types.md "The Card Types panel": one list, no type set apart; Add Default Types while one
// of the five is missing.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

function panel(types: unknown[], canEdit = true) {
  for (const key of Object.keys(plan)) delete plan[key];
  const addDefaultTypes = vi.fn();
  Object.assign(plan, {
    types,
    canEdit,
    items: new Map(),
    editType: vi.fn(),
    itemTypes: { catalogue: null, addDefaultTypes },
  });
  render(<CardTypesPanel popoverOpen onPopoverClose={() => {}} />);
  return addDefaultTypes;
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

  it('offers Add Default Types only while one of the five is missing', () => {
    panel([...ITEM_TYPES]);
    expect(screen.queryByRole('button', { name: 'Add Default Types' })).toBeNull();
    cleanup();
    panel([role]);
    expect(screen.getByRole('button', { name: 'Add Default Types' })).toBeTruthy();
  });

  it('asks first, naming the types it will add, and adds them only on Add Types', () => {
    const add = panel([role, ...ITEM_TYPES.filter((t) => t.id === 'task' || t.id === 'action')]);
    const button = screen.getByRole('button', { name: 'Add Default Types' });
    fireEvent.click(button);
    expect(add).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText(
        'Add Project, Note and Idea to this document’s card types? They go after the ones you have, and nothing you have changes.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Types' }));
    expect(add).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Add Types' })).toBeNull();
  });

  it('adds nothing on Cancel or Escape, and gives the button its focus back', () => {
    const add = panel([role]);
    const button = screen.getByRole('button', { name: 'Add Default Types' });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Add Types' })).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Add Types' })).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('names one type, two, or more, as people list them', () => {
    expect(addDefaultTypesMessage(['Project'])).toMatch(/^Add Project to this/);
    expect(addDefaultTypesMessage(['Note', 'Idea'])).toMatch(/^Add Note and Idea to/);
    expect(addDefaultTypesMessage(['Project', 'Task', 'Note'])).toMatch(
      /^Add Project, Task and Note to/,
    );
  });

  it('shows no edit controls to someone who may only view', () => {
    panel([role], false);
    expect(screen.queryByRole('button', { name: 'Add Default Types' })).toBeNull();
  });
});
