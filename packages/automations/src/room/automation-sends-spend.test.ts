// A run's messages with Pro on (liveworkspace/docs/specs/004-index/webhooks.md "Messages count as Automation Runs
// (Pro)"): one of the owner's runs spent for each message the index would take, the rest held back and the run
// Skipped.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpendResult } from '@liveworkspace/subscription';
import type { AutomationLines } from '../types';
import {
  MESSAGE_RUNS_USED,
  deliveriesFor,
  sendMessages,
  type AutomationMessage,
  type AutomationSendsClient,
  type PlannedSend,
} from './automation-sends';

const result = (over: Partial<SpendResult>): SpendResult => ({
  ok: true,
  used: 1,
  limit: 10,
  tier: 'pro',
  ...over,
});
const answers = (...results: (SpendResult | null)[]) => {
  const asked: number[] = [];
  const spend = (n: number) => {
    asked.push(n);
    return Promise.resolve(results.shift() ?? null);
  };
  return { spend, asked };
};

describe('deliveries for a run’s messages', () => {
  it('grants every message when nothing is metered, or the spend went through', async () => {
    expect(await deliveriesFor(answers(null).spend, 3)).toEqual({ granted: 3 });
    expect(await deliveriesFor(answers(result({})).spend, 3)).toEqual({ granted: 3 });
  });

  it('grants every message when the service refused the request itself: they go uncounted', async () => {
    const refused = result({ ok: false, unmetered: 'refused' });
    expect(await deliveriesFor(answers(refused).spend, 2)).toEqual({ granted: 2 });
  });

  it('asks once more for what is left of the month, and holds back the rest', async () => {
    const { spend, asked } = answers(result({ ok: false, used: 8, limit: 10 }), result({}));
    expect(await deliveriesFor(spend, 5)).toEqual({ granted: 2, why: MESSAGE_RUNS_USED });
    expect(asked).toEqual([5, 2]);
    // The second ask refused too (another run spent them): none go.
    const again = answers(result({ ok: false, used: 8, limit: 10 }), result({ ok: false }));
    expect(await deliveriesFor(again.spend, 5)).toEqual({ granted: 0, why: MESSAGE_RUNS_USED });
    // Nothing is left: one ask only.
    for (const first of [
      result({ ok: false, used: 10, limit: 10 }),
      result({ ok: false, used: 12, limit: 10 }),
    ]) {
      const once = answers(first);
      expect((await deliveriesFor(once.spend, 5)).granted).toBe(0);
      expect(once.asked).toEqual([5]);
    }
  });
});

type Subject = { ref: string };
const send = (step: number): PlannedSend => ({
  step,
  line: step,
  webhook: `wh_${step}`,
  name: `Channel ${step}`,
  text: `Message ${step}`,
});
const lines = (n: number): AutomationLines =>
  Array.from({ length: n }, () => ({ kind: 'trigger' }));

function client(paused: Set<string> = new Set()) {
  const pushed: { check: boolean; messages: AutomationMessage<Subject>[] }[] = [];
  const c: AutomationSendsClient<Subject> = {
    push: (_itemId, messages, opts) => {
      pushed.push({ check: opts?.check === true, messages });
      return Promise.resolve(
        messages.map((m) =>
          paused.has(m.webhookId)
            ? {
                key: m.key,
                queued: false as const,
                reason: 'The connection is paused',
                code: 'webhook_paused',
              }
            : { key: m.key, queued: true as const },
        ),
      );
    },
  };
  return { c, pushed };
}
const input = (
  c: AutomationSendsClient<Subject>,
  spend: (n: number) => Promise<SpendResult | null>,
) => ({
  client: c,
  itemId: 'item1',
  runId: 'run1',
  rule: 'Tell the Team',
  subject: null,
  at: 99,
  spend,
});

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a run’s messages with Pro on', () => {
  it('checks first, spends for the ones the index takes, and sends only what was paid for', async () => {
    const { c, pushed } = client();
    const { spend, asked } = answers(result({ ok: false, used: 9, limit: 10 }), result({}));
    const out = lines(3);
    expect(await sendMessages(input(c, spend), [send(1), send(2)], out, 0)).toEqual({
      skipped: MESSAGE_RUNS_USED,
    });
    expect(asked).toEqual([2, 1]);
    expect(pushed.map((p) => [p.check, p.messages.length])).toEqual([
      [true, 2],
      [false, 1],
    ]);
    expect(out[1]).toEqual({ kind: 'action', ok: true, text: 'Queued for Channel 1' });
    expect(out[2]).toEqual({ kind: 'action', ok: false, text: MESSAGE_RUNS_USED });
  });

  it('spends nothing for a message the index would refuse, and stops when none would go', async () => {
    const { c, pushed } = client(new Set(['wh_1']));
    const { spend, asked } = answers(result({}));
    const out = lines(2);
    expect(await sendMessages(input(c, spend), [send(1)], out, 0)).toMatchObject({
      failed: 'The connection is paused',
    });
    expect(asked).toEqual([]);
    expect(pushed).toHaveLength(1);
  });

  it('sends every message when the month pays for them all', async () => {
    const { c, pushed } = client();
    const out = lines(2);
    expect(await sendMessages(input(c, answers(result({})).spend), [send(1)], out, 0)).toEqual({});
    expect(pushed.map((p) => p.check)).toEqual([true, false]);
  });

  it('sends none when the month pays for none', async () => {
    const { c, pushed } = client();
    const free = answers(result({ ok: false, used: 500, limit: 500, tier: 'free' }));
    const out = lines(2);
    expect(await sendMessages(input(c, free.spend), [send(1)], out, 0)).toEqual({
      skipped: MESSAGE_RUNS_USED,
    });
    expect(pushed.map((p) => p.check)).toEqual([true]);
  });
});
