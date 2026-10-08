// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { ItemChildCards, LinkedCardGroup } from './ItemChildCards';

// docs/specs/026-plan/plan-board.md "Open an item", Child Cards.

afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam Lee', color: '#2563eb' };
const item = (id: string, key: number, type: string, fields: Item['fields'] = {}): Item => ({
  id,
  type,
  key,
  rank: 'i',
  fields: { title: `Card ${key}`, ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const STATUS_NAMES = new Map([
  ['doing', 'In Progress'],
  ['review', 'Review'],
]);

function draw(parent: Item, childCards: Item[], onOpen = vi.fn()) {
  render(
    <ItemChildCards
      item={parent}
      childCards={childCards}
      types={ITEM_TYPES}
      statusNames={STATUS_NAMES}
      onOpen={onOpen}
    />,
  );
  return onOpen;
}

describe('ItemChildCards', () => {
  it('lists each child with its status and opens it', () => {
    const onOpen = draw(item('p', 1, 'project'), [
      item('c2', 2, 'task', { status: 'doing', assignee: PERSON }),
      item('c3', 3, 'task', { status: 'review', archived: true }),
    ]);
    expect(screen.getByRole('heading', { name: /Child Cards/ }).textContent).toContain('2');
    expect(within(screen.getByRole('list')).getByText('In Progress')).toBeTruthy();
    // A status no board names reads as itself.
    expect(within(screen.getByRole('list')).getByText('Review')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open #2 Card 2, In Progress' }));
    expect(onOpen).toHaveBeenCalledWith('c2');
  });

  it('invites children on an empty Project', () => {
    draw(item('p', 1, 'project'), []);
    expect(screen.getByText('No cards sit under this project yet.')).toBeTruthy();
  });

  it('shows nothing on another type without children', () => {
    draw(item('t', 1, 'task'), []);
    expect(screen.queryByText('Child Cards')).toBeNull();
  });
});

// docs/specs/026-plan/item-types.md "Card fields": a section per Card field linking here.
describe('LinkedCardGroup', () => {
  const group = (cards: Item[]) => ({
    fieldId: 'f-owner',
    label: 'Owner',
    fromTypes: ['task'],
    cards,
  });

  it('lists the cards linking here as the field, opens one, and makes a new one linked', () => {
    const onOpen = vi.fn();
    const onAdd = vi.fn();
    render(
      <LinkedCardGroup
        group={group([item('o1', 4, 'task', { status: 'doing' })])}
        types={ITEM_TYPES}
        statusNames={STATUS_NAMES}
        canAdd
        onOpen={onOpen}
        onAdd={onAdd}
      />,
    );
    expect(screen.getByRole('heading', { name: /Linked as Owner/ }).textContent).toContain('1');
    fireEvent.click(screen.getByRole('button', { name: 'Open #4 Card 4, In Progress' }));
    expect(onOpen).toHaveBeenCalledWith('o1');
    fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(onAdd).toHaveBeenCalledWith('task');
  });

  it('says so when nothing links here yet, and offers no New to a viewer', () => {
    render(
      <LinkedCardGroup
        group={group([])}
        types={ITEM_TYPES}
        statusNames={STATUS_NAMES}
        canAdd={false}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText('No cards link here as Owner yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New Task' })).toBeNull();
  });
});
