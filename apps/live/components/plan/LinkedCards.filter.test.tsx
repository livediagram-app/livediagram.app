// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { FilteredCards } from './LinkedCards';

// docs/specs/026-plan/item-types.md "Card fields": a card's linked cards, filtered by Card Type and State.
afterEach(cleanup);

const PERSON = { id: 'p', name: 'A', color: '#000' };
let n = 0;
const card = (type: string, status: string | undefined, title: string): Item => ({
  id: `item000${++n}`,
  type,
  key: n,
  rank: 'a',
  fields: { title, ...(status ? { status } : {}) },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const cards = [
  card('task', 'todo', 'Write'),
  card('task', 'done', 'Ship'),
  card('note', undefined, 'Think'),
];
const names = new Map([
  ['todo', 'To Do'],
  ['done', 'Done'],
]);

function draw(list = cards) {
  render(
    <FilteredCards
      cards={list}
      types={ITEM_TYPES}
      statusNames={names}
      onOpen={vi.fn()}
      label="Linked as Parent"
    />,
  );
}
const rows = () => screen.queryAllByRole('listitem').map((li) => li.textContent);

describe('filtering linked cards', () => {
  it('offers only the types and states the list holds, and narrows by each', () => {
    draw();
    const typeMenu = screen.getByLabelText('Linked as Parent: Card Type') as HTMLSelectElement;
    expect([...typeMenu.options].map((o) => o.textContent)).toEqual([
      'All card types',
      'Task',
      'Note',
    ]);
    const stateMenu = screen.getByLabelText('Linked as Parent: State') as HTMLSelectElement;
    expect([...stateMenu.options].map((o) => o.textContent)).toEqual([
      'All states',
      'To Do',
      'Done',
      'No status',
    ]);
    fireEvent.change(typeMenu, { target: { value: 'task' } });
    expect(rows()).toHaveLength(2);
    expect(screen.getByText('2 of 3')).toBeTruthy();
    fireEvent.change(stateMenu, { target: { value: 'done' } });
    expect(rows()).toHaveLength(1);
  });

  it('says when nothing matches, and Clear Filters shows them all', () => {
    draw();
    fireEvent.change(screen.getByLabelText('Linked as Parent: Card Type'), {
      target: { value: 'note' },
    });
    fireEvent.change(screen.getByLabelText('Linked as Parent: State'), {
      target: { value: 'done' },
    });
    expect(screen.getByText('No cards match.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(rows()).toHaveLength(3);
  });

  it('shows no filters for a list with one type and one state', () => {
    draw([card('task', 'todo', 'A'), card('task', 'todo', 'B')]);
    expect(screen.queryByLabelText('Linked as Parent: Card Type')).toBeNull();
  });
});
