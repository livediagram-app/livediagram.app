// Who did what, by name: an item's History asks the Explorer's one people store (the Owner column's) for the actors
// the index names by id only, in one gathered request.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeEvent, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';
import type { ExplorerAccounts } from './accounts';

function fakeAccounts(names: Record<string, string>) {
  const people = vi.fn(async (ids: readonly string[]) => {
    return new Map(
      ids.flatMap((id) => (names[id] ? [[id, { name: names[id], picture: null }] as const] : [])),
    );
  });
  const accounts: ExplorerAccounts = {
    people,
  };
  return { accounts, people };
}

describe('names for who did what', () => {
  beforeEach(() => localStorage.clear());

  it('names History’s actors through the people store, all in one request', async () => {
    const now = Date.now();
    const index = createFakeIndex({
      items: [makeItem(1)],
      events: [
        makeEvent(1, {
          actorId: 'user_sam',
          type: 'renamed',
          detail: { from: 'A' },
          occurredAt: now - 60_000,
        }),
        makeEvent(1, {
          id: 'ev-2',
          actorId: 'user_ana',
          type: 'trashed',
          occurredAt: now - 120_000,
        }),
        makeEvent(1, {
          id: 'ev-3',
          actorId: 'user_kim',
          actorName: 'Kim Kept',
          type: 'trashed',
          occurredAt: now - 180_000,
        }),
      ],
    });
    const { accounts, people } = fakeAccounts({ user_sam: 'Sam Lee', user_ana: 'Ana Ruiz' });
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'all' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/open/${i.id}`}
        onCreate={vi.fn()}
        viewerId="user_me"
        heroHidden
        accounts={accounts}
      />,
    );
    fireEvent.click((await screen.findAllByRole('button', { name: 'Menu for Item 1' }))[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'History' }));
    const dialog = await screen.findByRole('dialog', { name: 'History of Item 1' });
    await waitFor(() => {
      const text = dialog.textContent ?? '';
      expect(text).toContain('Sam Lee');
      expect(text).toContain('Ana Ruiz');
      expect(text).toContain('Kim Kept');
    });
    const asked = people.mock.calls.flatMap((c) => c[0]);
    expect(asked).toEqual(expect.arrayContaining(['user_sam', 'user_ana']));
    // Kim's name came with the event; their avatar's picture rides in the same one request as the others' names.
    expect(people).toHaveBeenCalledTimes(1);
    expect(new Set(asked).size).toBe(asked.length);
  });
});
