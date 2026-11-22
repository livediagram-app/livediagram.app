import { describe, expect, it } from 'vitest';
import { answerEvents, errorResponse, fakeFetch, streamResponse } from './__fixtures__/claude';
import { openAiErrorResponse, openAiEvents } from './__fixtures__/openai';
import { ASK_SYSTEM, askRequest } from './ask-request';
import { CLAUDE_MESSAGES_URL } from './claude-request';
import { CONFLICT_SYSTEM } from './conflict-request';
import { ModelCallError, modelFailureWords, type ModelFailureKind } from './model-failure';
import {
  DEFAULT_MODEL_PROVIDER,
  MODEL_PROVIDERS,
  callModel,
  isModelProviderId,
  isProviderModel,
  modelProvider,
  providerModel,
} from './model-providers';
import type { ModelRequest } from './model-request';
import { OPENAI_RESPONSES_URL } from './openai-request';

const KEYS = {
  anthropic: 'sk-ant-api03-not-a-real-key-4f2a',
  openai: 'sk-proj-not-a-real-key-9c1d',
};
const asked: ModelRequest = {
  system: 'Be brief.',
  messages: [{ role: 'user', content: 'Hi' }],
  maxTokens: 1000,
  effort: 'low',
};
const KINDS: ModelFailureKind[] = [
  'bad-key',
  'no-credit',
  'rate-limited',
  'overloaded',
  'model-unavailable',
  'refused',
  'other',
];

describe('the providers', () => {
  it('are Anthropic and OpenAI, each on its own API host with its own models', () => {
    expect(MODEL_PROVIDERS.map((p) => [p.id, p.name, p.host, p.keyPrefix])).toEqual([
      ['anthropic', 'Anthropic (Claude)', 'api.anthropic.com', 'sk-ant-'],
      ['openai', 'OpenAI', 'api.openai.com', 'sk-'],
    ]);
    expect(new URL(CLAUDE_MESSAGES_URL).host).toBe(modelProvider('anthropic').host);
    expect(new URL(OPENAI_RESPONSES_URL).host).toBe(modelProvider('openai').host);
    for (const provider of MODEL_PROVIDERS) {
      expect(provider.models[0]!.id).toBe(provider.defaultModel);
      expect(provider.models.length).toBeLessThanOrEqual(5);
    }
  });

  it('read a setting stored before there was a choice as Anthropic', () => {
    expect(DEFAULT_MODEL_PROVIDER).toBe('anthropic');
    expect(modelProvider(null).id).toBe('anthropic');
    expect(modelProvider('gemini').id).toBe('anthropic');
    expect(modelProvider('openai').id).toBe('openai');
    expect(isModelProviderId('openai')).toBe(true);
    expect(isModelProviderId('gemini')).toBe(false);
    expect(isModelProviderId(undefined)).toBe(false);
  });

  it('keep a model to its own provider', () => {
    expect(isProviderModel('anthropic', 'claude-opus-5-5')).toBe(true);
    expect(isProviderModel('anthropic', 'gpt-6.2-sol')).toBe(false);
    expect(isProviderModel('openai', 'gpt-6.2-sol')).toBe(true);
    expect(isProviderModel('openai', 'claude-opus-5-5')).toBe(false);
    expect(providerModel('openai', 'claude-opus-5-5')).toEqual({
      id: 'gpt-6.2-astra',
      name: 'GPT-6.2 Astra',
    });
    expect(providerModel('anthropic', 'gpt-6.2-sol').id).toBe('claude-fable-5-2');
    expect(providerModel('anthropic', 'claude-haiku-5-5').name).toBe('Claude Haiku 5.5');
  });
});

