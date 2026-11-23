import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { answerEvents, errorResponse, fakeFetch, streamResponse } from '@liveworkspace/ai/testing';
import type { KeyAnswer } from '@liveworkspace/ai';
import { readEvents } from '../events';
import { ASK_MAX_BODY_CHARS, ASK_MAX_QUESTION_CHARS } from '../limits';
import { isAskEvent, type AskEvent } from '../wire';
import { ASK_WORDS, serveAsk, type AskDoor } from './serve-ask';

// Planted wherever a key goes: it must reach the provider's own request and nothing else.
const KEY = 'sk-ant-PLANTED-KEY-0000-do-not-leak';

const passages = [
  {
    id: 't1:a',
    tabId: 't1',
    tabName: 'Flow',
    elementId: 'a',
    kind: 'Shape',
    title: 'Payment Service',
    text: 'Waits for the provider.',
  },
  {
    id: 't1:b',
    tabId: 't1',
    tabName: 'Flow',
    elementId: 'b',
    kind: 'Shape',
    title: 'Retry Queue',
    text: 'Tries again.',
  },
];

const post = (body: unknown, init: RequestInit = {}) =>
  new Request('https://app.test/api/ask', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });

const builtInOf = (reply: unknown) => ({ run: vi.fn(async () => reply) });

const doorOf = (over: Partial<AskDoor> = {}): AskDoor => ({
  request: post({ question: 'What happens on a timeout?', passages }),
  accountId: 'acc_1',
  itemWord: 'canvas',
  aiKey: async () => ({ status: 'none' }),
  builtIn: builtInOf({ response: '<answer>It waits [1], then retries [2].</answer>' }),
  spend: async () => true,
  headers: { 'Access-Control-Allow-Origin': 'https://app.test' },
  now: () => Date.UTC(2026, 10, 23),
  ...over,
});

const eventsOf = async (res: Response): Promise<AskEvent[]> => {
  const events: AskEvent[] = [];
  for await (const event of readEvents(res.body!, isAskEvent)) events.push(event);
  return events;
};

let logged: unknown[][] = [];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, 'info').mockImplementation((...args) => void logged.push(args));
  vi.spyOn(console, 'warn').mockImplementation((...args) => void logged.push(args));
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/ask, before any model is called', () => {
  it('answers only a POST', async () => {
    const res = await serveAsk(doorOf({ request: new Request('https://app.test/api/ask') }));
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test');
    expect(
      (
        await serveAsk(
          doorOf({ request: new Request('https://app.test/api/ask'), headers: undefined }),
        )
      ).status,
    ).toBe(405);
  });

  it('refuses whoever is not a signed-in account', async () => {
    const spend = vi.fn(async () => true as const);
    const res = await serveAsk(doorOf({ accountId: null, spend }));
    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      error: 'ask_needs_account',
      message: ASK_WORDS.needsAccount,
    });
    expect(spend).not.toHaveBeenCalled();
  });

  it('refuses a body it cannot read, no question, and one too long', async () => {
    const refusal = async (request: Request) => {
      const res = await serveAsk(doorOf({ request }));
      const body: unknown = await res.json();
      return [res.status, body];
    };
    expect(await refusal(post('{not json'))).toEqual([
      400,
      { error: 'ask_invalid', message: ASK_WORDS.badBody },
    ]);
    expect(await refusal(post('[1]'))).toEqual([
      400,
      { error: 'ask_invalid', message: ASK_WORDS.badBody },
    ]);
    expect(await refusal(post('null'))).toEqual([
      400,
      { error: 'ask_invalid', message: ASK_WORDS.badBody },
    ]);
    expect(
      await refusal(post(JSON.stringify({ question: 'x', pad: 'p'.repeat(ASK_MAX_BODY_CHARS) }))),
    ).toEqual([400, { error: 'ask_invalid', message: ASK_WORDS.badBody }]);
    expect(await refusal(post({ question: '   ', passages }))).toEqual([
      400,
      { error: 'ask_invalid', message: ASK_WORDS.noQuestion },
    ]);
    expect(await refusal(post({ passages }))).toEqual([
      400,
      { error: 'ask_invalid', message: ASK_WORDS.noQuestion },
    ]);
    expect(
      await refusal(post({ question: 'q'.repeat(ASK_MAX_QUESTION_CHARS + 1), passages })),
    ).toEqual([400, { error: 'ask_invalid', message: ASK_WORDS.tooLong }]);
  });

  it('refuses a question that came with nothing to read', async () => {
    const res = await serveAsk(
      doorOf({ request: post({ question: 'Anything?', passages: [] }), itemWord: 'plan' }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: 'ask_nothing_to_read',
      message: 'This plan has no text to answer from yet. Add some and ask again.',
    });
  });
});

