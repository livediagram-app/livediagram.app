import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASK_BUILT_IN_PER_PERSON_PER_DAY } from '../limits';
import { ASK_COUNT_KEY, askCountName, spendAsk, spendAskIn, utcDay } from './daily-count';

const storageOf = () => {
  const kept = new Map<string, unknown>();
  return {
    kept,
    get: async <T>(key: string) => kept.get(key) as T | undefined,
    put: async <T>(key: string, value: T) => void kept.set(key, value),
  };
};

afterEach(() => vi.restoreAllMocks());

describe("built-in AI's allowance", () => {
  it('counts a day, refuses at the cap, and starts again on a new day', async () => {
    const storage = storageOf();
    expect(await spendAskIn(storage, '2026-11-23', 2)).toBe(true);
    expect(await spendAskIn(storage, '2026-11-23', 2)).toBe(true);
    expect(await spendAskIn(storage, '2026-11-23', 2)).toBe(false);
    expect(storage.kept.get(ASK_COUNT_KEY)).toEqual({ day: '2026-11-23', count: 2 });
    expect(await spendAskIn(storage, '2026-11-24', 2)).toBe(true);
    expect(storage.kept.get(ASK_COUNT_KEY)).toEqual({ day: '2026-11-24', count: 1 });
  });

  it('names an instance no item id can take, and the UTC day', () => {
    expect(askCountName('acc_1')).toBe('~ask-ai:acc_1');
    expect(utcDay(Date.UTC(2026, 10, 23, 23, 59))).toBe('2026-11-23');
  });

  it("asks the account's own instance, with the day's cap", async () => {
    const spendAskRpc = vi.fn(async () => true);
    const rooms = {
      idFromName: vi.fn((name: string) => `id:${name}`),
      get: vi.fn(() => ({ spendAsk: spendAskRpc })),
    };
    expect(await spendAsk(rooms, 'acc_1', Date.UTC(2026, 10, 23))).toBe(true);
    expect(rooms.idFromName).toHaveBeenCalledWith('~ask-ai:acc_1');
    expect(rooms.get).toHaveBeenCalledWith('id:~ask-ai:acc_1');
    expect(spendAskRpc).toHaveBeenCalledWith('2026-11-23', ASK_BUILT_IN_PER_PERSON_PER_DAY);
    spendAskRpc.mockResolvedValueOnce(false);
    expect(await spendAsk(rooms, 'acc_1')).toBe(false);
  });

  it('refuses rather than lifts the cap when the count cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await spendAsk(undefined, 'acc_1')).toBe('unavailable');
    expect(await spendAsk(null, 'acc_1')).toBe('unavailable');
    const broken = {
      idFromName: () => 'id',
      get: () => ({
        spendAsk: async () => {
          throw new TypeError('acc_1 secret detail');
        },
      }),
    };
    expect(await spendAsk(broken, 'acc_1')).toBe('unavailable');
    // The log says only that it failed, never the fault's own words.
    expect(warn.mock.calls).toEqual([['[ask] count_unavailable']]);
  });
});
