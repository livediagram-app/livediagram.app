// Who did what, by name: What Happened and the Timeline ask the Explorer's one people store (the Owner column's)
// for the actors the index names by id only, in one gathered request.
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeEvent } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';
import type { ExplorerAccounts } from './accounts';

function fakeAccounts(names: Record<string, string>) {
  const people = vi.fn(async (ids: readonly string[]) => {
    return new Map(ids.flatMap((id) => (names[id] ? [[id, names[id]] as const] : [])));
  });
  const accounts: ExplorerAccounts = {
    people,
  };
  return { accounts, people };
}

describe('names for who did what', () => {
  beforeEach(() => localStorage.clear());

  it('names What Happened’s actors through the people store, all in one request', async () => {
    const now = Date.now();
    const index = createFakeIndex({
      events: [
        makeEvent(1, {
          actorId: 'user_sam',
          type: 'renamed',
          detail: { from: 'A' },
          occurredAt: now - 60_000,
        }),
        makeEvent(2, { actorId: 'user_ana', type: 'trashed', occurredAt: now - 120_000 }),
        makeEvent(3, {
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
        view={{ kind: 'home' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/open/${i.id}`}
        onCreate={vi.fn()}
        viewerId="user_me"
        heroHidden
        accounts={accounts}
      />,
    );
    await waitFor(() => {
      const text = document.querySelector('[data-home-section="what-happened"]')?.textContent ?? '';
      expect(text).toContain('Sam Lee renamed');
      expect(text).toContain('Ana Ruiz moved');
      expect(text).toContain('Kim Kept moved');
    });
    const asked = people.mock.calls.flatMap((c) => c[0]);
    expect(asked).toEqual(expect.arrayContaining(['user_sam', 'user_ana']));
    expect(asked).not.toContain('user_kim');
    expect(new Set(asked).size).toBe(asked.length);
  });
});
