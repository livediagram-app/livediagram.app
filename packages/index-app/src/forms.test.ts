import { describe, expect, it } from 'vitest';
import { createFormPlaces } from './forms';

describe('createFormPlaces', () => {
  const index = (answers: Record<string, { itemId: string; tabId: string } | null>) => {
    const asked: string[] = [];
    return {
      asked,
      client: {
        formByCode: async (code: string) => {
          asked.push(code);
          return answers[code] ?? null;
        },
      },
    };
  };

  it('asks the index once per code within the time, misses included, then again', async () => {
    const { asked, client } = index({ A: { itemId: 'p1', tabId: 't1' } });
    const places = createFormPlaces(60_000, 10);
    expect(await places.lookup(client, 'A', 0)).toEqual({ itemId: 'p1', tabId: 't1' });
    expect(await places.lookup(client, 'A', 59_999)).toEqual({ itemId: 'p1', tabId: 't1' });
    expect(await places.lookup(client, 'B', 0)).toBeNull();
    expect(await places.lookup(client, 'B', 1)).toBeNull();
    expect(asked).toEqual(['A', 'B']);
    await places.lookup(client, 'A', 60_000);
    places.forget('B');
    await places.lookup(client, 'B', 2);
    expect(asked).toEqual(['A', 'B', 'A', 'B']);
  });

  it('keeps at most `max` answers, the oldest going first, and lets an index failure through', async () => {
    const { asked, client } = index({});
    const places = createFormPlaces(60_000, 2);
    for (const code of ['A', 'B', 'C']) await places.lookup(client, code, 0);
    expect(places.size).toBe(2);
    await places.lookup(client, 'A', 0);
    expect(asked).toEqual(['A', 'B', 'C', 'A']);
    await expect(
      places.lookup({ formByCode: () => Promise.reject(new Error('down')) }, 'Z', 0),
    ).rejects.toThrow('down');
  });

  it('answers 10,000 cached lookups well within budget', async () => {
    const { client } = index({ A: { itemId: 'p', tabId: 't' } });
    const places = createFormPlaces();
    for (let i = 0; i < 1_000; i++) await places.lookup(client, `c${i}`, 0);
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) await places.lookup(client, `c${i % 1_000}`, 1);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
