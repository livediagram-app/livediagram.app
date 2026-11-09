// @vitest-environment jsdom
// The Explorer's one people store, for names and Google pictures (liveworkspace/docs/specs/003-accounts/accounts.md "Profile
// pictures"): however many avatars ask, the people come in one gathered request per PEOPLE_MAX ids, never one per
// avatar, and the picture rides with the name.
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PictureDisc } from '@liveworkspace/ui';
import { createExplorerAccounts, PEOPLE_MAX, type ExplorerAccounts } from './accounts';
import {
  createPeopleStore,
  PEOPLE_RETRY_MS,
  usePersonPicture,
  type PeopleStore,
} from './usePeople';

const pictureOf = (id: string) => `https://lh3.googleusercontent.com/a/${id}`;

function fakeAccounts() {
  const people = vi.fn<ExplorerAccounts['people']>(
    async (ids) => new Map(ids.map((id) => [id, { name: id, picture: pictureOf(id) }])),
  );
  return { accounts: { people } satisfies ExplorerAccounts, people };
}

function Avatar({ store, id }: { store: PeopleStore; id: string }) {
  const picture = usePersonPicture(store, id);
  return (
    <PictureDisc pictureUrl={picture} name={id} size={24}>
      P
    </PictureDisc>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the people store', () => {
  it('draws 250 avatars from three gathered requests, not one per avatar', async () => {
    const { accounts, people } = fakeAccounts();
    const store = createPeopleStore(accounts);
    const ids = Array.from({ length: 250 }, (_, i) => `user_${i}`);
    const { container } = render(
      <>
        {ids.map((id) => (
          <Avatar key={id} store={store} id={id} />
        ))}
        {/* The same people again elsewhere on the page ask nothing more. */}
        {ids.slice(0, 50).map((id) => (
          <Avatar key={`again-${id}`} store={store} id={id} />
        ))}
      </>,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(people).toHaveBeenCalledTimes(Math.ceil(250 / PEOPLE_MAX));
    expect(people.mock.calls.flatMap(([asked]) => asked)).toHaveLength(250);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(300);
    expect(imgs[0]!.getAttribute('src')).toBe(`${pictureOf('user_0')}=s24-c`);
    expect(store.picture('user_0')).toBe(pictureOf('user_0'));
    expect(store.name('user_0')).toBe('user_0');
  });

  it('knows a person with no picture, and leaves one not yet asked unknown', async () => {
    const store = createPeopleStore({
      people: async (ids) => new Map(ids.map((id) => [id, { name: 'Bea', picture: null }])),
    });
    expect(store.picture('user_bea')).toBeUndefined();
    store.want(['user_bea']);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(store.picture('user_bea')).toBeNull();
    expect(store.name('user_bea')).toBe('Bea');
  });
});

describe('a failed name lookup', () => {
  it('is asked again on its own while the row stays mounted, then let go for the next ask', async () => {
    let fail = 3;
    const people = vi.fn<ExplorerAccounts['people']>(async (ids) => {
      if (fail-- > 0) throw new Error('offline');
      return new Map(ids.map((id) => [id, { name: 'Ada', picture: null }]));
    });
    const store = createPeopleStore({ people });
    // One mounted avatar asks once, and never again on its own.
    render(<Avatar store={store} id="user_ada" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(people).toHaveBeenCalledTimes(1);
    expect(store.name('user_ada')).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PEOPLE_RETRY_MS[0] + 100);
    });
    expect(people).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PEOPLE_RETRY_MS[1] + 100);
    });
    expect(people).toHaveBeenCalledTimes(3);
    // Out of retries: nothing more on its own, however long the row stays.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(people).toHaveBeenCalledTimes(3);
    // The next ask tries again, and the answer lands.
    store.want(['user_ada']);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(people).toHaveBeenCalledTimes(4);
    expect(store.name('user_ada')).toBe('Ada');
  });

  it('retries each id on its own count when a retry gathers with a fresh ask', async () => {
    let fail = true;
    const people = vi.fn<ExplorerAccounts['people']>(async (ids) => {
      if (fail) throw new Error('offline');
      return new Map(ids.map((id) => [id, { name: id, picture: null }]));
    });
    const store = createPeopleStore({ people });
    store.want(['user_a']);
    await vi.advanceTimersByTimeAsync(100);
    // user_a's first retry gathers with user_b's first ask; both fail.
    await vi.advanceTimersByTimeAsync(PEOPLE_RETRY_MS[0] - 50);
    store.want(['user_b']);
    await vi.advanceTimersByTimeAsync(100);
    expect(people).toHaveBeenCalledTimes(2);
    expect([...people.mock.calls[1]![0]].sort()).toEqual(['user_a', 'user_b']);
    fail = false;
    // user_b is due after the first wait, user_a after the second.
    await vi.advanceTimersByTimeAsync(PEOPLE_RETRY_MS[0] + 100);
    expect(store.name('user_b')).toBe('user_b');
    expect(store.name('user_a')).toBeUndefined();
    await vi.runAllTimersAsync();
    expect(store.name('user_a')).toBe('user_a');
  });
});

describe('the accounts reader', () => {
  it('reads names and pictures in one request, and drops a picture that is not a Google one', async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({
        people: [
          { id: 'user_a', name: 'Ada', picture: pictureOf('a') },
          { id: 'user_b', name: 'Bea', picture: 'https://evil.example/b.png' },
          { id: 'user_c', name: 'Cy' },
        ],
      }),
    );
    const accounts = createExplorerAccounts({ fetch: fetchSpy as unknown as typeof fetch });
    const people = await accounts.people(['user_a', 'user_b', 'user_c']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect([...people]).toEqual([
      ['user_a', { name: 'Ada', picture: pictureOf('a') }],
      ['user_b', { name: 'Bea', picture: null }],
      ['user_c', { name: 'Cy', picture: null }],
    ]);
  });
});
