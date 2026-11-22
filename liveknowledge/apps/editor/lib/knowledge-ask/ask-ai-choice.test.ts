// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ASK_AI_CHOICE_PREFIX,
  answeredByLabel,
  askAiChoiceStore,
  offersAiChoice,
  keyChoiceDescription,
  keyChoiceLabel,
} from './ask-ai-choice';

// Which AI answers (docs/specs/030-knowledgebase/search-and-ask.md "Choosing which AI answers").
const who = { ownerId: 'u1', shareCode: null };
const models = [{ id: 'claude-fable-5-2', label: 'Claude Fable 5.2' }];

afterEach(() => {
  askAiChoiceStore.reset();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('askAiChoiceStore', () => {
  it('is the team key until chosen, kept per person and knowledgebase, telling each change once', () => {
    expect(askAiChoiceStore.get(who, 'd1')).toBe('key');
    const told = vi.fn();
    const stop = askAiChoiceStore.subscribe(told);
    askAiChoiceStore.set(who, 'd1', 'built-in');
    askAiChoiceStore.set(who, 'd1', 'built-in');
    expect(told).toHaveBeenCalledTimes(1);
    stop();
    expect(localStorage.getItem(`${ASK_AI_CHOICE_PREFIX}u1:d1`)).toBe('built-in');
    expect(askAiChoiceStore.get(who, 'd2')).toBe('key');
    expect(askAiChoiceStore.get({ ownerId: 'u2', shareCode: null }, 'd1')).toBe('key');
    askAiChoiceStore.reset();
    expect(askAiChoiceStore.get(who, 'd1')).toBe('built-in');
  });

  it('reads a value it does not know, or storage that throws, as the team key, and still keeps a choice', () => {
    localStorage.setItem(`${ASK_AI_CHOICE_PREFIX}u1:d1`, 'something-else');
    expect(askAiChoiceStore.get(who, 'd1')).toBe('key');
    askAiChoiceStore.reset();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(askAiChoiceStore.get(who, 'd1')).toBe('key');
    askAiChoiceStore.set(who, 'd1', 'built-in');
    expect(askAiChoiceStore.get(who, 'd1')).toBe('built-in');
  });
});

describe('the words', () => {
  it('offers a choice only with a key that answers and built-in AI both', () => {
    expect(offersAiChoice({ hasKey: true, builtIn: true })).toBe(true);
    expect(offersAiChoice({ hasKey: false, builtIn: true })).toBe(false);
    expect(offersAiChoice({ hasKey: true, builtIn: false })).toBe(false);
    expect(offersAiChoice({ hasKey: false, builtIn: true, uses: 'team' })).toBe(true);
    expect(offersAiChoice({ hasKey: false, builtIn: true, uses: 'personal' })).toBe(true);
    expect(offersAiChoice({ hasKey: false, builtIn: true, uses: 'built-in' })).toBe(false);
    expect(offersAiChoice({ hasKey: false, builtIn: false, uses: 'team' })).toBe(false);
  });

  it('names the key by its model and whose it is', () => {
    const kb = { hasKey: true, model: 'claude-fable-5-2', models };
    expect(keyChoiceLabel(kb)).toBe('Claude Fable 5.2 (Knowledgebase Key)');
    expect(keyChoiceLabel({ ...kb, model: 'retired' })).toBe('Knowledgebase Key');
    const shared = { hasKey: false, model: 'claude-fable-5-2', models };
    expect(keyChoiceLabel({ ...shared, uses: 'team', usesModelLabel: 'GPT-6 Luna' })).toBe(
      'GPT-6 Luna (Team Key)',
    );
    expect(
      keyChoiceLabel({ ...shared, uses: 'personal', usesModelLabel: 'Claude Haiku 5.5' }),
    ).toBe('Claude Haiku 5.5 (Your Key)');
    expect(keyChoiceLabel({ ...shared, uses: 'personal' })).toBe('Your Key');
    expect(keyChoiceDescription({ hasKey: true })).toMatch(/^This knowledgebase's own AI key/);
    expect(keyChoiceDescription({ hasKey: false, uses: 'team' })).toMatch(/^Your team's AI key/);
    expect(keyChoiceDescription({ hasKey: false, uses: 'personal' })).toMatch(/billed to you/);
  });

  it('says which AI answered', () => {
    expect(answeredByLabel({ provider: 'built-in', model: 'x' }, { models })).toBe('Built-In AI');
    expect(answeredByLabel({ provider: 'anthropic', model: 'claude-fable-5-2' }, { models })).toBe(
      'Claude Fable 5.2',
    );
    expect(
      answeredByLabel(
        { provider: 'openai', model: 'gpt-6-luna' },
        { models, usesModel: 'gpt-6-luna', usesModelLabel: 'GPT-6 Luna' },
      ),
    ).toBe('GPT-6 Luna');
    expect(answeredByLabel({ provider: 'openai', model: 'gone' }, { models })).toBe('AI Key');
    expect(answeredByLabel({ model: 'claude-fable-5-2' }, { models })).toBeNull();
  });
});
