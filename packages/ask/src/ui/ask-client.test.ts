import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskRequestBody } from '../wire';

const api = vi.hoisted(() => ({
  fetch: vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(),
  headers: vi.fn(async () => ({
    Authorization: 'Bearer token',
    'Content-Type': 'application/json',
  })),
}));
vi.mock('@liveworkspace/workbench/bindings', () => ({ workbench: { api } }));
vi.mock('@liveworkspace/workbench/lib/api/base', () => ({ API_BASE: '/api' }));

import { ASK_CUT_SHORT, ASK_FAILED, askSender } from './ask-client';

const body: AskRequestBody = { question: 'Q?', passages: [] };
const sse = (...events: object[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
const ask = (signal = new AbortController().signal) => {
  const onDelta = vi.fn();
  return { onDelta, outcome: askSender('acc_1')(body, { onDelta, signal }) };
};

beforeEach(() => {
  api.fetch.mockReset();
  api.headers.mockClear();
});

describe('asking from an editor', () => {
  it("posts to the app's own api as the account, and hands on the stream", async () => {
    const done = { type: 'done', text: 'Hi [1].', sources: [], provider: 'built-in', model: 'm' };
    api.fetch.mockResolvedValue(
      sse({ type: 'delta', text: 'Hi' }, { type: 'delta', text: ' [1].' }, done),
    );
    const { onDelta, outcome } = ask();
    expect(await outcome).toEqual(done);
    expect(onDelta.mock.calls).toEqual([['Hi'], [' [1].']]);
    expect(api.headers).toHaveBeenCalledWith('acc_1', { body: true });
    const [url, init] = api.fetch.mock.calls[0]!;
    expect(url).toBe('/api/ask');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer token', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    });
  });

  it("hands on a refusal's own words, and a key failure with it", async () => {
    api.fetch.mockResolvedValue(
      Response.json(
        {
          error: 'ai_key_failed',
          message: 'Your AI key could not be read.',
          aiKey: { source: 'account', provider: null, kind: 'unreadable' },
        },
        { status: 422 },
      ),
    );
    expect(await ask().outcome).toEqual({
      type: 'error',
      kind: 'ai_key_failed',
      message: 'Your AI key could not be read.',
      aiKey: { source: 'account', provider: null, kind: 'unreadable' },
    });
    api.fetch.mockResolvedValue(
      Response.json({ error: 'ask_built_in_limit', message: 'Tomorrow.' }, { status: 429 }),
    );
    expect(await ask().outcome).toEqual({
      type: 'error',
      kind: 'ask_built_in_limit',
      message: 'Tomorrow.',
    });
    api.fetch.mockResolvedValue(new Response('<html>', { status: 502 }));
    expect(await ask().outcome).toEqual({ type: 'error', kind: 'other', message: ASK_FAILED });
    api.fetch.mockResolvedValue(new Response(null, { status: 200 }));
    expect(await ask().outcome).toEqual({ type: 'error', kind: 'other', message: ASK_FAILED });
  });

  it('says a stream cut short, and a request that never left', async () => {
    api.fetch.mockResolvedValue(sse({ type: 'delta', text: 'Half' }));
    expect(await ask().outcome).toEqual({ type: 'error', kind: 'other', message: ASK_CUT_SHORT });
    api.fetch.mockRejectedValue(new TypeError('offline'));
    expect(await ask().outcome).toEqual({ type: 'error', kind: 'network', message: ASK_FAILED });
    // A body that breaks mid-read, not by the person: cut short.
    const broken = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('reset');
      },
    });
    api.fetch.mockResolvedValue(new Response(broken));
    expect(await ask().outcome).toEqual({ type: 'error', kind: 'other', message: ASK_CUT_SHORT });
  });

  it('rejects only when the person stopped it', async () => {
    const abort = new AbortController();
    api.fetch.mockImplementation(async () => {
      abort.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    await expect(ask(abort.signal).outcome).rejects.toThrow('aborted');
    const mid = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      pull() {
        mid.abort();
        throw new DOMException('aborted', 'AbortError');
      },
    });
    api.fetch.mockResolvedValue(new Response(body));
    await expect(ask(mid.signal).outcome).rejects.toThrow('aborted');
  });
});
