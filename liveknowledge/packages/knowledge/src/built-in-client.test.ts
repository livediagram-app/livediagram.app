import { describe, expect, it, vi } from 'vitest';
import {
  BUILT_IN_MAX_TOKENS,
  BUILT_IN_MODEL,
  builtInInput,
  callBuiltIn,
  type BuiltInAiBinding,
} from './built-in-client';
import {
  ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY,
  ASK_BUILT_IN_PER_PERSON_PER_DAY,
  CONFLICT_BUILT_IN_CHECKS_PER_DAY,
} from './built-in-limits';
import { askRequest } from './ask-request';
import { ModelCallError, modelFailureWords, BUILT_IN_FAILED_WORDS } from './model-failure';
import { callModel } from './model-providers';
import { SETUP_BUILT_IN_MODEL } from './setup-built-in';

const REQUEST = askRequest({
  question: 'When do we deploy?',
  passages: [],
  turns: [{ question: 'Before?', answer: 'Earlier [1].' }],
});

/** A server-sent event stream of these payloads, as the binding answers `stream: true`. */
function sse(payloads: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const payload of payloads) controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.close();
    },
  });
}

const binding = (answer: (input: object) => unknown): BuiltInAiBinding & { inputs: object[] } => {
  const inputs: object[] = [];
  return {
    inputs,
    run: (model, input) => {
      expect(model).toBe(BUILT_IN_MODEL);
      inputs.push(input);
      return Promise.resolve(answer(input));
    },
  };
};

const failure = async (call: Promise<unknown>) => {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ModelCallError);
  expect(error).toMatchObject({ provider: 'built-in', kind: 'other' });
  return error as ModelCallError;
};

