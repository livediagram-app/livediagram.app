import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TelemetryWireEvent } from '@liveworkspace/telemetry';
import { AI_FAILED, AI_SLOW, type AiRequest } from '../ai';
import {
  AUTOMATION_AI_MODEL,
  AUTOMATION_AI_TIMEOUT_MS,
  aiClient,
  aiToday,
  ask,
  countAiAsk,
  countDraftAsk,
  draftsToday,
  type AutomationsAi,
} from './automation-ai';
import { claimRun, markAiAsked, settleRun } from './automation-log';
import { AutomationTally } from './automation-telemetry';
import { rowsOf, testSql } from './test-sql';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 50 * DAY + 1000;
const request: AiRequest = {
  messages: [{ role: 'system', content: 's' }],
  response_format: { type: 'json_schema', json_schema: { name: 'n', schema: {}, strict: true } },
  max_tokens: 10,
  temperature: 0,
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the binding', () => {
  it('is the env’s AI, or none', () => {
    const AI: AutomationsAi = { run: async () => ({}) };
    expect(aiClient({ AI })).toBe(AI);
    expect(aiClient({})).toBeNull();
  });
});

describe('the day’s AI asks', () => {
  it('counts each rule’s call as it is asked, a pending run’s at once, and Describe a Rule’s asks', () => {
    const sql = testSql();
    expect(aiToday(sql, NOW)).toBe(0);
    // A settled run's lines are no longer read: the count is kept as each call is asked.
    settleRun(sql, {
      id: 'a',
      ruleId: 'r1',
      at: NOW,
      result: 'done',
      steps: [{ kind: 'action', ai: true }],
    } as never);
    expect(aiToday(sql, NOW)).toBe(0);
    claimRun(sql, 'pending', 'r1', NOW);
    markAiAsked(sql, 'pending', 1, NOW);
    markAiAsked(sql, 'pending', 2, NOW);
    // Yesterday's ask is yesterday's.
    markAiAsked(sql, 'pending', 3, NOW - DAY);
    countDraftAsk(sql, NOW, false);
    countDraftAsk(sql, NOW, true);
    expect(aiToday(sql, NOW)).toBe(4);
    expect(rowsOf(sql, 'SELECT asks FROM automation_ai_days ORDER BY day')).toEqual([
      { asks: 1 },
      { asks: 2 },
    ]);
    expect(draftsToday(sql, NOW)).toBe(1);
  });

  it('keeps a row a day, yesterday’s and today’s, deleting older ones on a day’s first ask', () => {
    const sql = testSql();
    countAiAsk(sql, NOW - 3 * DAY);
    countAiAsk(sql, NOW - DAY);
    countAiAsk(sql, NOW - DAY);
    expect(rowsOf(sql, 'SELECT day FROM automation_ai_days')).toHaveLength(1);
    countAiAsk(sql, NOW);
    expect(rowsOf(sql, 'SELECT day, asks FROM automation_ai_days ORDER BY day')).toEqual([
      { day: Math.floor((NOW - DAY) / DAY) * DAY, asks: 2 },
      { day: Math.floor(NOW / DAY) * DAY, asks: 1 },
    ]);
  });

  it('lets asks past two days go', () => {
    const sql = testSql();
    countDraftAsk(sql, NOW - 3 * DAY, false);
    countDraftAsk(sql, NOW - DAY, false);
    countDraftAsk(sql, NOW, false);
    expect(rowsOf(sql, 'SELECT at FROM automation_ai_drafts')).toHaveLength(2);
    expect(draftsToday(sql, NOW)).toBe(1);
  });
});

describe('one ask', () => {
  it('calls the model with thinking off, through the gateway when there is one', async () => {
    const run = vi.fn(async () => ({ response: '{}' }));
    expect(await ask({ run }, request, 'gw')).toEqual({ ok: true, raw: { response: '{}' } });
    expect(run).toHaveBeenCalledWith(
      AUTOMATION_AI_MODEL,
      { ...request, chat_template_kwargs: { enable_thinking: false } },
      { gateway: { id: 'gw' } },
    );
    await ask({ run }, request, undefined);
    expect(run).toHaveBeenLastCalledWith(AUTOMATION_AI_MODEL, expect.anything(), undefined);
  });

  it('answers the same failure for a model that errs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = () => Promise.reject(new Error('refused'));
    expect(await ask({ run }, request, undefined)).toEqual({ ok: false, reason: AI_FAILED });
    expect(warn).toHaveBeenCalled();
  });

  it('gives up on a model that takes too long', async () => {
    vi.useFakeTimers();
    const asked = ask({ run: () => new Promise(() => {}) }, request, undefined);
    await vi.advanceTimersByTimeAsync(AUTOMATION_AI_TIMEOUT_MS);
    expect(await asked).toEqual({ ok: false, reason: AI_SLOW });
  });
});

describe('a wake’s tally', () => {
  it('posts results and trouble first, trigger kinds after, one batch at most, then is empty', async () => {
    const tally = new AutomationTally<'Space', 'Ran'>();
    const batches: TelemetryWireEvent[][] = [];
    const report = async (events: TelemetryWireEvent[]) => {
      batches.push(events);
    };
    await tally.flush(report);
    expect(batches).toEqual([]);
    for (let i = 0; i < 60; i += 1) {
      tally.track('Space', 'Ran', 'AutomationTrigger.Scheduled');
      tally.track('Space', 'Ran', 'AutomationDone');
    }
    expect(tally.size).toBe(120);
    await tally.flush(report);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.length).toBeLessThan(120);
    expect(batches[0]![0]).toEqual({ category: 'Space', action: 'Ran', type: 'AutomationDone' });
    expect(batches[0]!.findIndex((e) => e.type === 'AutomationTrigger.Scheduled')).toBe(60);
    expect(tally.size).toBe(0);
  });
});

describe('a count that reads no row', () => {
  // Every count asks one row; an engine that answers none is read as nothing counted.
  const empty = { exec: () => ({ toArray: () => [] }) } as never;

  it('counts as none', () => {
    expect(aiToday(empty, NOW)).toBe(0);
    expect(draftsToday(empty, NOW)).toBe(0);
  });
});
