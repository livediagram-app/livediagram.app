import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import worker from '../index';
import type { Env } from '../types';
import {
  CALLS_BUDGET_KEY,
  budgetLevel,
  budgetThresholds,
  pollCallsBudget,
  resetCallsBudgetLog,
  type TripRecord,
} from './calls-budget';
import { CALLS_MODE_KEY, resetCallsModeCache } from './calls-mode';
import { fakeKv, type FakeKv } from './fake-kv';

const GB = 1e9;

// Realtime analytics answering a month's egress of `gb` (all on the SFU).
function usage(gb: number) {
  return new Response(
    JSON.stringify({
      data: { viewer: { accounts: [{ sfu: [{ sum: { egressBytes: gb * GB } }], turn: [] }] } },
    }),
  );
}

type Sent = { to: string; subject: string; html: string };

function setup(opts: { switchValue?: string; env?: Partial<Env> } = {}) {
  const kv = fakeKv(opts.switchValue ? { [CALLS_MODE_KEY]: opts.switchValue } : {});
  const sent: Sent[] = [];
  const env = {
    CALLS_SWITCH: kv,
    CALLS_ANALYTICS_TOKEN: 'analytics-token',
    CALLS_USAGE_ACCOUNT_ID: 'acct',
    CALLS_ALERT_TO: 'owner@example.com',
    EMAIL: {
      send: vi.fn(async (msg: Sent) => {
        sent.push(msg);
        return { messageId: String(sent.length) };
      }),
    },
    EMAIL_FROM: 'livehuddle <hello@example.com>',
    ...opts.env,
  } as unknown as Env;
  return { kv, env, sent };
}

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T12:00:00.000Z'));
  resetCallsModeCache();
  resetCallsBudgetLog();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function record(kv: FakeKv): TripRecord {
  return JSON.parse(kv.store.get(CALLS_BUDGET_KEY) ?? 'null') as TripRecord;
}

describe('budgetThresholds', () => {
  it('defaults to $10 and $25', () => {
    expect(budgetThresholds({})).toEqual({ audioOnlyAtUsd: 10, offAtUsd: 25 });
  });

  it('reads the settings, and falls back on an unreadable or negative one', () => {
    expect(budgetThresholds({ CALLS_AUDIO_ONLY_AT_USD: '4.5', CALLS_OFF_AT_USD: '9' })).toEqual({
      audioOnlyAtUsd: 4.5,
      offAtUsd: 9,
    });
    expect(budgetThresholds({ CALLS_AUDIO_ONLY_AT_USD: 'ten', CALLS_OFF_AT_USD: '-1' })).toEqual({
      audioOnlyAtUsd: 10,
      offAtUsd: 25,
    });
    expect(budgetThresholds({ CALLS_AUDIO_ONLY_AT_USD: ' ' })).toEqual({
      audioOnlyAtUsd: 10,
      offAtUsd: 25,
    });
  });
});

describe('budgetLevel', () => {
  const t = { audioOnlyAtUsd: 10, offAtUsd: 25 };
  it('maps a cost to the level it has reached', () => {
    expect(budgetLevel(0, t)).toBe('none');
    expect(budgetLevel(9.99, t)).toBe('none');
    expect(budgetLevel(10, t)).toBe('audio-only');
    expect(budgetLevel(24.99, t)).toBe('audio-only');
    expect(budgetLevel(25, t)).toBe('off');
  });

  it('never trips at no cost, even with thresholds of zero', () => {
    expect(budgetLevel(0, { audioOnlyAtUsd: 0, offAtUsd: 0 })).toBe('none');
    expect(budgetLevel(0.01, { audioOnlyAtUsd: 0, offAtUsd: 0 })).toBe('off');
  });
});

