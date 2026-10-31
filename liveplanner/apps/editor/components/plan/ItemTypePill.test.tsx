// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, typeIn, type BoardStatusTypes, type Item } from '@liveplanner/items';
import { ItemTypePill } from './ItemPanelHeaderParts';
import { hasTypeChoice, typeChoices } from './type-choices';

// docs/specs/026-plan/plan-board.md "The types it offers" and "One type to offer is no choice".
afterEach(cleanup);

const TASK = typeIn(ITEM_TYPES, 'task');
const card = (type: string, status?: string): Pick<Item, 'type' | 'fields'> => ({
  type,
  fields: status ? { status } : {},
});
const ids = (list: readonly { id: string }[]) => list.map((t) => t.id);

describe('typeChoices', () => {
  const boards: BoardStatusTypes = new Map<string, 'all' | ReadonlySet<string>>([
    ['todo', new Set(['task'])],
    ['doing', new Set(['task', 'idea'])],
    ['open', 'all'],
  ]);

  it('offers the types the boards naming the card’s status take, its own always among them', () => {
    expect(ids(typeChoices(ITEM_TYPES, boards, card('task', 'todo')))).toEqual(['task']);
    expect(ids(typeChoices(ITEM_TYPES, boards, card('task', 'doing')))).toEqual(
      ITEM_TYPES.filter((t) => t.id === 'task' || t.id === 'idea').map((t) => t.id),
    );
    // A Note on a board taking Tasks only: its own type stays, so it can still switch.
    expect(ids(typeChoices(ITEM_TYPES, boards, card('note', 'todo'))).sort()).toEqual([
      'note',
      'task',
    ]);
  });

  it('offers the whole catalogue for a board taking every type, a status no board names, or none', () => {
    for (const c of [card('task', 'open'), card('task', 'elsewhere'), card('task')])
      expect(typeChoices(ITEM_TYPES, boards, c)).toBe(ITEM_TYPES);
  });

  it('has a choice only when another type than the card’s own is offered', () => {
    expect(hasTypeChoice([TASK], 'task')).toBe(false);
    expect(hasTypeChoice([], 'task')).toBe(false);
    expect(hasTypeChoice(ITEM_TYPES, 'task')).toBe(true);
  });
});

describe('ItemTypePill', () => {
  const pill = (types: readonly (typeof TASK)[], canEdit = true) => (
    <ItemTypePill type={TASK} value="task" types={types} canEdit={canEdit} onType={vi.fn()} />
  );

  it('is a plain label, glyph and name, with one type to offer, and a picker with several, live', () => {
    const { rerender } = render(pill([TASK]));
    expect(screen.queryByRole('combobox', { name: 'Card Type' })).toBeNull();
    expect(screen.getByText(TASK.label)).toBeTruthy();
    // A type added to the board: the picker comes back in place.
    rerender(pill(ITEM_TYPES));
    const picker = screen.getByRole('combobox', { name: 'Card Type' }) as HTMLSelectElement;
    expect(picker.options).toHaveLength(ITEM_TYPES.length);
    // And goes again when the other types go.
    rerender(pill([TASK]));
    expect(screen.queryByRole('combobox', { name: 'Card Type' })).toBeNull();
  });

  it('is a label for someone who may not edit, however many types there are', () => {
    render(pill(ITEM_TYPES, false));
    expect(screen.queryByRole('combobox', { name: 'Card Type' })).toBeNull();
    expect(screen.getByText(TASK.label)).toBeTruthy();
  });

  it('switches the card’s type from the picker', () => {
    const onType = vi.fn();
    render(<ItemTypePill type={TASK} value="task" types={ITEM_TYPES} canEdit onType={onType} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Card Type' }), {
      target: { value: 'idea' },
    });
    expect(onType).toHaveBeenCalledWith('idea');
  });
});
