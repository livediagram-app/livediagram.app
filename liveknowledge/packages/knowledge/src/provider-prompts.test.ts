import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_MAX_TOKENS,
  BUILT_IN_MODEL,
  CLAUDE_MESSAGES_URL,
  OPENAI_RESPONSES_URL,
  callModel,
} from '@liveworkspace/ai';
import { answerEvents, fakeFetch, openAiEvents, streamResponse } from '@liveworkspace/ai/testing';
import { ASK_SYSTEM, askRequest } from './ask-request';
import {
  ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY,
  ASK_BUILT_IN_PER_PERSON_PER_DAY,
  CONFLICT_BUILT_IN_CHECKS_PER_DAY,
} from './built-in-limits';
import { CONFLICT_SYSTEM } from './conflict-request';
import { SETUP_BUILT_IN_MODEL } from './setup-built-in';
import { SETUP_SYSTEM } from './setup-request';

// liveknowledge's prompts on the shared model call (@liveworkspace/ai): the same bytes to either provider, and no
// prompt naming one (docs/specs/030-knowledgebase/blueprints/knowledge-package.md "Providers").
describe("liveknowledge's prompts on the shared call", () => {
  it('sends Ask the same prompt and conversation to each provider', async () => {
    const claude = fakeFetch(() => streamResponse(answerEvents(['Hello.'])));
    const openai = fakeFetch(() => streamResponse(openAiEvents(['Hello.'])));
    const request = askRequest({ question: 'When do we deploy?', passages: [] });
    await callModel({
      provider: 'anthropic',
      fetch: claude.fetch,
      apiKey: 'sk-ant-test-key-4f2a',
      model: 'claude-opus-5-5',
      request,
    });
    await callModel({
      provider: 'openai',
      fetch: openai.fetch,
      apiKey: 'sk-proj-test-key-9c1d',
      model: 'gpt-6.2-sol',
      request,
    });
    expect(claude.sent[0]!.url).toBe(CLAUDE_MESSAGES_URL);
    expect(openai.sent[0]!.url).toBe(OPENAI_RESPONSES_URL);
    expect(claude.sent[0]!.body.system).toBe(ASK_SYSTEM);
    expect(openai.sent[0]!.body.instructions).toBe(ASK_SYSTEM);
    expect(openai.sent[0]!.body.input).toEqual(claude.sent[0]!.body.messages);
  });

  it('names no provider in any prompt', () => {
    expect(ASK_SYSTEM + CONFLICT_SYSTEM + SETUP_SYSTEM).not.toMatch(/Claude|Anthropic|OpenAI|GPT/);
  });

  it('runs built-in AI on the one model, with caps below a key', () => {
    expect(SETUP_BUILT_IN_MODEL).toBe(BUILT_IN_MODEL);
    expect([
      ASK_BUILT_IN_PER_PERSON_PER_DAY,
      ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY,
      CONFLICT_BUILT_IN_CHECKS_PER_DAY,
      BUILT_IN_MAX_TOKENS,
    ]).toEqual([30, 100, 20, 2000]);
  });
});
