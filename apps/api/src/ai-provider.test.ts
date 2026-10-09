import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_BASE_URL,
  GOOGLE_DEFAULT_MODEL,
  GOOGLE_DEFAULT_VISION_MODEL,
  OPENAI_BASE_URL,
  OPENAI_DEFAULT_MODEL,
  aiConfigured,
  resolveAiProvider,
} from './ai-provider';
import type { Runtime } from './types';

// Whose model serves which feature (docs/specs/007-editor/ai-assistance.md, "Each
// feature has its own provider")? The keys answer it. What is pinned here is
// that each preset stands on its own, that each feature takes the first key in
// its OWN preference order, that a half-configured generic is not a
// configuration, and that AI_MODEL never crosses from one provider to another.

const env = (over: Partial<Runtime>) => over as unknown as Runtime;
const BOTH = { GOOGLE_AI_STUDIO_API_KEY: 'g', OPENAI_API_KEY: 'o' };

afterEach(() => vi.restoreAllMocks());

describe('the presets', () => {
  it('resolves Google from its own key, at its own endpoint', () => {
    expect(resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'k' }), 'assistant')).toEqual({
      provider: 'google',
      baseUrl: GOOGLE_BASE_URL,
      apiKey: 'k',
      model: GOOGLE_DEFAULT_MODEL,
      strictSchema: true,
    });
  });

  it('resolves OpenAI from its own key, a self-hoster on OpenAI changes nothing', () => {
    expect(resolveAiProvider(env({ OPENAI_API_KEY: 'sk-x' }), 'assistant')).toEqual({
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
      'assistant',
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
      'assistant',
    );
    expect(out?.baseUrl).toBe('http://127.0.0.1:8080/v1');
  });
});

describe('one key serves both features', () => {
  it.each([
    ['google', { GOOGLE_AI_STUDIO_API_KEY: 'k' }],
    ['openai', { OPENAI_API_KEY: 'k' }],
    ['generic', { AI_API_KEY: 'k', AI_BASE_URL: 'http://x/v1', AI_MODEL: 'm' }],
  ] as const)('%s alone runs the assistant and the reader', (provider, keys) => {
    expect(resolveAiProvider(env(keys), 'assistant')?.provider).toBe(provider);
    expect(resolveAiProvider(env(keys), 'reader')?.provider).toBe(provider);
  });
});

describe('two named keys split the features', () => {
  it('the assistant keeps OpenAI', () => {
    expect(resolveAiProvider(env(BOTH), 'assistant')).toMatchObject({
      provider: 'openai',
      apiKey: 'o',
      model: OPENAI_DEFAULT_MODEL,
    });
  });

  it('the reader takes Google, with its reader default', () => {
    expect(resolveAiProvider(env(BOTH), 'reader')).toMatchObject({
      provider: 'google',
      apiKey: 'g',
      model: GOOGLE_DEFAULT_VISION_MODEL,
    });
  });

  it('is a configuration, not a mistake: nothing is logged', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    resolveAiProvider(env(BOTH), 'assistant');
    resolveAiProvider(env(BOTH), 'reader');
    expect(error).not.toHaveBeenCalled();
  });
});

describe('the generic key is the last resort', () => {
  const generic = { AI_API_KEY: 'x', AI_BASE_URL: 'http://x/v1', AI_MODEL: 'local' };

  it.each(['assistant', 'reader'] as const)(
    'a named key outranks it for the %s, and the dead secret is reported',
    (feature) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const out = resolveAiProvider(env({ ...generic, GOOGLE_AI_STUDIO_API_KEY: 'g' }), feature);
      expect(out?.provider).toBe('google');
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0]![0])).toContain('[ai] AI_API_KEY is set but unused');
    },
  );

  it('never prints a key while reporting it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    resolveAiProvider(
      env({ ...generic, AI_API_KEY: 'super-secret', OPENAI_API_KEY: 'also' }),
      'reader',
    );
    const logged = error.mock.calls.flat().map(String).join(' ');
    expect(logged).not.toContain('super-secret');
    expect(logged).not.toContain('also');
  });
});

