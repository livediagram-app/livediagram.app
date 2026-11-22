import { describe, expect, it } from 'vitest';
import { fakeFetch, streamResponse } from './__fixtures__/claude';
import {
  openAiErrorEvent,
  openAiErrorResponse,
  openAiEvents,
  openAiOpening,
  openAiRefusal,
} from './__fixtures__/openai';
import type { ModelFailureKind } from './model-failure';
import type { ModelRequest } from './model-request';
import { OpenAiCallError, callOpenAi, openAiFailureKind, openAiHeaders } from './openai-client';
import { DEFAULT_OPENAI_MODEL, OPENAI_MODELS, openAiModel } from './openai-models';
import { OPENAI_RESPONSES_URL, openAiRequest } from './openai-request';

const KEY = 'sk-proj-not-a-real-key-9c1d';
const asked: ModelRequest = {
  system: 'Be brief.',
  messages: [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello.' },
    { role: 'user', content: 'Again' },
  ],
  maxTokens: 1000,
  effort: 'low',
};
const request = (model: unknown = 'gpt-6.2-astra') => openAiRequest(model, asked);

const failure = async (respond: () => Response | Promise<Response>): Promise<OpenAiCallError> => {
  const { fetch } = fakeFetch(respond);
  try {
    await callOpenAi({ fetch, apiKey: KEY, request: request() });
  } catch (error) {
    return error as OpenAiCallError;
  }
  throw new Error('did not fail');
};

describe('the OpenAI models a team may choose', () => {
  it('defaults to the most capable, and reads an unknown setting as the default', () => {
    expect(DEFAULT_OPENAI_MODEL).toBe('gpt-6.2-astra');
    expect(OPENAI_MODELS[0]!.id).toBe(DEFAULT_OPENAI_MODEL);
    expect(OPENAI_MODELS.map((m) => m.id)).toEqual([
      'gpt-6.2-astra',
      'gpt-6.2-sol',
      'gpt-6.1-terra',
      'gpt-6-luna',
    ]);
    expect(openAiModel('gpt-6-luna').name).toBe('GPT-6 Luna');
    expect(openAiModel('claude-fable-5-2').id).toBe(DEFAULT_OPENAI_MODEL);
    expect(openAiModel(undefined).id).toBe(DEFAULT_OPENAI_MODEL);
  });
});

describe('a request', () => {
  it('is a streamed Responses request that is not stored, the system prompt as instructions', () => {
    expect(request('gpt-6.2-sol')).toEqual({
      model: 'gpt-6.2-sol',
      instructions: 'Be brief.',
      input: asked.messages,
      max_output_tokens: 1000,
      stream: true,
      store: false,
      reasoning: { effort: 'low' },
    });
  });

  it('carries the key as a bearer token and in no other header', () => {
    expect(openAiHeaders(KEY)).toEqual({
      'content-type': 'application/json',
      authorization: `Bearer ${KEY}`,
    });
  });
});

