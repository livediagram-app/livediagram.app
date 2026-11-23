import { describe, expect, it } from 'vitest';
import { answerEvents, errorResponse, fakeFetch, streamResponse } from './testing/claude';
import { openAiEvents } from './testing/openai';
import { KEYED_MIN_TOKENS, keyedRequest, keyedRunner } from './keyed-runner';
import { ModelCallError } from './model-failure';
import { claudeRequest } from './claude-request';
import { openAiRequest } from './openai-request';
import { builtInInput } from './built-in-client';
import { messageText } from './model-request';

const KEY = 'sk-ant-api03-planted-secret-key-4f2a';
const SCHEMA = { type: 'object', properties: { name: { type: 'string' } } };

const draftAsk = {
  messages: [
    { role: 'system', content: 'You draft plans.' },
    { role: 'user', content: 'A hiring pipeline' },
  ],
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'plan', schema: SCHEMA, strict: true },
  },
  max_tokens: 2000,
  temperature: 0,
};

describe('a Workers AI request asked on a key', () => {
  it('keeps the system words, says the schema in words, and leaves room for thinking', () => {
    const request = keyedRequest(draftAsk);
    expect(request.system).toContain('You draft plans.');
    expect(request.system).toContain(JSON.stringify(SCHEMA));
    expect(request.messages).toEqual([{ role: 'user', content: 'A hiring pipeline' }]);
    expect(request.maxTokens).toBe(4000);
    expect(request.effort).toBe('low');
    expect(keyedRequest({ max_tokens: 5000 }, 'high')).toEqual({
      system: '',
      messages: [],
      maxTokens: 10_000,
      effort: 'high',
    });
  });

  it('asks for JSON in words in JSON mode, and reads any content as text', () => {
    const request = keyedRequest({
      messages: [
        { role: 'system', content: { a: 1 } },
        { role: 'assistant', content: null },
        { role: 'user', content: 'go' },
      ],
      response_format: { type: 'json_object' },
    });
    expect(request.system).toBe(
      '{"a":1}\n\nReply with one JSON object only, no prose and no code fence.',
    );
    expect(request.messages).toEqual([
      { role: 'assistant', content: '' },
      { role: 'user', content: 'go' },
    ]);
    expect(request.maxTokens).toBe(KEYED_MIN_TOKENS);
  });

  it('answers in the binding’s `{ response }` shape, on Claude', async () => {
    const { fetch, sent } = fakeFetch(() =>
      streamResponse(answerEvents(['{"name":', '"Hiring"}'])),
    );
    const runner = keyedRunner({
      provider: 'anthropic',
      fetch,
      apiKey: KEY,
      model: 'claude-opus-5-5',
    });
    expect(await runner.run('@cf/ignored', draftAsk)).toEqual({ response: '{"name":"Hiring"}' });
    expect(sent[0]!.body['model']).toBe('claude-opus-5-5');
    expect(sent[0]!.headers['x-api-key']).toBe(KEY);
  });

  it('answers on OpenAI too', async () => {
    const { fetch } = fakeFetch(() => streamResponse(openAiEvents(['{"name":"Hiring"}'])));
    const runner = keyedRunner({ provider: 'openai', fetch, apiKey: KEY, model: 'gpt-6.2-astra' });
    expect(await runner.run('@cf/ignored', draftAsk)).toEqual({ response: '{"name":"Hiring"}' });
  });

  it('throws the provider’s failure, in fixed words with no key', async () => {
    const { fetch } = fakeFetch(() => errorResponse(401, 'authentication_error'));
    const runner = keyedRunner({ provider: 'anthropic', fetch, apiKey: KEY, model: 'x' });
    const failed = await runner.run('m', draftAsk).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(ModelCallError);
    expect((failed as ModelCallError).kind).toBe('bad-key');
    expect(String(failed)).not.toContain(KEY);
  });
});

describe('a message with a picture', () => {
  const picture = {
    role: 'user' as const,
    content: [
      { type: 'text' as const, text: 'Crop 1:' },
      { type: 'image' as const, mediaType: 'image/jpeg', data: 'AAAA' },
    ],
  };

  it('goes to Claude as an image block with its bytes inline', () => {
    const body = claudeRequest({
      model: 'x',
      system: 's',
      messages: [picture],
      maxTokens: 10,
      effort: 'low',
    });
    expect(body.messages[0]!.content).toEqual([
      { type: 'text', text: 'Crop 1:' },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
    ]);
  });

  it('goes to OpenAI as an input image with a data URL', () => {
    const body = openAiRequest('x', {
      system: 's',
      messages: [picture],
      maxTokens: 10,
      effort: 'low',
    });
    expect(body.input[0]!.content).toEqual([
      { type: 'input_text', text: 'Crop 1:' },
      { type: 'input_image', image_url: 'data:image/jpeg;base64,AAAA' },
    ]);
  });

  it('goes to built-in AI as its text alone', () => {
    const input = builtInInput({ system: 's', messages: [picture], maxTokens: 10, effort: 'low' });
    expect(input.messages[1]).toEqual({ role: 'user', content: 'Crop 1:\n' });
    expect(messageText('plain')).toBe('plain');
  });
});
