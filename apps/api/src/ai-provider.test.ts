import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_BASE_URL,
  GOOGLE_DEFAULT_MODEL,
  OPENAI_BASE_URL,
  OPENAI_DEFAULT_MODEL,
  resolveAiProvider,
} from './ai-provider';
import type { Env } from './types';

// Whose model is this (spec/25)? The key answers it. What is pinned here is
// that each preset stands on its own, that a half-configured generic is not a
// configuration, and — the one with money attached — that two keys resolve to
// NOTHING rather than to a coin flip.

const env = (over: Partial<Env>) => over as Env;

afterEach(() => vi.restoreAllMocks());

describe('the presets', () => {
  it('resolves Google from its own key, at its own endpoint', () => {
    const out = resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'k' }));
    expect(out).toEqual({
      provider: 'google',
      baseUrl: GOOGLE_BASE_URL,
      apiKey: 'k',
      model: GOOGLE_DEFAULT_MODEL,
      visionModel: GOOGLE_DEFAULT_MODEL,
    });
  });

  it('resolves OpenAI from its own key — a self-hoster on OpenAI changes nothing', () => {
    const out = resolveAiProvider(env({ OPENAI_API_KEY: 'sk-x' }));
    expect(out).toMatchObject({
      provider: 'openai',
      baseUrl: OPENAI_BASE_URL,
      model: OPENAI_DEFAULT_MODEL,
    });
  });

  it('resolves anything else from a key, a base URL and a model', () => {
    const out = resolveAiProvider(
      env({ AI_API_KEY: 'k', AI_BASE_URL: 'http://127.0.0.1:8080/v1', AI_MODEL: 'local' }),
    );
    expect(out).toMatchObject({
      provider: 'generic',
      baseUrl: 'http://127.0.0.1:8080/v1',
      model: 'local',
    });
  });

  it('tolerates the trailing slash somebody pasted out of a provider’s docs', () => {
    const out = resolveAiProvider(
      env({ AI_API_KEY: 'k', AI_BASE_URL: 'http://127.0.0.1:8080/v1///', AI_MODEL: 'local' }),
    );
    expect(out?.baseUrl).toBe('http://127.0.0.1:8080/v1');
  });
});

describe('what is NOT a configuration', () => {
  it('no key at all — the self-host default', () => {
    expect(resolveAiProvider(env({}))).toBeNull();
  });

  it('an empty key is no key', () => {
    expect(resolveAiProvider(env({ OPENAI_API_KEY: '' }))).toBeNull();
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

  it('TWO keys — it refuses to guess whose budget to spend, loudly', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'g', OPENAI_API_KEY: 'o' })),
    ).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toContain('GOOGLE_AI_STUDIO_API_KEY');
    expect(String(error.mock.calls[0]![0])).toContain('OPENAI_API_KEY');
  });

  it('never prints the key itself', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'super-secret', OPENAI_API_KEY: 'also' }));
    expect(String(error.mock.calls[0]![0])).not.toContain('super-secret');
  });
});

describe('the model overrides', () => {
  it('AI_MODEL overrides any preset’s default', () => {
    const out = resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'k', AI_MODEL: 'gemini-pro' }));
    expect(out).toMatchObject({ model: 'gemini-pro', visionModel: 'gemini-pro' });
  });

  it('AI_VISION_MODEL splits the reader from the assistant', () => {
    const out = resolveAiProvider(
      env({ OPENAI_API_KEY: 'k', AI_MODEL: 'a', AI_VISION_MODEL: 'b' }),
    );
    expect(out).toMatchObject({ model: 'a', visionModel: 'b' });
  });
});
