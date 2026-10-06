// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { ItemChildCards } from './ItemChildCards';

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
const STATUS_NAMES = new Map([['doing', 'In Progress']]);

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
    expect(screen.getByText('In Progress')).toBeTruthy();
    // A status no board names reads as itself.
    expect(screen.getByText('review')).toBeTruthy();
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
