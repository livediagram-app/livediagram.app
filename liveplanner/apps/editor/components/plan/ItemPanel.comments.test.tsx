// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { ItemPanel } from './ItemPanel';
import { CardThreadsProvider } from './threads/CardThreadsContext';
import { contextOf, fakeThreads, thread } from './threads/thread-test-kit';
import type { CardThreads as CardThreadsValue } from '@/hooks/plan/useCardThreads';

vi.mock('@/lib/api/item-history', () => ({ fetchItemHistory: () => Promise.resolve([]) }));

// docs/specs/026-plan/items.md "Comments": the card's threads end the item panel's Overview tab, and a type that
// stops offering comments keeps its threads stored, out of the panel. "History" "Where it shows": the Activity
// section follows the card's Comments, apart from them.

afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const card = (type = 'task'): Item => ({
  id: 'item-one',
  type,
  key: 1,
  rank: 'i',
  fields: {
    title: 'A card',
  },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function panel(
  item: Item,
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  withComments = true,
  scoped = false,
) {
  const noop = vi.fn();
  const fake = fakeThreads([
    thread('th-a', {
      title: 'Sam: First thoughts',
      cards: [{ projectId: 'plan-a', itemId: 'item-one', key: 1 }],
      comments: [
        {
          id: 'c1',
          text: 'First thoughts',
          createdAt: 0,
          authorName: 'Sam',
          authorColor: '#2563eb',
        },
      ],
    }),
  ]).threads;
  const threads = scoped
    ? ({
        ...fake,
        scope: { ownerId: 'o', projectId: 'plan-a', shareCode: null, tabId: null },
      } as unknown as CardThreadsValue)
    : fake;
  const panelTree = (
    <ItemPanel
      item={item}
      types={types}
      statuses={[]}
      people={[]}
      labels={[]}
      canEdit
      onSave={noop}
      onPatch={noop}
      onType={noop}
      onOpenItem={noop}
      onTrash={noop}
      onDuplicate={noop}
      onFlag={noop}
      onArchive={noop}
      onClose={noop}
      trail={[item]}
      statusNames={new Map()}
    />
  );
  render(
    withComments ? (
      <CardThreadsProvider value={contextOf(threads)}>{panelTree}</CardThreadsProvider>
    ) : (
      panelTree
    ),
  );
}

describe('the item panel’s comments', () => {
  it('ends the Overview tab with the card’s threads, each closed until opened', () => {
    panel(card());
    expect(screen.getByText('Comments')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Reply to “Sam: First thoughts”' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Sam: First thoughts/ }));
    expect(screen.getByText('First thoughts')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Reply to “Sam: First thoughts”' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Thread' })).toBeTruthy();
  });

  it('draws nothing for the field without a comments context', () => {
    panel(card(), ITEM_TYPES, false);
    expect(screen.queryByText('Sam: First thoughts')).toBeNull();
  });

  it('keeps a thread a type no longer offers out of the panel', () => {
    const plain: ItemTypeDef = { ...ITEM_TYPES[1], fields: ['title', 'status', 'description'] };
    panel(card(), [plain]);
    expect(screen.queryByText('Sam: First thoughts')).toBeNull();
    expect(screen.queryByText('Comments')).toBeNull();
  });
});

describe('the item panel’s activity', () => {
  const sectionOf = (name: string) => screen.getByText(name).closest('section')!;

  it('follows the Comments section, its own section, closed', () => {
    panel(card(), ITEM_TYPES, true, true);
    const activity = screen.getByRole('button', { name: 'Activity' });
    expect(activity.getAttribute('aria-expanded')).toBe('false');
    const comments = sectionOf('Comments');
    expect(comments.contains(activity)).toBe(false);
    expect(comments.nextElementSibling).toBe(activity.closest('section'));
    expect(document.querySelectorAll('[data-card-activity]')).toHaveLength(1);
  });

  it('ends the first tab when the type offers no comments', () => {
    const plain: ItemTypeDef = { ...ITEM_TYPES[1], fields: ['title', 'status', 'description'] };
    panel(card(), [plain], true, true);
    const activity = screen.getByRole('button', { name: 'Activity' }).closest('section')!;
    expect(activity.nextElementSibling).toBeNull();
  });

  it('draws no Activity section without a plan to read from', () => {
    panel(card());
    expect(screen.queryByRole('button', { name: 'Activity' })).toBeNull();
  });
});
