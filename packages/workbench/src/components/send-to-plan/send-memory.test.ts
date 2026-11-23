import { describe, expect, it } from 'vitest';
import { recallSend, rememberSend, SEND_MEMORY_KEY, SEND_MEMORY_MAX } from './send-memory';

const fake = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};
const at = (n: number) => ({
  planId: `p${n}`,
  planTitle: 'Sprint',
  board: 'b1',
  column: 'To Do',
  at: n,
});

describe('send memory', () => {
  it('recalls where the last send from an item went, the newest kept', () => {
    const store = fake();
    expect(recallSend('D', store)).toBeNull();
    rememberSend('D', at(1), store);
    rememberSend('D', at(2), store);
    expect(recallSend('D', store)).toEqual(at(2));
    for (let i = 0; i < SEND_MEMORY_MAX + 5; i += 1) rememberSend(`s${i}`, at(10 + i), store);
    const kept = JSON.parse(store.map.get(SEND_MEMORY_KEY)!) as Record<string, unknown>;
    expect(Object.keys(kept)).toHaveLength(SEND_MEMORY_MAX);
    expect(recallSend('D', store)).toBeNull();
  });

  it('forgets rather than fails on storage it cannot read or write', () => {
    const store = fake();
    store.map.set(SEND_MEMORY_KEY, '{not json');
    expect(recallSend('D', store)).toBeNull();
    store.map.set(SEND_MEMORY_KEY, '[]');
    expect(recallSend('D', store)).toBeNull();
    store.map.set(SEND_MEMORY_KEY, JSON.stringify({ D: { planId: 1 } }));
    expect(recallSend('D', store)).toBeNull();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(() => rememberSend('D', at(1), full)).not.toThrow();
    expect(recallSend('D', null)).toBeNull();
    expect(recallSend('D')).toBeNull();
  });
});

describe('the browser storage', () => {
  it('forgets, never fails, when storage cannot be reached, and skips an entry that is no memory', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    try {
      expect(recallSend('D')).toBeNull();
      rememberSend('D', at(1));
    } finally {
      if (real) Object.defineProperty(globalThis, 'localStorage', real);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
    const store = fake();
    store.map.set(SEND_MEMORY_KEY, JSON.stringify({ D: null, E: at(3) }));
    expect(recallSend('D', store)).toBeNull();
    expect(recallSend('E', store)).toEqual(at(3));
  });
});