describe('pollCallsBudget', () => {
  it('does nothing without the switch, and logs that once', async () => {
    const { env } = setup({ env: { CALLS_SWITCH: undefined } });
    expect(await pollCallsBudget(env)).toBe('inert');
    expect(await pollCallsBudget(env)).toBe('inert');
    expect(console.info).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does nothing without the analytics token or the account', async () => {
    expect(await pollCallsBudget(setup({ env: { CALLS_ANALYTICS_TOKEN: undefined } }).env)).toBe(
      'inert',
    );
    expect(await pollCallsBudget(setup({ env: { CALLS_USAGE_ACCOUNT_ID: undefined } }).env)).toBe(
      'inert',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('leaves the switch alone below the first threshold', async () => {
    const { env, kv, sent } = setup();
    fetchSpy.mockImplementation(async () => usage(1_100)); // $5
    expect(await pollCallsBudget(env)).toBe('below');
    expect(kv.store.has(CALLS_MODE_KEY)).toBe(false);
    expect(sent).toEqual([]);
  });

  it('trips on to audio only to off, emailing once at each, and never again that month', async () => {
    const { env, kv, sent } = setup();

    fetchSpy.mockImplementation(async () => usage(1_250)); // $12.50
    expect(await pollCallsBudget(env)).toBe('tripped');
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('audio-only');
    expect(record(kv)).toEqual({
      month: '2026-11',
      level: 'audio-only',
      costUsd: 12.5,
      at: '2026-11-04T12:00:00.000Z',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('owner@example.com');
    expect(sent[0]!.subject).toContain('audio only');
    expect(sent[0]!.html).toContain('1,250 GB');
    expect(sent[0]!.html).toContain('$12.50');
    expect(sent[0]!.html).toContain('$10.00 threshold');

    // A later poll at the same level stays quiet.
    vi.advanceTimersByTime(15 * 60_000);
    fetchSpy.mockImplementation(async () => usage(1_400)); // $20
    expect(await pollCallsBudget(env)).toBe('already');
    expect(sent).toHaveLength(1);

    fetchSpy.mockImplementation(async () => usage(1_520)); // $26
    expect(await pollCallsBudget(env)).toBe('tripped');
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('off');
    expect(record(kv).level).toBe('off');
    expect(sent).toHaveLength(2);
    expect(sent[1]!.subject).toContain('paused');
    expect(sent[1]!.html).toContain('$25.00 threshold');

    fetchSpy.mockImplementation(async () => usage(1_900));
    expect(await pollCallsBudget(env)).toBe('already');
    expect(sent).toHaveLength(2);
  });

  it('jumping past both thresholds trips straight to off with one email', async () => {
    const { env, kv, sent } = setup();
    fetchSpy.mockImplementation(async () => usage(2_000)); // $50
    expect(await pollCallsBudget(env)).toBe('tripped');
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('off');
    expect(sent).toHaveLength(1);
  });

  it('never loosens the switch a person set stricter, and still emails', async () => {
    const { env, kv, sent } = setup({ switchValue: 'off' });
    fetchSpy.mockImplementation(async () => usage(1_250));
    expect(await pollCallsBudget(env)).toBe('tripped');
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('off');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.html).toContain('<strong>off</strong>');
  });

  it('a new month can trip and email again, and does not turn calls back on', async () => {
    const { env, kv, sent } = setup();
    fetchSpy.mockImplementation(async () => usage(1_250));
    expect(await pollCallsBudget(env)).toBe('tripped');

    vi.setSystemTime(new Date('2026-12-01T00:15:00.000Z'));
    fetchSpy.mockImplementation(async () => usage(10));
    expect(await pollCallsBudget(env)).toBe('below');
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('audio-only');

    fetchSpy.mockImplementation(async () => usage(1_300));
    expect(await pollCallsBudget(env)).toBe('tripped');
    expect(record(kv).month).toBe('2026-12');
    expect(sent).toHaveLength(2);
  });

  it('prices the time it is given', async () => {
    const { env, kv } = setup();
    fetchSpy.mockImplementation(async () => usage(1_250));
    expect(await pollCallsBudget(env, new Date('2027-01-31T23:59:00.000Z'))).toBe('tripped');
    expect(record(kv).month).toBe('2027-01');
    const sent = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string) as {
      variables: { start: string };
    };
    expect(sent.variables.start).toBe('2027-01-01T00:00:00.000Z');
  });

  it('treats an unreadable trip record as none', async () => {
    const { env, kv, sent } = setup();
    kv.store.set(CALLS_BUDGET_KEY, '{not json');
    fetchSpy.mockImplementation(async () => usage(1_250));
    expect(await pollCallsBudget(env)).toBe('tripped');
    kv.store.set(CALLS_BUDGET_KEY, JSON.stringify({ month: '2026-11', level: 'loud' }));
    expect(await pollCallsBudget(env)).toBe('tripped');
    kv.store.set(CALLS_BUDGET_KEY, 'null');
    expect(await pollCallsBudget(env)).toBe('tripped');
    expect(sent).toHaveLength(3);
  });

  it('trips without an email when no address is set', async () => {
    const { env, kv, sent } = setup({ env: { CALLS_ALERT_TO: undefined } });
    fetchSpy.mockImplementation(async () => usage(1_250));
    expect(await pollCallsBudget(env)).toBe('tripped');
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('audio-only');
    expect(sent).toEqual([]);
  });

  it('leaves the switch alone when analytics fail', async () => {
    const { env, kv, sent } = setup();
    fetchSpy.mockResolvedValue(new Response('nope', { status: 500 }));
    expect(await pollCallsBudget(env)).toBe('failed');
    expect(kv.store.size).toBe(0);
    expect(sent).toEqual([]);
  });

  it('reports a KV failure rather than throwing', async () => {
    const { env, kv } = setup();
    kv.failGets = true;
    fetchSpy.mockImplementation(async () => usage(1_250));
    expect(await pollCallsBudget(env)).toBe('failed');
  });

  it('uses the staging rehearsal figure in place of analytics', async () => {
    const { env, kv, sent } = setup({
      env: { CALLS_USAGE_TEST_GB: '1600', CALLS_ANALYTICS_TOKEN: undefined },
    });
    expect(await pollCallsBudget(env)).toBe('tripped');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('off');
    expect(sent).toHaveLength(1);
  });

  it('ignores an unreadable rehearsal figure', async () => {
    const { env } = setup({ env: { CALLS_USAGE_TEST_GB: 'lots' } });
    fetchSpy.mockImplementation(async () => usage(10));
    expect(await pollCallsBudget(env)).toBe('below');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

describe('the scheduled handler', () => {
  it('runs the poll at the scheduled time', async () => {
    const { env, kv } = setup();
    fetchSpy.mockImplementation(async () => usage(1_250));
    const pending: Promise<unknown>[] = [];
    await worker.scheduled(
      { scheduledTime: Date.parse('2026-11-04T12:00:00.000Z'), cron: '*/15 * * * *', noRetry() {} },
      env,
      {
        waitUntil: (p: Promise<unknown>) => pending.push(p),
        passThroughOnException() {},
        props: {},
      } as never,
    );
    await Promise.all(pending);
    expect(kv.store.get(CALLS_MODE_KEY)).toBe('audio-only');
  });
});
