// History on an item's menu: the item's own Timeline in a dialog, one `GET /timeline?item=` page at a time, on a
// day-by-day rail with filter chips and runs of one kind by one person folded into one entry.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type TimelineEvent } from '@liveworkspace/index-client';
import { createFakeIndex, makeEvent, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';

function page(index: ReturnType<typeof createFakeIndex>, history?: boolean) {
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'all' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      heroHidden
      {...(history === undefined ? {} : { history })}
    />,
  );
}

const openMenu = async () =>
  fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 1' }))[0]!);

async function openHistory() {
  await openMenu();
  fireEvent.click(await screen.findByRole('menuitem', { name: 'History' }));
  return screen.findByRole('dialog', { name: 'History of Item 1' });
}

const entries = (dialog: HTMLElement) =>
  dialog.querySelectorAll(':scope [data-history-event]:not([data-history-event] *)');

// One of item-1's events, `i` minutes ago.
const mine = (i: number, over: Partial<TimelineEvent> = {}) =>
  makeEvent(i, { id: `e-${i}`, itemId: 'item-1', ...over });

describe('History', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('liveworkspace:explorer-view-mode', 'details');
  });

  it("shows the item's own events on a rail, and pages", async () => {
    // Alternating people, so nothing folds into a run.
    const events = Array.from({ length: 31 }, (_, i) =>
      mine(i + 1, {
        type: i === 0 ? 'renamed' : 'edited',
        actorId: i % 2 ? 'user_ada' : 'user_me',
        actorName: i % 2 ? 'Ada Lovelace' : null,
      }),
    );
    const index = createFakeIndex({
      items: [makeItem(1)],
      events: [...events, makeEvent(2, { id: 'other', itemId: 'item-2' })],
    });
    page(index);
    const dialog = await openHistory();
    await waitFor(() => expect(entries(dialog)).toHaveLength(30));
    expect(within(dialog).getByText('Plan Renamed')).toBeTruthy();
    expect(within(dialog).getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('You').length).toBeGreaterThan(0);
    const asked = index.calls.filter((c) => c.method === 'timeline').map((c) => c.args[0]);
    expect(asked).toEqual([{ item: 'item-1', limit: 30 }]);
    // More remain: the counts say so.
    const summary = () => dialog.querySelector<HTMLElement>('[data-history-summary]')!;
    expect(within(summary()).getByText('30+ events')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show older events' }));
    await waitFor(() => expect(entries(dialog)).toHaveLength(31));
    expect(within(dialog).queryByRole('button', { name: 'Show older events' })).toBeNull();
    expect(within(summary()).getByText('31 events')).toBeTruthy();
    expect(index.calls.filter((c) => c.method === 'timeline')).toHaveLength(2);
  });

  it('is an ordered list of days, each an ordered list, with machine-readable times', async () => {
    page(createFakeIndex({ items: [makeItem(1)], events: [mine(1, { type: 'edited' })] }));
    const dialog = await openHistory();
    const list = await within(dialog).findByRole('list', { name: 'Events, newest first' });
    expect(list.tagName).toBe('OL');
    const day = within(list).getAllByRole('listitem')[0]!;
    expect(within(day).getByRole('heading', { level: 3, name: /Today/ })).toBeTruthy();
    const times = dialog.querySelectorAll('time[datetime]');
    expect(times.length).toBeGreaterThan(1);
    // The item's own header: its name is the dialog's heading, and its app wears its mark.
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Item 1' })).toBeTruthy();
    expect(dialog.querySelector('[data-app-mark="liveplanner"]')).toBeTruthy();
  });

  it('folds a run of one kind by one person, and deals it out on request', async () => {
    const events = [
      mine(1, { type: 'renamed', detail: { from: 'B' } }),
      mine(2, { type: 'renamed', detail: { from: 'A' } }),
      mine(3, { type: 'renamed', detail: { from: 'Untitled' } }),
      mine(4, { type: 'edited', actorId: 'user_ada', actorName: 'Ada' }),
    ];
    page(createFakeIndex({ items: [makeItem(1)], events }));
    const dialog = await openHistory();
    await waitFor(() => expect(entries(dialog)).toHaveLength(2));
    expect(within(dialog).getByText('3 times')).toBeTruthy();
    const toggle = within(dialog).getByRole('button', { name: /Show all 3/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const run = within(dialog).getByRole('list', { name: 'Plan Renamed, 3 times' });
    expect(within(run).getAllByRole('listitem')).toHaveLength(3);
    expect(within(run).getByText('Was “Untitled”')).toBeTruthy();
  });

  it('filters by kind with toggle chips', async () => {
    const events = [
      mine(1, { type: 'edited' }),
      mine(2, { type: 'shared', detail: { level: 'view' }, actorId: 'user_ada' }),
      mine(3, { type: 'moved', detail: { folderName: 'Launches' } }),
    ];
    page(createFakeIndex({ items: [makeItem(1)], events }));
    const dialog = await openHistory();
    const chips = await within(dialog).findByRole('group', { name: 'Filter by kind' });
    const all = within(chips).getByRole('button', { name: /^All/ });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(chips).getByRole('button', { name: /^Sharing/ }));
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
    expect(entries(dialog)[0]!.getAttribute('data-history-event')).toBe('shared');
    expect(all.getAttribute('aria-pressed')).toBe('false');
    // Pressed again, the chip lets go.
    fireEvent.click(within(chips).getByRole('button', { name: /^Sharing/ }));
    await waitFor(() => expect(entries(dialog)).toHaveLength(3));
  });

  it('leaves the chips off when only one kind is loaded', async () => {
    page(createFakeIndex({ items: [makeItem(1)], events: [mine(1, { type: 'edited' })] }));
    const dialog = await openHistory();
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
    expect(within(dialog).queryByRole('group', { name: 'Filter by kind' })).toBeNull();
  });

  it('says when nothing has happened', async () => {
    page(createFakeIndex({ items: [makeItem(1)] }));
    const dialog = await openHistory();
    expect(await within(dialog).findByText('Nothing has happened yet')).toBeTruthy();
    expect(dialog.querySelector('[data-history-summary]')).toBeNull();
  });

  it('says a failed read failed, never "nothing has happened", and tries again', async () => {
    const index = createFakeIndex({ items: [makeItem(1)], events: [mine(1, { type: 'edited' })] });
    index.fail.set('timeline', new IndexError(500, 'internal'));
    page(index);
    const dialog = await openHistory();
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(within(dialog).queryByText('Nothing has happened yet')).toBeNull();
    index.fail.delete('timeline');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
  });

  it('shows a busy skeleton while the first page loads', async () => {
    const index = createFakeIndex({ items: [makeItem(1)], events: [mine(1, { type: 'edited' })] });
    index.hold.add('timeline');
    page(index);
    const dialog = await openHistory();
    expect(within(dialog).getByLabelText('Loading history').getAttribute('aria-busy')).toBe('true');
    index.hold.delete('timeline');
    index.release();
    await waitFor(() => expect(entries(dialog)).toHaveLength(1));
  });

  it('is left off when the host turns it off', async () => {
    page(createFakeIndex({ items: [makeItem(1)] }), false);
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'History' })).toBeNull();
  });
});
