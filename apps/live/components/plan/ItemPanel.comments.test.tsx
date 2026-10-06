// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@livediagram/items';
import { ItemPanel } from './ItemPanel';

// docs/specs/026-plan/items.md "Comments": the thread ends the item panel's Overview tab, and a type that stops
// offering comments keeps the thread stored, out of the panel.

afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const card = (type = 'task'): Item => ({
  id: 'item-one',
  type,
  key: 1,
  rank: 'i',
  fields: {
    title: 'A card',
    comments: {
      comments: [
        {
          id: 'c1',
          text: 'First thoughts',
          createdAt: 0,
          authorName: 'Sam',
          authorColor: '#2563eb',
        },
      ],
      resolved: false,
    } as never,
  },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function panel(item: Item, types: readonly ItemTypeDef[] = ITEM_TYPES, withComments = true) {
  const noop = vi.fn();
  render(
    <ItemPanel
      item={item}
      types={types}
      statuses={[]}
      projects={[]}
      people={[]}
      labels={[]}
      canEdit
      onSave={noop}
      onPatch={noop}
      onType={noop}
      onOpenItem={noop}
      onDelete={noop}
      onDuplicate={noop}
      onFlag={noop}
      onArchive={noop}
      onClose={noop}
      {...(withComments
        ? { comments: { canComment: true, selfId: 'owner-me', onComment: noop } }
        : {})}
    />,
  );
}

describe('the item panel’s comments', () => {
  it('ends the Overview tab with the thread and its composer', () => {
    panel(card());
    expect(screen.getByText('Comments')).toBeTruthy();
    expect(screen.getByText('First thoughts')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Add a comment' })).toBeTruthy();
  });

  it('draws nothing for the field without a comments context', () => {
    panel(card(), ITEM_TYPES, false);
    expect(screen.queryByText('First thoughts')).toBeNull();
  });

  it('keeps a thread a type no longer offers out of the panel', () => {
    const plain: ItemTypeDef = { ...ITEM_TYPES[1], fields: ['title', 'status', 'description'] };
    panel(card(), [plain]);
    expect(screen.queryByText('First thoughts')).toBeNull();
    expect(screen.queryByText('Comments')).toBeNull();
  });
});
