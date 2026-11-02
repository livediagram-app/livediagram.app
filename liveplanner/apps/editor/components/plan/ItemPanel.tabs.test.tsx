// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { ItemPanel } from './ItemPanel';
import { CardThreadsProvider } from './threads/CardThreadsContext';
import { contextOf, fakeThreads } from './threads/thread-test-kit';
import type { CardThreads as CardThreadsValue } from '@/hooks/plan/useCardThreads';

// The item panel's tabs (docs/specs/026-plan/plan-board.md "Open an item" "Tabs", items.md "History" "Where it
// shows"): the type's own tabs, then Activity on every type, then on a phone Details at the far right; a card opens on
// the type's first tab; history is read only once Activity is picked, which is tracked; every role has the tab.

const env = vi.hoisted(() => ({ mobile: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => env.mobile,
}));
const fetchItemHistory = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('@/lib/api/item-history', () => ({
  fetchItemHistory: (...args: unknown[]) => fetchItemHistory(...args),
}));
const track = vi.fn<(...args: unknown[]) => void>();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => track(...args) }));

beforeEach(() => {
  env.mobile = false;
  fetchItemHistory.mockReset().mockResolvedValue([]);
  track.mockReset();
});
afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const card = (type = 'task'): Item => ({
  id: 'item-one',
  type,
  key: 1,
  rank: 'i',
  fields: { title: 'A card' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function panel(types: readonly ItemTypeDef[] = ITEM_TYPES, canEdit = true, type = 'task') {
  const noop = vi.fn();
  const threads = {
    ...fakeThreads([]).threads,
    scope: { ownerId: 'o', projectId: 'plan-a', shareCode: null, tabId: null },
  } as unknown as CardThreadsValue;
  const ctx = canEdit
    ? contextOf(threads)
    : contextOf(threads, { canComment: false, isEditor: false });
  render(
    <CardThreadsProvider value={ctx}>
      <ItemPanel
        item={card(type)}
        types={types}
        statuses={[]}
        people={[]}
        labels={[]}
        canEdit={canEdit}
        onSave={noop}
        onPatch={noop}
        onType={noop}
        onOpenItem={noop}
        onTrash={noop}
        onDuplicate={noop}
        onFlag={noop}
        onArchive={noop}
        onClose={noop}
        trail={[card(type)]}
        statusNames={new Map()}
      />
    </CardThreadsProvider>,
  );
}

const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);
const selected = () => screen.getByRole('tab', { selected: true }).textContent;

describe('the item panel’s tabs', () => {
  it('ends the type’s own tabs with Activity, and opens on the first', () => {
    const tabbed: ItemTypeDef = {
      ...ITEM_TYPES[1],
      id: 'tabbed',
      tabs: [
        { id: 'one', label: 'Overview', fields: ['description'] },
        { id: 'two', label: 'Notes', fields: ['comments'] },
      ],
    };
    panel([tabbed], true, 'tabbed');
    expect(tabNames()).toEqual(['Overview', 'Notes', 'Activity']);
    expect(selected()).toBe('Overview');
  });

  it('gives a type of one tab a bar of two', () => {
    const plain: ItemTypeDef = { ...ITEM_TYPES[1], fields: ['title', 'status', 'description'] };
    panel([plain], true, plain.id);
    expect(tabNames()).toEqual(['Overview', 'Activity']);
  });

  it('on a phone puts Details last, at the far right, and still opens on Overview', () => {
    env.mobile = true;
    panel();
    expect(tabNames()).toEqual(['Overview', 'Activity', 'Details']);
    expect(selected()).toBe('Overview');
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    expect(selected()).toBe('Details');
    expect(document.querySelector('[data-item-meta]')).toBeTruthy();
  });

  it('reads the history only once Activity is picked, tracking it', async () => {
    panel();
    await act(async () => {});
    expect(fetchItemHistory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'ActivityOn');
    await act(async () => {});
    expect(fetchItemHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No Activity Yet')).toBeTruthy();
    // Picking it again where it already is sends nothing more.
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('moves between the tabs with the arrow keys', () => {
    panel();
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selected()).toBe('Activity');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selected()).toBe('Overview');
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(selected()).toBe('Activity');
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(selected()).toBe('Activity');
  });

  it('gives a Viewer the Activity tab, reading as anyone does', async () => {
    panel(ITEM_TYPES, false);
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    await act(async () => {});
    expect(fetchItemHistory).toHaveBeenCalledTimes(1);
  });
});
