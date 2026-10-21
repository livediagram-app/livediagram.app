import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_BASE_URL,
  GOOGLE_DEFAULT_MODEL,
  OPENAI_BASE_URL,
  OPENAI_DEFAULT_MODEL,
  aiConfigured,
  resolveAiProvider,
} from './ai-provider';
import type { Env } from './types';

// Whose model serves the assistant (docs/specs/007-editor/ai-assistance.md)? The keys answer it.
// What is pinned here is that each preset stands on its own, that the first key in the preference
// order wins, and that a half-configured generic is not a configuration.

const env = (over: Partial<Env>) => over as Env;
const BOTH = { GOOGLE_AI_STUDIO_API_KEY: 'g', OPENAI_API_KEY: 'o' };

afterEach(() => vi.restoreAllMocks());

describe('the presets', () => {
  it('resolves Google from its own key, at its own endpoint', () => {
    expect(resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'k' }))).toEqual({
      provider: 'google',
      baseUrl: GOOGLE_BASE_URL,
      apiKey: 'k',
      model: GOOGLE_DEFAULT_MODEL,
      strictSchema: true,
    });
  });

  it('resolves OpenAI from its own key, a self-hoster on OpenAI changes nothing', () => {
    expect(resolveAiProvider(env({ OPENAI_API_KEY: 'sk-x' }))).toEqual({
      provider: 'openai',
      baseUrl: OPENAI_BASE_URL,
      apiKey: 'sk-x',
      model: OPENAI_DEFAULT_MODEL,
      strictSchema: true,
    });
  });

  it('resolves anything else from a key, a base URL and a model', () => {
    const out = resolveAiProvider(
      env({ AI_API_KEY: 'k', AI_BASE_URL: 'http://127.0.0.1:8080/v1', AI_MODEL: 'local' }),
    );
    expect(out).toEqual({
      provider: 'generic',
      baseUrl: 'http://127.0.0.1:8080/v1',
      apiKey: 'k',
      model: 'local',
      strictSchema: false,
    });
  });

  it('tolerates the trailing slash somebody pasted out of a provider’s docs', () => {
    const out = resolveAiProvider(
      env({ AI_API_KEY: 'k', AI_BASE_URL: 'http://127.0.0.1:8080/v1///', AI_MODEL: 'local' }),
    );
    expect(out?.baseUrl).toBe('http://127.0.0.1:8080/v1');
  });
});

describe('two named keys', () => {
  it('the assistant takes OpenAI', () => {
    expect(resolveAiProvider(env(BOTH))).toMatchObject({
      provider: 'openai',
      apiKey: 'o',
      model: OPENAI_DEFAULT_MODEL,
    });
  });

  it('is a configuration, not a mistake: nothing is logged', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    resolveAiProvider(env(BOTH));
    expect(error).not.toHaveBeenCalled();
  });
});

describe('the generic key is the last resort', () => {
  const generic = { AI_API_KEY: 'x', AI_BASE_URL: 'http://x/v1', AI_MODEL: 'local' };

  it('a named key outranks it, and the dead secret is reported', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = resolveAiProvider(env({ ...generic, GOOGLE_AI_STUDIO_API_KEY: 'g' }));
    expect(out?.provider).toBe('google');
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toContain('[ai] AI_API_KEY is set but unused');
  });

  it('never prints a key while reporting it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    resolveAiProvider(env({ ...generic, AI_API_KEY: 'super-secret', OPENAI_API_KEY: 'also' }));
    const logged = error.mock.calls.flat().map(String).join(' ');
    expect(logged).not.toContain('super-secret');
    expect(logged).not.toContain('also');
  });
});

describe('what is NOT a configuration', () => {
  it('no key at all', () => {
    expect(resolveAiProvider(env({}))).toBeNull();
  });

  it('an empty key is no key', () => {
    expect(resolveAiProvider(env({ OPENAI_API_KEY: '' }))).toBeNull();
  });

  it('an empty named key does not outrank a real one', () => {
    const out = resolveAiProvider(env({ OPENAI_API_KEY: '', GOOGLE_AI_STUDIO_API_KEY: 'g' }));
    expect(out?.provider).toBe('google');
  });

  it('a generic key with nowhere to send it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveAiProvider(env({ AI_API_KEY: 'k', AI_MODEL: 'm' }))).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('a generic key with nothing to ask for', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveAiProvider(env({ AI_API_KEY: 'k', AI_BASE_URL: 'http://x/v1' }))).toBeNull();
  });
});

describe('aiConfigured', () => {
  it('is true for any usable key, alone or together', () => {
    expect(aiConfigured(env({ GOOGLE_AI_STUDIO_API_KEY: 'g' }))).toBe(true);
    expect(aiConfigured(env({ OPENAI_API_KEY: 'o' }))).toBe(true);
    expect(aiConfigured(env(BOTH))).toBe(true);
  });

  it('is false with no usable key', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(aiConfigured(env({}))).toBe(false);
    expect(aiConfigured(env({ AI_API_KEY: 'k' }))).toBe(false);
  });
});

describe('which model', () => {
  it('AI_MODEL overrides the assistant’s default', () => {
    const out = resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'k', AI_MODEL: 'gemini-pro' }));
    expect(out?.model).toBe('gemini-pro');
  });
});