describe('a call', () => {
  it('posts to the Responses API with the key in its header, and reads the streamed text', async () => {
    const { fetch, sent } = fakeFetch(() =>
      streamResponse(
        openAiEvents(['We deploy ', 'on Tuesdays ', '[1].'], { model: 'gpt-6.2-sol' }),
      ),
    );
    const pieces: string[] = [];
    const reply = await callOpenAi({
      fetch,
      apiKey: KEY,
      request: request('gpt-6.2-sol'),
      onText: (piece) => pieces.push(piece),
    });
    expect(reply).toEqual({
      text: 'We deploy on Tuesdays [1].',
      stopReason: 'end_turn',
      model: 'gpt-6.2-sol',
    });
    expect(pieces).toEqual(['We deploy ', 'on Tuesdays ', '[1].']);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe(OPENAI_RESPONSES_URL);
    expect(new URL(sent[0]!.url).host).toBe('api.openai.com');
    expect(sent[0]!.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(sent[0]!.body).toEqual(request('gpt-6.2-sol'));
    expect(JSON.stringify(sent[0]!.body)).not.toContain(KEY);
  });

  it('reads a stream however it is cut, and passes the signal on', async () => {
    const events = openAiEvents(['Zürich ', 'is 🇨🇭 ', 'fine.']);
    for (const chunk of [1, 3, 7, 4096]) {
      const signals: unknown[] = [];
      const fetch = (async (_url: string, init: { signal?: AbortSignal }) => {
        signals.push(init.signal);
        return streamResponse(events, chunk);
      }) as unknown as typeof globalThis.fetch;
      const controller = new AbortController();
      const reply = await callOpenAi({
        fetch,
        apiKey: KEY,
        request: request(),
        signal: controller.signal,
      });
      expect(reply.text, `chunk ${chunk}`).toBe('Zürich is 🇨🇭 fine.');
      expect(signals).toEqual([controller.signal]);
    }
  });

  it('skips lines it cannot read, and a delta that is not text', async () => {
    const [head, tail] = openAiEvents(['ok']).split('event: response.completed');
    const events = `${head}data: [DONE]\n\ndata: 7\n\ndata: {"type":"response.output_text.delta","delta":5}\n\nevent: response.completed${tail}`;
    const { fetch } = fakeFetch(() => streamResponse(events));
    expect((await callOpenAi({ fetch, apiKey: KEY, request: request() })).text).toBe('ok');
  });

  it('returns an answer cut off at the token ceiling, as far as it got', async () => {
    const { fetch } = fakeFetch(() =>
      streamResponse(openAiEvents(['Half an ans'], { end: 'max_output_tokens' })),
    );
    expect(await callOpenAi({ fetch, apiKey: KEY, request: request() })).toMatchObject({
      text: 'Half an ans',
      stopReason: 'max_tokens',
    });
  });

  it('maps each failure to a kind a person can be told', async () => {
    const cases: [number, { type?: string; code?: string }, ModelFailureKind][] = [
      [401, { code: 'invalid_api_key' }, 'bad-key'],
      [401, {}, 'bad-key'],
      [429, { type: 'insufficient_quota', code: 'insufficient_quota' }, 'no-credit'],
      [429, { code: 'credit_balance_exhausted' }, 'no-credit'],
      [429, { code: 'organization_spend_limit_exceeded' }, 'no-credit'],
      [429, { code: 'project_spend_limit_exceeded' }, 'no-credit'],
      [429, { code: 'organization_usage_limit_exceeded' }, 'no-credit'],
      [429, { code: 'rate_limit_exceeded' }, 'rate-limited'],
      [429, { type: 'rate_limit_error', code: 'slow_down' }, 'rate-limited'],
      [429, {}, 'rate-limited'],
      [503, { type: 'service_unavailable_error', code: 'server_is_overloaded' }, 'overloaded'],
      [503, {}, 'overloaded'],
      [404, { code: 'model_not_found' }, 'model-unavailable'],
      [404, {}, 'model-unavailable'],
      [403, {}, 'other'],
      [400, {}, 'other'],
      [500, {}, 'other'],
    ];
    for (const [status, body, kind] of cases) {
      const error = await failure(() => openAiErrorResponse(status, body));
      expect(error, `${status} ${body.code ?? ''}`).toBeInstanceOf(OpenAiCallError);
      expect(error.kind, `${status} ${body.code ?? ''}`).toBe(kind);
      expect(error.status).toBe(status);
      expect(error.provider).toBe('openai');
    }
  });

  it('reads the kind from the type when there is no code, and from the status when the body says nothing', () => {
    expect(openAiFailureKind(429, { error: { type: 'insufficient_quota' } })).toBe('no-credit');
    expect(openAiFailureKind(429, { error: { code: 7, type: 7 } })).toBe('rate-limited');
    expect(openAiFailureKind(401, null)).toBe('bad-key');
    expect(openAiFailureKind(418, {})).toBe('other');
    expect(openAiFailureKind(undefined, undefined)).toBe('other');
  });

  it('fails as a kind when the body is not JSON, or there is no body', async () => {
    expect(
      (await failure(() => new Response('<html>Bad gateway</html>', { status: 502 }))).kind,
    ).toBe('other');
    expect((await failure(() => new Response(null, { status: 200 }))).kind).toBe('other');
  });

  it('fails on an error sent mid-stream, and on a response that failed', async () => {
    const overloaded = openAiOpening(['Half an ans']) + openAiErrorEvent('server_is_overloaded');
    expect((await failure(() => streamResponse(overloaded))).kind).toBe('overloaded');
    const unnamed = openAiOpening(['Half an ans']) + openAiErrorEvent(null);
    expect((await failure(() => streamResponse(unnamed))).kind).toBe('other');
    const limited = openAiEvents(['Half'], { end: 'failed', failedCode: 'rate_limit_exceeded' });
    expect((await failure(() => streamResponse(limited))).kind).toBe('rate-limited');
    const broke = openAiEvents(['Half'], { end: 'failed' });
    expect((await failure(() => streamResponse(broke))).kind).toBe('other');
    const bare = `${openAiOpening([])}data: {"type":"response.failed"}\n\n`;
    expect((await failure(() => streamResponse(bare))).kind).toBe('other');
  });

  it('fails when the stream ends early, or breaks', async () => {
    expect((await failure(() => streamResponse(openAiOpening(['Half an ans'])))).kind).toBe(
      'other',
    );
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(openAiOpening(['Half'])));
        controller.error(new Error('socket hang up'));
      },
    });
    const error = await failure(() => new Response(broken, { status: 200 }));
    expect(error.kind).toBe('other');
    expect(error.message).not.toContain('socket');
  });

  it('fails as refused when the model declines, a filter stops it, or policy fails it', async () => {
    const refusal = await failure(() => streamResponse(openAiRefusal()));
    expect(refusal.kind).toBe('refused');
    expect(refusal.message).toBe('OpenAI declined to answer this.');
    const filtered = openAiEvents(['Some'], { end: 'content_filter' });
    expect((await failure(() => streamResponse(filtered))).kind).toBe('refused');
    const policy = openAiEvents([], { end: 'failed', failedCode: 'invalid_prompt' });
    expect((await failure(() => streamResponse(policy))).kind).toBe('refused');
    const unexplained = `${openAiOpening([])}data: {"type":"response.incomplete"}\n\n`;
    expect((await failure(() => streamResponse(unexplained))).kind).toBe('refused');
  });

  it('names OpenAI where the provider matters', async () => {
    const error = await failure(() => openAiErrorResponse(401, { code: 'invalid_api_key' }));
    expect(error.message).toBe('OpenAI did not accept the API key. Replace it in Settings.');
    expect(error.name).toBe('OpenAiCallError');
  });

  it('never carries the key, or what the network or the API said, in an error', async () => {
    const errors = [
      await failure(() => {
        throw new TypeError(`fetch failed: authorization Bearer ${KEY}`);
      }),
      await failure(() => openAiErrorResponse(401, { code: 'invalid_api_key' })),
      await failure(
        () =>
          new Response(
            `{"error":{"message":"Incorrect API key provided: ${KEY}","type":"x","code":null}}`,
            { status: 500 },
          ),
      ),
      await failure(() =>
        streamResponse(
          `${openAiOpening([])}data: {"type":"error","code":null,"message":"${KEY}"}\n\n`,
        ),
      ),
    ];
    expect(errors.map((e) => e.kind)).toEqual(['other', 'bad-key', 'other', 'other']);
    for (const error of errors) {
      const everything = JSON.stringify({
        ...error,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      expect(everything).not.toContain(KEY);
      expect(everything).not.toContain('API said');
      expect(everything).not.toContain('Incorrect API key');
    }
  });
});