describe('built-in AI', () => {
  it('is the one model, with caps below a key', () => {
    expect(SETUP_BUILT_IN_MODEL).toBe(BUILT_IN_MODEL);
    expect(BUILT_IN_MODEL).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect([
      ASK_BUILT_IN_PER_PERSON_PER_DAY,
      ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY,
      CONFLICT_BUILT_IN_CHECKS_PER_DAY,
      BUILT_IN_MAX_TOKENS,
    ]).toEqual([30, 100, 20, 2000]);
  });

  it("asks in Workers AI's chat shape: the system prompt first, streamed, thinking off", () => {
    const input = builtInInput(REQUEST);
    expect(input.messages[0]).toEqual({ role: 'system', content: REQUEST.system });
    expect(input.messages.slice(1)).toEqual(REQUEST.messages);
    expect(input).toMatchObject({
      max_tokens: BUILT_IN_MAX_TOKENS,
      stream: true,
      chat_template_kwargs: { enable_thinking: false },
    });
    expect(builtInInput({ ...REQUEST, maxTokens: 500 }).max_tokens).toBe(500);
  });

  it('reads both stream shapes as they arrive, and says when the answer was cut off', async () => {
    const pieces: string[] = [];
    const ai = binding(() =>
      sse([
        JSON.stringify({ response: 'We deploy ' }),
        ': a comment',
        JSON.stringify({ choices: [{ delta: { content: 'on Tuesdays.' } }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        JSON.stringify({ response: 7 }),
        '[DONE]',
      ]),
    );
    const reply = await callBuiltIn({ ai, request: REQUEST, onText: (t) => pieces.push(t) });
    expect(pieces).toEqual(['We deploy ', 'on Tuesdays.']);
    expect(reply).toEqual({
      text: 'We deploy on Tuesdays.',
      stopReason: 'end_turn',
      model: BUILT_IN_MODEL,
    });
    const cut = binding(() =>
      sse([JSON.stringify({ choices: [{ delta: { content: 'Half' }, finish_reason: 'length' }] })]),
    );
    expect((await callBuiltIn({ ai: cut, request: REQUEST })).stopReason).toBe('max_tokens');
  });

  it('reads an answer the binding did not stream, whole', async () => {
    const pieces: string[] = [];
    const ai = binding(() => ({ response: 'All at once.' }));
    const reply = await callBuiltIn({ ai, request: REQUEST, onText: (t) => pieces.push(t) });
    expect(reply.text).toBe('All at once.');
    expect(pieces).toEqual(['All at once.']);
    expect((await callBuiltIn({ ai, request: REQUEST })).text).toBe('All at once.');
  });

  it('fails in its own words, never the binding’s, for an error, no text, a broken stream', async () => {
    const thrown = await failure(
      callBuiltIn({
        ai: { run: () => Promise.reject(new Error('the request said secret things')) },
        request: REQUEST,
      }),
    );
    expect(thrown.message).toBe(BUILT_IN_FAILED_WORDS);
    expect(thrown.message).not.toContain('secret');
    await failure(callBuiltIn({ ai: binding(() => ({ nothing: 1 })), request: REQUEST }));
    await failure(callBuiltIn({ ai: binding(() => sse(['[DONE]'])), request: REQUEST }));
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('dropped'));
      },
    });
    await failure(callBuiltIn({ ai: binding(() => broken), request: REQUEST }));
    // The caller's own `onText` throwing is a failed call too.
    await failure(
      callBuiltIn({
        ai: binding(() => sse([JSON.stringify({ response: 'x' })])),
        request: REQUEST,
        onText: () => {
          throw new Error('drawn badly');
        },
      }),
    );
  });

  it('gives up on the timeout or the caller’s signal, and drops what arrives after', async () => {
    vi.useFakeTimers();
    try {
      let push: ((text: string) => void) | undefined;
      const encoder = new TextEncoder();
      const slow = new ReadableStream<Uint8Array>({
        start(controller) {
          push = (text) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: text })}\n\n`));
        },
      });
      const pieces: string[] = [];
      const call = callBuiltIn({
        ai: binding(() => slow),
        request: REQUEST,
        onText: (t) => pieces.push(t),
        timeoutMs: 1000,
      });
      const settled = failure(call);
      await vi.advanceTimersByTimeAsync(1000);
      await settled;
      push!('late');
      await vi.advanceTimersByTimeAsync(10);
      expect(pieces).toEqual([]);
      // A binding that never answers whole, given up on too.
      const never = callBuiltIn({ ai: { run: () => new Promise(() => {}) }, request: REQUEST });
      const gaveUp = failure(never);
      await vi.advanceTimersByTimeAsync(60_000);
      await gaveUp;
      const late = binding(() => ({ response: 'late' }));
      const abort = new AbortController();
      const stopped = failure(
        callBuiltIn({
          ai: {
            run: () =>
              new Promise((resolve) => setTimeout(() => resolve(late.run(BUILT_IN_MODEL, {})), 50)),
          },
          request: REQUEST,
          signal: abort.signal,
          onText: (t) => pieces.push(t),
        }),
      );
      abort.abort();
      await stopped;
      await vi.advanceTimersByTimeAsync(100);
      expect(pieces).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
    const aborted = new AbortController();
    aborted.abort();
    await failure(
      callBuiltIn({
        ai: binding(() => ({ response: 'x' })),
        request: REQUEST,
        signal: aborted.signal,
      }),
    );
  });

  it('is one of callModel’s providers, with its own words for every failure', async () => {
    const ai = binding(() => sse([JSON.stringify({ response: 'Through the one path.' })]));
    const pieces: string[] = [];
    const reply = await callModel({
      provider: 'built-in',
      ai,
      request: REQUEST,
      onText: (t) => pieces.push(t),
      signal: new AbortController().signal,
    });
    expect(reply.text).toBe('Through the one path.');
    expect(pieces).toEqual(['Through the one path.']);
    expect((await callModel({ provider: 'built-in', ai, request: REQUEST })).model).toBe(
      BUILT_IN_MODEL,
    );
    for (const kind of ['bad-key', 'no-credit', 'other'] as const)
      expect(modelFailureWords('built-in', kind)).toBe(BUILT_IN_FAILED_WORDS);
  });
});