describe('what is NOT a configuration', () => {
  it.each(['assistant', 'reader'] as const)('no key at all, for the %s', (feature) => {
    expect(resolveAiProvider(env({}), feature)).toBeNull();
  });

  it('an empty key is no key', () => {
    expect(resolveAiProvider(env({ OPENAI_API_KEY: '' }), 'assistant')).toBeNull();
  });

  it('an empty named key does not outrank a real one', () => {
    const out = resolveAiProvider(
      env({ OPENAI_API_KEY: '', GOOGLE_AI_STUDIO_API_KEY: 'g' }),
      'assistant',
    );
    expect(out?.provider).toBe('google');
  });

  it('a generic key with nowhere to send it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveAiProvider(env({ AI_API_KEY: 'k', AI_MODEL: 'm' }), 'assistant')).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('a generic key with nothing to ask for', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      resolveAiProvider(env({ AI_API_KEY: 'k', AI_BASE_URL: 'http://x/v1' }), 'reader'),
    ).toBeNull();
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
    const out = resolveAiProvider(
      env({ GOOGLE_AI_STUDIO_API_KEY: 'k', AI_MODEL: 'gemini-pro' }),
      'assistant',
    );
    expect(out?.model).toBe('gemini-pro');
  });

  // Reading handwriting is literal work, and measured on a real wall the small
  // cheap model does it BETTER than the big one (99% of words vs 95%) at about
  // a quarter the cost and four times the speed. See
  // docs/research/vision/handwriting-readers.md.
  it('reads with the cheap fast model by default, and talks with the other one', () => {
    const keys = env({ GOOGLE_AI_STUDIO_API_KEY: 'k' });
    expect(resolveAiProvider(keys, 'assistant')?.model).toBe(GOOGLE_DEFAULT_MODEL);
    expect(resolveAiProvider(keys, 'reader')?.model).toBe(GOOGLE_DEFAULT_VISION_MODEL);
    expect(GOOGLE_DEFAULT_VISION_MODEL).not.toBe(GOOGLE_DEFAULT_MODEL);
  });

  it('on one provider, an operator who names AI_MODEL means it for the reader too', () => {
    const out = resolveAiProvider(
      env({ GOOGLE_AI_STUDIO_API_KEY: 'k', AI_MODEL: 'gemini-pro' }),
      'reader',
    );
    expect(out?.model).toBe('gemini-pro');
  });

  it('a reader on OpenAI alone uses the OpenAI default', () => {
    expect(resolveAiProvider(env({ OPENAI_API_KEY: 'k' }), 'reader')?.model).toBe(
      OPENAI_DEFAULT_MODEL,
    );
  });

  it('AI_MODEL never crosses to the reader on another provider', () => {
    const out = resolveAiProvider(env({ ...BOTH, AI_MODEL: 'gpt-4.1' }), 'reader');
    expect(out).toMatchObject({ provider: 'google', model: GOOGLE_DEFAULT_VISION_MODEL });
  });

  it('AI_VISION_MODEL wins for the reader, and only the reader', () => {
    const keys = env({ OPENAI_API_KEY: 'k', AI_MODEL: 'a', AI_VISION_MODEL: 'b' });
    expect(resolveAiProvider(keys, 'assistant')?.model).toBe('a');
    expect(resolveAiProvider(keys, 'reader')?.model).toBe('b');
  });

  it('AI_VISION_MODEL wins on a split deployment too', () => {
    const out = resolveAiProvider(env({ ...BOTH, AI_VISION_MODEL: 'gemini-x' }), 'reader');
    expect(out).toMatchObject({ provider: 'google', model: 'gemini-x' });
  });

  it('a generic key still needs AI_MODEL, even when the reader is named, so both features agree', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const keys = env({
      AI_API_KEY: 'k',
      AI_BASE_URL: 'http://x/v1',
      AI_VISION_MODEL: 'reader-only',
    });
    expect(resolveAiProvider(keys, 'reader')).toBeNull();
    expect(resolveAiProvider(keys, 'assistant')).toBeNull();
  });
});
