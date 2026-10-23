import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createNameStore, NAME_BATCH, NamesProvider, useNamedEvents } from './names';

const ids = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `user_${from + i}`);
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

describe('names for who did what', () => {
  it('asks for every id a tick wants in batches of at most a hundred, and never twice', async () => {
    const lookup = vi.fn(async (asked: readonly string[]) =>
      Object.fromEntries(asked.map((id) => [id, `Name of ${id}`])),
    );
    const store = createNameStore(lookup);
    store.want(ids(120));
    store.want([...ids(30, 120), 'user_0', null, 'deleted']);
    await flush();
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls[0]![0]).toHaveLength(NAME_BATCH);
    expect(lookup.mock.calls[1]![0]).toHaveLength(50);
    expect(store.name('user_7')).toBe('Name of user_7');
    store.want(ids(150));
    await flush();
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('asks again after a failed read, and knows nothing without a lookup', async () => {
    let fail = true;
    const lookup = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return { user_1: 'Sam' };
    });
    const store = createNameStore(lookup);
    store.want(['user_1']);
    await flush();
    expect(store.name('user_1')).toBeNull();
    fail = false;
    store.want(['user_1']);
    await flush();
    expect(store.name('user_1')).toBe('Sam');
    const none = createNameStore(undefined);
    none.want(['user_1']);
    expect(none.name('user_1')).toBeNull();
  });

  it('fills the names into the events on screen, keeping any the event carries', async () => {
    const store = createNameStore(async () => ({ user_1: 'Sam Lee', user_2: 'Ignored' }));
    function Names() {
      const events = useNamedEvents(EVENTS);
      return <p>{events.map((e) => e.actorName ?? 'A teammate').join(', ')}</p>;
    }
    render(
      <NamesProvider value={store}>
        <Names />
      </NamesProvider>,
    );
    expect(screen.getByText('A teammate, Kept')).toBeTruthy();
    await flush();
    expect(screen.getByText('Sam Lee, Kept')).toBeTruthy();
  });
});

const EVENTS = [
  { actorId: 'user_1', actorName: null },
  { actorId: 'user_2', actorName: 'Kept' },
];
