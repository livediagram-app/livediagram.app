import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_DAILY_BUDGET_STORE,
  AI_DAILY_CAP_DEFAULT,
  aiDailyCap,
  spendAiDailyBudget,
  utcDay,
} from './ai-daily-cap';
import { testPersonStores } from './test-person-store';
import type { Env } from './types';

// The deployment's daily cap on reader requests (docs/specs/021-event-storming/note-reader.md "Security"): one count
// for the whole deployment, per UTC day, kept in the PERSON_STORE instance the cap names.

afterEach(() => vi.restoreAllMocks());

const NOON = Date.UTC(2026, 10, 4, 12);
const NEXT_DAY = Date.UTC(2026, 10, 5, 0, 0, 1);

describe('aiDailyCap', () => {
  it('defaults to 1000 a day', () => {
    expect(AI_DAILY_CAP_DEFAULT).toBe(1000);
    expect(aiDailyCap(undefined)).toBe(1000);
  });

  it('takes a positive whole number from AI_DAILY_CAP', () => {
    expect(aiDailyCap('250')).toBe(250);
    expect(aiDailyCap(' 5 ')).toBe(5);
  });

  it('keeps the default for anything else', () => {
    for (const raw of ['', '0', '-3', '2.5', 'lots', '1e3', '99999999999999999999']) {
      expect(aiDailyCap(raw), raw).toBe(AI_DAILY_CAP_DEFAULT);
    }
  });
});

describe('utcDay', () => {
  it('is the UTC calendar day', () => {
    expect(utcDay(NOON)).toBe('2026-11-04');
    expect(utcDay(Date.UTC(2026, 10, 4, 23, 59, 59))).toBe('2026-11-04');
    expect(utcDay(NEXT_DAY)).toBe('2026-11-05');
  });
});

describe('spendAiDailyBudget', () => {
  const envWith = (cap?: string) =>
    ({ PERSON_STORE: testPersonStores(), AI_DAILY_CAP: cap }) as Pick<
      Env,
      'PERSON_STORE' | 'AI_DAILY_CAP'
    >;

  it('admits up to the cap, then refuses for the rest of the day', async () => {
    const env = envWith('3');
    const answers = [];
    for (let i = 0; i < 5; i++) answers.push(await spendAiDailyBudget(env, NOON));
    expect(answers).toEqual([true, true, true, false, false]);
  });

  it('starts again from zero on a new UTC day', async () => {
    const env = envWith('1');
    expect(await spendAiDailyBudget(env, NOON)).toBe(true);
    expect(await spendAiDailyBudget(env, NOON)).toBe(false);
    expect(await spendAiDailyBudget(env, NEXT_DAY)).toBe(true);
    expect(await spendAiDailyBudget(env, NEXT_DAY)).toBe(false);
  });

  it('keeps one count for the whole deployment, in the store the cap names', async () => {
    const ns = testPersonStores();
    const get = vi.spyOn(ns, 'idFromName');
    const env = { PERSON_STORE: ns } as Pick<Env, 'PERSON_STORE' | 'AI_DAILY_CAP'>;
    await spendAiDailyBudget(env, NOON);
    expect(get).toHaveBeenCalledWith(AI_DAILY_BUDGET_STORE);
    // No person's store is touched.
    expect(ns.databaseOf('guest_1')).toBeUndefined();
  });

  it('defaults to Date.now()', async () => {
    expect(await spendAiDailyBudget(envWith('1'))).toBe(true);
  });

  it('admits every request on a deployment without the binding', async () => {
    expect(await spendAiDailyBudget({} as Pick<Env, 'PERSON_STORE'>, NOON)).toBe(true);
  });

  it('admits, and logs, when the store cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = (thrown: unknown) =>
      ({
        PERSON_STORE: {
          idFromName: () => 'id',
          get: () => ({
            spendAiBudget: async () => {
              throw thrown;
            },
          }),
        },
      }) as unknown as Pick<Env, 'PERSON_STORE'>;
    expect(await spendAiDailyBudget(failing(new Error('overloaded')), NOON)).toBe(true);
    expect(await spendAiDailyBudget(failing('gone'), NOON)).toBe(true);
    expect(warn).toHaveBeenCalledWith('ai daily cap unavailable, admitting', 'overloaded');
    expect(warn).toHaveBeenCalledWith('ai daily cap unavailable, admitting', 'gone');
  });
});
