import { afterEach, describe, expect, it, vi } from 'vitest';
import { builtInAi, suggestOnBuiltIn } from './setup-built-in-ai';
import {
  setupDraftCountName,
  spendSetupDraft,
  spendSetupDraftIn,
  utcDay,
} from './setup-draft-count';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const STRUCTURE = {
  name: 'Handbook',
  pages: [{ id: 1, title: 'Getting Started', summary: 'First week.', headings: [], parent: null }],
};

describe('the built-in client', () => {
  it('is the AI binding, or none', () => {
    const AI = { run: vi.fn() };
    expect(builtInAi({ AI })).toBe(AI);
    expect(builtInAi({})).toBeNull();
    // A stand-in that is not on the loopback is ignored.
    expect(builtInAi({ AI, E2E_CLAUDE_STAND_IN: 'https://example.com:9' })).toBe(AI);
  });

  it("is the e2e stand-in's Workers AI route under the stack alone, before any binding", async () => {
    const sent: { url: string; body: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      sent.push({ url, body: init.body as string });
      return Response.json({ response: STRUCTURE });
    });
    const AI = { run: vi.fn() };
    const client = builtInAi({ AI, E2E_CLAUDE_STAND_IN: 'http://127.0.0.1:4555' })!;
    expect(await client.run('m', { a: 1 })).toEqual({ response: STRUCTURE });
    expect(sent).toEqual([
      { url: 'http://127.0.0.1:4555/workers-ai/run', body: '{"model":"m","input":{"a":1}}' },
    ]);
    expect(AI.run).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', async () => new Response('no', { status: 500 }));
    await expect(client.run('m', {})).rejects.toThrow('stand-in 500');
    // A streamed ask (Ask, the conflict check) is answered with the stand-in's event stream itself.
    vi.stubGlobal('fetch', async () => new Response('data: {"response":"Hi"}\n\n'));
    const streamed = await client.run('m', { stream: true });
    expect(streamed).toBeInstanceOf(ReadableStream);
    expect(await new Response(streamed as ReadableStream).text()).toBe(
      'data: {"response":"Hi"}\n\n',
    );
  });

  it('asks twice at most, and a binding that errs with a non-Error is failed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = vi.fn(async () => {
      // oxlint-disable-next-line typescript/only-throw-error -- a binding may throw anything; its name is all that is logged
      throw 'nope';
    });
    expect(await suggestOnBuiltIn({ run }, { description: 'x'.repeat(30), existing: [] })).toEqual({
      answer: 'failed',
      asks: 1,
    });
    const empty = vi.fn(async () => ({}));
    expect(
      await suggestOnBuiltIn({ run: empty }, { description: 'x'.repeat(30), existing: [] }),
    ).toEqual({ answer: 'no-structure', asks: 2 });
    expect(empty).toHaveBeenCalledTimes(2);
  });
});

describe("the account's count", () => {
  const storage = () => {
    const kept = new Map<string, unknown>();
    return {
      get: async (key: string) => kept.get(key),
      put: async (key: string, value: unknown) => void kept.set(key, value),
    } as unknown as DurableObjectStorage;
  };

  it('counts to the cap a UTC day, and starts again on the next', async () => {
    const s = storage();
    expect(await spendSetupDraftIn(s, '2026-11-21', 2)).toBe(true);
    expect(await spendSetupDraftIn(s, '2026-11-21', 2)).toBe(true);
    expect(await spendSetupDraftIn(s, '2026-11-21', 2)).toBe(false);
    expect(await spendSetupDraftIn(s, '2026-11-22', 2)).toBe(true);
    expect(utcDay(Date.UTC(2026, 10, 21, 23, 59))).toBe('2026-11-21');
    expect(setupDraftCountName('user_o')).toBe('~setup-drafts:user_o');
  });

  it('is unavailable with no room binding, or one that throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await spendSetupDraft({} as never, 'user_o')).toBe('unavailable');
    const throwing = {
      idFromName: (name: string) => name,
      get: () => ({
        spendSetupDraft: async () => {
          // oxlint-disable-next-line typescript/only-throw-error -- whatever the RPC throws, the count is unavailable
          throw 'gone';
        },
      }),
    };
    expect(await spendSetupDraft({ DOCUMENT_ROOM: throwing } as never, 'user_o')).toBe(
      'unavailable',
    );
  });
});