describe('POST /api/ask on built-in AI', () => {
  it('answers from the passages, streamed, with the sources it cites', async () => {
    const builtIn = builtInOf({
      response: '<answer>It retries [2], after waiting [1]. Not [7].</answer>',
    });
    const spend = vi.fn(async () => true as const);
    const aiKey = vi.fn(async (): Promise<KeyAnswer> => ({ status: 'none' }));
    const res = await serveAsk(doorOf({ builtIn, spend, aiKey }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test');
    const events = await eventsOf(res);
    const done = events[events.length - 1]!;
    expect(
      events
        .filter((e) => e.type === 'delta')
        .map((e) => (e as { text: string }).text)
        .join(''),
    ).toBe('It retries [1], after waiting [2]. Not.');
    expect(done).toEqual({
      type: 'done',
      text: 'It retries [1], after waiting [2]. Not.',
      sources: [
        { ...passages[1], number: 1 },
        { ...passages[0], number: 2 },
      ],
      provider: 'built-in',
      model: expect.any(String),
    });
    expect(aiKey).toHaveBeenCalledWith(null);
    expect(spend).toHaveBeenCalledWith('acc_1', Date.UTC(2026, 10, 23));
    // The model was told about a canvas, and sent the fenced passages.
    const [, input] = builtIn.run.mock.calls[0] as unknown as [
      string,
      { messages: { role: string; content: string }[] },
    ];
    expect(input.messages[0]!.content).toContain('questions about one canvas');
    expect(input.messages[input.messages.length - 1]!.content).toContain(
      '<passage number="2" tab="Flow" kind="Shape" title="Retry Queue">',
    );
  });

  it('is what answers when the person chose it, the key never asked for', async () => {
    const aiKey = vi.fn(async (): Promise<KeyAnswer> => ({ status: 'unavailable' }));
    const res = await serveAsk(
      doorOf({
        aiKey,
        request: post({ question: 'Q?', passages, ai: 'built-in', teamId: 'team_1' }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await eventsOf(res)).at(-1)!.type).toBe('done');
    expect(aiKey).not.toHaveBeenCalled();
  });

  it('is what answers for a caller accounts has no person for', async () => {
    const res = await serveAsk(doorOf({ aiKey: async () => null }));
    expect((await eventsOf(res)).at(-1)).toMatchObject({ type: 'done', provider: 'built-in' });
  });

  it('is refused where the server has none, at the cap, and when the count cannot be reached', async () => {
    const spend = vi.fn(async () => true as const);
    const none = await serveAsk(doorOf({ builtIn: null, spend }));
    expect([none.status, await none.json()]).toEqual([
      503,
      { error: 'ask_unavailable', message: ASK_WORDS.notSetUp },
    ]);
    expect(spend).not.toHaveBeenCalled();
    const builtIn = builtInOf({ response: 'x' });
    const capped = await serveAsk(doorOf({ builtIn, spend: async () => false }));
    expect([capped.status, await capped.json()]).toEqual([
      429,
      { error: 'ask_built_in_limit', message: ASK_WORDS.limit },
    ]);
    const down = await serveAsk(doorOf({ builtIn, spend: async () => 'unavailable' }));
    expect([down.status, await down.json()]).toEqual([
      503,
      { error: 'ask_unavailable', message: ASK_WORDS.countFailed },
    ]);
    expect(builtIn.run).not.toHaveBeenCalled();
  });

  it('says a failed call in fixed words', async () => {
    const builtIn = { run: vi.fn(async () => Promise.reject(new Error('binding detail'))) };
    const events = await eventsOf(await serveAsk(doorOf({ builtIn })));
    expect(events).toEqual([
      {
        type: 'error',
        kind: 'other',
        provider: 'built-in',
        message: "The built-in AI couldn't answer just now. Try again in a moment.",
      },
    ]);
    expect(JSON.stringify(logged)).not.toContain('binding detail');
  });
});

describe('POST /api/ask, whatever else goes wrong', () => {
  it('ends the stream with an error in fixed words', async () => {
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error('log sink down');
    });
    const events = await eventsOf(await serveAsk(doorOf()));
    expect(events.at(-1)).toEqual({
      type: 'error',
      kind: 'other',
      provider: 'built-in',
      message: "The built-in AI couldn't answer just now. Try again in a moment.",
    });
  });
});

describe('POST /api/ask on a key', () => {
  const keyed = (source: 'team' | 'account' = 'account'): KeyAnswer => ({
    status: 'key',
    source,
    provider: 'anthropic',
    model: 'claude-fable-5-2',
    key: KEY,
  });

  it("answers on the person's key through the provider's own address, spending no allowance", async () => {
    const { fetch, sent } = fakeFetch(() =>
      // The form's own tag arrives first, alone: nothing to show yet.
      streamResponse(answerEvents(['<ans', 'wer>It waits', ' [1].</answer>'])),
    );
    const spend = vi.fn(async () => true as const);
    const aiKey = vi.fn(async () => keyed('team'));
    const turns = [{ question: 'Earlier?', answer: 'Yes [1].' }, 'junk'];
    const res = await serveAsk(
      doorOf({
        aiKey,
        spend,
        through: fetch,
        builtIn: null,
        request: post({ question: 'What then?', passages, turns, teamId: 'team_1' }),
        now: undefined,
      }),
    );
    const events = await eventsOf(res);
    expect(events.at(-1)).toEqual({
      type: 'done',
      text: 'It waits [1].',
      sources: [{ ...passages[0], number: 1 }],
      provider: 'anthropic',
      model: 'claude-fable-5-2',
    });
    expect(aiKey).toHaveBeenCalledWith('team_1');
    expect(spend).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(new URL(sent[0]!.url).host).toBe('api.anthropic.com');
    expect(sent[0]!.headers['x-api-key']).toBe(KEY);
    // The earlier turn rode along, the junk did not.
    expect((sent[0]!.body.messages as unknown[]).length).toBe(3);
    // The key reached the provider and nothing else: no event, header or log line holds it.
    expect(JSON.stringify(events)).not.toContain(KEY);
    expect(JSON.stringify(logged)).not.toContain(KEY);
    expect(JSON.stringify(logged)).not.toContain('What then?');
    expect(JSON.stringify(logged)).not.toContain('Waits for the provider');
    expect(logged[0]![0]).toBe('[ask] answered');
  });

  it('a team id that is not one is not sent on', async () => {
    const aiKey = vi.fn(async (): Promise<KeyAnswer> => ({ status: 'none' }));
    await serveAsk(
      doorOf({ aiKey, request: post({ question: 'Q?', passages, teamId: 't'.repeat(300) }) }),
    );
    await serveAsk(doorOf({ aiKey, request: post({ question: 'Q?', passages, teamId: 7 }) }));
    await serveAsk(doorOf({ aiKey, request: post({ question: 'Q?', passages, teamId: '' }) }));
    expect(aiKey.mock.calls).toEqual([[null], [null], [null]]);
  });

  it('says a key the provider refused, with whose it is, and never falls back to built-in AI', async () => {
    const { fetch } = fakeFetch(() => errorResponse(401, 'authentication_error'));
    const builtIn = builtInOf({ response: 'x' });
    const events = await eventsOf(
      await serveAsk(doorOf({ aiKey: async () => keyed(), through: fetch, builtIn })),
    );
    expect(events).toEqual([
      {
        type: 'error',
        kind: 'ai_key_failed',
        provider: 'anthropic',
        message: 'Claude did not accept the API key. Replace it in Settings.',
        aiKey: { source: 'account', provider: 'anthropic', kind: 'bad-key' },
      },
    ]);
    expect(builtIn.run).not.toHaveBeenCalled();
    expect(JSON.stringify(events)).not.toContain(KEY);
    expect(JSON.stringify(logged)).not.toContain(KEY);
  });

  it('says a passing failure in its fixed words, with no key failure', async () => {
    const { fetch } = fakeFetch(() => errorResponse(529, 'overloaded_error'));
    const events = await eventsOf(
      await serveAsk(doorOf({ aiKey: async () => keyed(), through: fetch })),
    );
    expect(events).toEqual([
      {
        type: 'error',
        kind: 'overloaded',
        provider: 'anthropic',
        message: 'Claude is busy right now. Try again in a moment.',
      },
    ]);
  });

  it('refuses in words a key that will not open, and accounts that could not say', async () => {
    const spend = vi.fn(async () => true as const);
    const unreadable = await serveAsk(
      doorOf({ spend, aiKey: async () => ({ status: 'unreadable', source: 'team' }) }),
    );
    expect(unreadable.status).toBe(422);
    expect(await unreadable.json()).toEqual({
      error: 'ai_key_failed',
      message:
        "Your team's AI key could not be read. An admin can replace it in Settings, under AI.",
      aiKey: { source: 'team', provider: null, kind: 'unreadable' },
    });
    const down = await serveAsk(doorOf({ spend, aiKey: async () => ({ status: 'unavailable' }) }));
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({
      error: 'ask_unavailable',
      message: "Your AI key settings couldn't be reached just now. Try again in a moment.",
    });
    expect(spend).not.toHaveBeenCalled();
  });
});
