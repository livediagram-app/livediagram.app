import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAN_DRAFT_PER_DAY } from '@liveplanner/items';
import {
  PLAN_DRAFT_COUNT_KEY,
  planDraftCountName,
  spendPlanDraft,
  spendPlanDraftIn,
  utcDay,
} from './plan-draft-count';
import { PlanRoom } from './plan-room/plan-room';
import type { Env } from './types';

// docs/specs/026-plan/describe-a-plan.md "Limits and cost": an account's drafts a UTC day, kept in a reserved
// PLAN_ROOM instance that only ever holds this one key.
const NOON = Date.UTC(2026, 10, 13, 12);
const NEXT_DAY = Date.UTC(2026, 10, 14, 0, 0, 1);

const memoryStorage = () => {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async <T>(key: string) => map.get(key) as T | undefined,
    put: async (key: string, value: unknown) => void map.set(key, value),
  } as unknown as Pick<DurableObjectStorage, 'get' | 'put'> & { map: Map<string, unknown> };
};

// A PLAN_ROOM of rooms by name, each its own storage, answering the count's RPC as PlanRoom does.
const rooms = () => {
  const stores = new Map<string, ReturnType<typeof memoryStorage>>();
  const ns = {
    idFromName: (name: string) => name,
    get: (name: string) => {
      const storage = stores.get(name) ?? memoryStorage();
      stores.set(name, storage);
      return { spendPlanDraft: (day: string, cap: number) => spendPlanDraftIn(storage, day, cap) };
    },
  };
  return { stores, env: { PLAN_ROOM: ns } as unknown as Pick<Env, 'PLAN_ROOM'> };
};

afterEach(() => vi.restoreAllMocks());

describe('the count', () => {
  it('lets an account draft its day’s plans, then refuses, and starts again the next UTC day', async () => {
    const { env } = rooms();
    for (let i = 0; i < PLAN_DRAFT_PER_DAY; i++)
      expect(await spendPlanDraft(env, 'user_a', NOON)).toBe(true);
    expect(await spendPlanDraft(env, 'user_a', NOON)).toBe(false);
    expect(await spendPlanDraft(env, 'user_b', NOON)).toBe(true);
    expect(await spendPlanDraft(env, 'user_a', NEXT_DAY)).toBe(true);
  });

  it('keeps each account in its own reserved instance, holding only the day and the count', async () => {
    const { env, stores } = rooms();
    await spendPlanDraft(env, 'user_a', NOON);
    expect([...stores.keys()]).toEqual(['~plan-drafts:user_a']);
    expect([...stores.get(planDraftCountName('user_a'))!.map.entries()]).toEqual([
      [PLAN_DRAFT_COUNT_KEY, { day: '2026-11-13', count: 1 }],
    ]);
    expect(utcDay(NEXT_DAY)).toBe('2026-11-14');
  });

  it('defaults to Date.now()', async () => {
    expect(await spendPlanDraft(rooms().env, 'user_a')).toBe(true);
  });

  it('is unavailable with no PLAN_ROOM, or one that throws, and says so in the log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await spendPlanDraft({} as Pick<Env, 'PLAN_ROOM'>, 'user_a', NOON)).toBe('unavailable');
    const failing = (thrown: unknown) =>
      ({
        PLAN_ROOM: {
          idFromName: () => 'id',
          get: () => ({
            spendPlanDraft: async () => {
              throw thrown;
            },
          }),
        },
      }) as unknown as Pick<Env, 'PLAN_ROOM'>;
    expect(await spendPlanDraft(failing(new Error('overloaded')), 'user_a', NOON)).toBe(
      'unavailable',
    );
    expect(await spendPlanDraft(failing('gone'), 'user_a', NOON)).toBe('unavailable');
    expect(warn).toHaveBeenCalledWith('[plan-draft] count_unavailable', 'overloaded');
    expect(warn).toHaveBeenCalledWith('[plan-draft] count_unavailable', 'gone');
  });

  it('is PlanRoom’s RPC on its own storage, never its plan schema', async () => {
    const storage = memoryStorage();
    const room = Object.create(PlanRoom.prototype) as PlanRoom;
    Reflect.set(room, 'state', { storage });
    expect(await room.spendPlanDraft('2026-11-13', 1)).toBe(true);
    expect(await room.spendPlanDraft('2026-11-13', 1)).toBe(false);
    expect([...storage.map.keys()]).toEqual([PLAN_DRAFT_COUNT_KEY]);
  });
});