describe('one call for both providers', () => {
  it('sends the same prompt and material to each, in its own request shape, to its own host', async () => {
    const claude = fakeFetch(() => streamResponse(answerEvents(['Hello.'])));
    const openai = fakeFetch(() => streamResponse(openAiEvents(['Hello.'])));
    const request = askRequest({ question: 'When do we deploy?', passages: [] });
    const fromClaude = await callModel({
      provider: 'anthropic',
      fetch: claude.fetch,
      apiKey: KEYS.anthropic,
      model: 'claude-opus-5-5',
      request,
    });
    const fromOpenAi = await callModel({
      provider: 'openai',
      fetch: openai.fetch,
      apiKey: KEYS.openai,
      model: 'gpt-6.2-sol',
      request,
    });
    expect(fromClaude.text).toBe('Hello.');
    expect(fromOpenAi.text).toBe('Hello.');
    expect(fromClaude.stopReason).toBe(fromOpenAi.stopReason);
    expect(claude.sent[0]!.url).toBe(CLAUDE_MESSAGES_URL);
    expect(openai.sent[0]!.url).toBe(OPENAI_RESPONSES_URL);
    expect(claude.sent[0]!.body.system).toBe(ASK_SYSTEM);
    expect(openai.sent[0]!.body.instructions).toBe(ASK_SYSTEM);
    expect(openai.sent[0]!.body.input).toEqual(claude.sent[0]!.body.messages);
    expect(claude.sent[0]!.body.model).toBe('claude-opus-5-5');
    expect(openai.sent[0]!.body.model).toBe('gpt-6.2-sol');
    // Each key reaches its own provider's header and nothing else.
    expect(claude.sent[0]!.headers['x-api-key']).toBe(KEYS.anthropic);
    expect(claude.sent[0]!.headers).not.toHaveProperty('authorization');
    expect(openai.sent[0]!.headers.authorization).toBe(`Bearer ${KEYS.openai}`);
    expect(openai.sent[0]!.headers).not.toHaveProperty('x-api-key');
    expect(ASK_SYSTEM + CONFLICT_SYSTEM).not.toMatch(/Claude|Anthropic|OpenAI|GPT/);
  });

  it('never asks one provider for the other provider model: a foreign id is the default', async () => {
    const openai = fakeFetch(() => streamResponse(openAiEvents(['ok'])));
    await callModel({
      provider: 'openai',
      fetch: openai.fetch,
      apiKey: KEYS.openai,
      model: 'claude-opus-5-5',
      request: asked,
    });
    expect(openai.sent[0]!.body.model).toBe('gpt-6.2-astra');
  });

  it('streams text and passes the signal for either', async () => {
    for (const provider of ['anthropic', 'openai'] as const) {
      const events = provider === 'openai' ? openAiEvents(['a', 'b']) : answerEvents(['a', 'b']);
      const signals: unknown[] = [];
      const fetch = (async (_url: string, init: { signal?: AbortSignal }) => {
        signals.push(init.signal);
        return streamResponse(events);
      }) as unknown as typeof globalThis.fetch;
      const controller = new AbortController();
      const pieces: string[] = [];
      await callModel({
        provider,
        fetch,
        apiKey: KEYS[provider],
        model: undefined,
        request: asked,
        signal: controller.signal,
        onText: (piece) => pieces.push(piece),
      });
      expect(pieces, provider).toEqual(['a', 'b']);
      expect(signals).toEqual([controller.signal]);
    }
  });

  it('fails in one error type with the same kinds, and never with a key in it', async () => {
    const respond = {
      anthropic: () => errorResponse(401, 'authentication_error'),
      openai: () => openAiErrorResponse(401, { code: 'invalid_api_key' }),
    };
    for (const provider of ['anthropic', 'openai'] as const) {
      const { fetch } = fakeFetch(respond[provider]);
      const error = await callModel({
        provider,
        fetch,
        apiKey: KEYS[provider],
        model: undefined,
        request: asked,
      }).then(
        () => undefined,
        (thrown: unknown) => thrown,
      );
      expect(error, provider).toBeInstanceOf(ModelCallError);
      const failed = error as ModelCallError;
      expect(failed.kind).toBe('bad-key');
      expect(failed.provider).toBe(provider);
      expect(failed.message).toBe(modelFailureWords(provider, 'bad-key'));
      const everything = JSON.stringify({
        ...failed,
        message: failed.message,
        stack: failed.stack,
      });
      expect(everything).not.toContain(KEYS[provider]);
    }
  });

  it('has words for every kind of both providers, naming the provider where it matters', () => {
    for (const provider of ['anthropic', 'openai'] as const)
      for (const kind of KINDS) expect(modelFailureWords(provider, kind)).toMatch(/\.$/);
    expect(modelFailureWords('openai', 'bad-key')).toContain('OpenAI did not accept');
    expect(modelFailureWords('anthropic', 'bad-key')).toContain('Claude did not accept');
    expect(modelFailureWords('openai', 'model-unavailable')).toBe(
      modelFailureWords('anthropic', 'model-unavailable'),
    );
    expect(new ModelCallError('openai', 'other').status).toBeUndefined();
  });
});
