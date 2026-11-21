import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationLines } from '../types';
import {
  SENDS_UNREACHABLE,
  SEND_EMPTY,
  SEND_NOT_SENT,
  heldSends,
  sendMessages,
  type AutomationMessage,
  type AutomationMessageResult,
  type AutomationSendsClient,
  type PlannedSend,
} from './automation-sends';

type Subject = { ref: string; title: string };
const send = (step: number, over: Partial<PlannedSend> = {}): PlannedSend => ({
  step,
  line: step,
  webhook: `wh_${step}`,
  name: `Channel ${step}`,
  text: `Message ${step}`,
  ...over,
});
const lines = (n: number): AutomationLines =>
  Array.from({ length: n }, () => ({ kind: 'trigger' }));

function clientAnswering(
  answer: (m: AutomationMessage<Subject>) => AutomationMessageResult | null,
) {
  const pushed: { itemId: string; messages: AutomationMessage<Subject>[] }[] = [];
  const client: AutomationSendsClient<Subject> = {
    push: async (itemId, messages) => {
      pushed.push({ itemId, messages });
      return messages.flatMap((m) => answer(m) ?? []);
    },
  };
  return { client, pushed };
}
const input = (client: AutomationSendsClient<Subject> | null, dry = false) => ({
  client,
  itemId: 'item1',
  runId: 'run1',
  rule: 'Tell the Team',
  subject: { ref: 'Roadmap', title: 'Roadmap' },
  at: 99,
  ...(dry ? { dry } : {}),
});

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a run’s messages', () => {
  it('go in one push, each keyed by its run and step, and settle their lines', async () => {
    const { client, pushed } = clientAnswering((m) => ({ key: m.key, queued: true }));
    const out: AutomationLines = lines(4);
    expect(await sendMessages(input(client), [send(1), send(2)], out, 1)).toEqual({});
    expect(pushed).toEqual([
      {
        itemId: 'item1',
        messages: [1, 2].map((n) => ({
          key: `run1:${n}`,
          webhookId: `wh_${n}`,
          rule: 'Tell the Team',
          subject: { ref: 'Roadmap', title: 'Roadmap' },
          text: `Message ${n}`,
          at: 99,
        })),
      },
    ]);
    expect(out.slice(2)).toEqual([
      { kind: 'action', ok: true, text: 'Queued for Channel 1' },
      { kind: 'action', ok: true, text: 'Queued for Channel 2' },
    ]);
  });

  it('send nothing when there are none', async () => {
    const { client, pushed } = clientAnswering(() => null);
    expect(await sendMessages(input(client), [], [], 0)).toEqual({});
    expect(pushed).toEqual([]);
  });

  it('are only said by a test run', async () => {
    const { client, pushed } = clientAnswering(() => null);
    const out = lines(2);
    expect(
      await sendMessages(input(client, true), [send(0), send(1, { name: undefined })], out, 0),
    ).toEqual({});
    expect(out).toEqual([
      { kind: 'action', ok: true, text: 'Would post to Channel 0: Message 0' },
      { kind: 'action', ok: true, text: 'Would post to the webhook: Message 1' },
    ]);
    expect(pushed).toEqual([]);
  });

  it('never send a message that came out empty', async () => {
    const { client, pushed } = clientAnswering((m) => ({ key: m.key, queued: true }));
    const out = lines(2);
    expect(await sendMessages(input(client), [send(0, { text: '  ' }), send(1)], out, 0)).toEqual({
      failed: SEND_EMPTY,
    });
    expect(pushed[0]?.messages).toHaveLength(1);
    const none = lines(1);
    expect(await sendMessages(input(client), [send(0, { text: '' })], none, 0)).toEqual({
      failed: SEND_EMPTY,
    });
    expect(pushed).toHaveLength(1);
  });

  it('fail with the index’s reason, naming the connection unless it is only full', async () => {
    const { client } = clientAnswering((m) =>
      m.webhookId === 'wh_0'
        ? { key: m.key, queued: false, reason: 'Channel 0 is full', code: 'webhook_full' }
        : { key: m.key, queued: false, reason: 'Channel 1 is paused', code: 'webhook_paused' },
    );
    const out = lines(2);
    expect(await sendMessages(input(client), [send(0), send(1)], out, 0)).toEqual({
      failed: 'Channel 0 is full',
    });
    expect(out[1]).toEqual({ kind: 'action', ok: false, text: 'Channel 1 is paused' });
    expect(await sendMessages(input(client), [send(1)], lines(2), 0)).toEqual({
      failed: 'Channel 1 is paused',
      webhook: 'wh_1',
    });
  });

  it('fail every step when the index cannot be reached, has no client or leaves one unanswered', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const down: AutomationSendsClient<Subject> = { push: () => Promise.reject(new Error('down')) };
    expect(await sendMessages(input(down), [send(0)], lines(1), 0)).toEqual({
      failed: SENDS_UNREACHABLE,
    });
    expect(warn).toHaveBeenCalled();
    expect(await sendMessages(input(null), [send(0)], lines(1), 0)).toEqual({
      failed: SENDS_UNREACHABLE,
    });
    const { client } = clientAnswering(() => null);
    expect(await sendMessages(input(client), [send(0)], lines(1), 0)).toEqual({
      failed: SENDS_UNREACHABLE,
    });
  });
});

describe('the messages after a failed AI step', () => {
  it('are held back, their lines saying so', () => {
    const out = lines(4);
    const sends = [send(0), send(2), send(3)];
    expect(heldSends(sends, undefined, out, 0)).toBe(sends);
    expect(heldSends(sends, 2, out, 0)).toEqual([send(0)]);
    expect(out.slice(2)).toEqual([
      { kind: 'action', ok: false, text: SEND_NOT_SENT },
      { kind: 'action', ok: false, text: SEND_NOT_SENT },
    ]);
  });
});
