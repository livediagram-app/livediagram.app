// History on an item's menu: the item's own Timeline in a dialog, one `GET /timeline?item=` page at a time.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('History', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('liveworkspace:explorer-view-mode', 'details');
  });

  it("shows the item's own events, by day, and pages", async () => {
    const mine = Array.from({ length: 31 }, (_, i) =>
      makeEvent(i + 1, { id: `e-${i}`, itemId: 'item-1', type: i === 0 ? 'renamed' : 'edited' }),
    );
    const index = createFakeIndex({
      items: [makeItem(1)],
      events: [...mine, makeEvent(2, { id: 'other', itemId: 'item-2' })],
    });
    page(index);
    await openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'History' }));
    const dialog = await screen.findByRole('dialog', { name: 'History of Item 1' });
    await waitFor(() => expect(dialog.querySelectorAll('[data-history-event]')).toHaveLength(30));
    expect(within(dialog).getByText('Plan Renamed')).toBeTruthy();
    expect(within(dialog).getAllByText(/by you/).length).toBeGreaterThan(0);
    const asked = index.calls.filter((c) => c.method === 'timeline').map((c) => c.args[0]);
    expect(asked).toEqual([{ item: 'item-1', limit: 30 }]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show More' }));
    await waitFor(() => expect(dialog.querySelectorAll('[data-history-event]')).toHaveLength(31));
    expect(within(dialog).queryByRole('button', { name: 'Show More' })).toBeNull();
  });

  it('is left off when the host turns it off', async () => {
    page(createFakeIndex({ items: [makeItem(1)] }), false);
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'History' })).toBeNull();
  });
});
