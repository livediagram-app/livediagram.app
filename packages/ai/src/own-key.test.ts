import { describe, expect, it, vi } from 'vitest';
import {
  AI_KEY_FAILED,
  AI_KEY_UNREACHABLE_WORDS,
  aiKeyFailureWords,
  isKeyFailureKind,
  ownKeyOf,
  readAiKeyFailure,
  type AiKeyFailure,
} from './own-key';
import { modelFailureWords } from './model-failure';

const KEY = 'sk-ant-api03-planted-secret-key-4f2a';

describe('which AI a person’s call runs on', () => {
  it('runs on built-in AI with no one to ask for, or no key set', () => {
    expect(ownKeyOf(null)).toEqual({ status: 'built-in' });
    expect(ownKeyOf({ status: 'none' })).toEqual({ status: 'built-in' });
  });

  it('runs on the key that applies, through the provider’s own address only', async () => {
    const through = vi.fn(async () => new Response('ok'));
    const own = ownKeyOf(
      { status: 'key', source: 'team', provider: 'openai', model: 'not-a-model', key: KEY },
      through as unknown as typeof fetch,
    );
    if (own.status !== 'key') throw new Error('expected a key');
    expect(own.source).toBe('team');
    expect(own.provider).toBe('openai');
    // A stored model that is not the provider's reads as its default.
    expect(own.model).toBe(own.caller.model);
    expect(own.caller.apiKey).toBe(KEY);
    await expect(own.caller.fetch('https://evil.example/v1/responses')).rejects.toThrow(
      'outbound host refused',
    );
    await own.caller.fetch('https://api.openai.com/v1/responses');
    expect(through).toHaveBeenCalledTimes(1);
  });

  it('refuses in words when accounts could not say, or answered no key to a key ask', () => {
    for (const answer of [
      { status: 'unavailable' } as const,
      { status: 'key', source: 'account', provider: 'anthropic', model: 'm' } as const,
    ]) {
      expect(ownKeyOf(answer)).toEqual({
        status: 'refused',
        reason: 'unavailable',
        words: AI_KEY_UNREACHABLE_WORDS,
      });
    }
  });

  it('refuses a key that will not open, naming whose it is, and never falls back', () => {
    const own = ownKeyOf({ status: 'unreadable', source: 'team' });
    expect(own).toEqual({
      status: 'refused',
      reason: 'unreadable',
      failure: { source: 'team', provider: null, kind: 'unreadable' },
      words: "Your team's AI key could not be read. An admin can replace it in Settings, under AI.",
    });
    expect(JSON.stringify(own)).not.toContain(KEY);
  });
});

describe('a key’s failure', () => {
  it('is said in the provider’s fixed words, or that it would not open', () => {
    expect(aiKeyFailureWords({ source: 'account', provider: 'anthropic', kind: 'bad-key' })).toBe(
      modelFailureWords('anthropic', 'bad-key'),
    );
    expect(aiKeyFailureWords({ source: 'account', provider: null, kind: 'unreadable' })).toBe(
      'Your AI key could not be read. Replace it in Settings, under AI.',
    );
    expect(aiKeyFailureWords({ source: 'team', provider: 'openai', kind: 'unreadable' })).toContain(
      'An admin',
    );
    expect(aiKeyFailureWords({ source: 'item', provider: null, kind: 'unreadable' })).toContain(
      'An Editor',
    );
  });

  it('knows the kinds a person fixes in Settings', () => {
    expect(['bad-key', 'no-credit', 'model-unavailable', 'unreadable'].every(isKeyFailureKind)).toBe(
      true,
    );
    expect(['rate-limited', 'overloaded', 'refused', 'other', 7].some(isKeyFailureKind)).toBe(false);
  });

  it('is read back from a refusal’s body, and nothing else is', () => {
    const failure: AiKeyFailure = { source: 'account', provider: 'openai', kind: 'no-credit' };
    expect(readAiKeyFailure({ error: AI_KEY_FAILED, aiKey: failure })).toEqual(failure);
    expect(readAiKeyFailure({ error: AI_KEY_FAILED, aiKey: { ...failure, source: 'item' } })).toEqual({
      ...failure,
      source: 'item',
    });
    expect(
      readAiKeyFailure({ error: AI_KEY_FAILED, aiKey: { ...failure, provider: null } }),
    ).toEqual({ ...failure, provider: null });
    for (const body of [
      null,
      'ai_key_failed',
      { error: 'other', aiKey: failure },
      { error: AI_KEY_FAILED },
      { error: AI_KEY_FAILED, aiKey: 'x' },
      { error: AI_KEY_FAILED, aiKey: { ...failure, source: 'room' } },
      { error: AI_KEY_FAILED, aiKey: { ...failure, provider: 'gemini' } },
      { error: AI_KEY_FAILED, aiKey: { ...failure, kind: 'overloaded' } },
    ])
      expect(readAiKeyFailure(body)).toBeNull();
  });
});
