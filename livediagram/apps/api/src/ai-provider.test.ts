import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GOOGLE_BASE_URL,
  GOOGLE_DEFAULT_VISION_MODEL,
  aiConfigured,
  resolveAiProvider,
} from './ai-provider';
import type { Env } from './types';

// Whose model reads the sticky-note crops (docs/specs/021-event-storming/note-reader.md)?
// The keys answer it. What is pinned here is that each preset stands on its
// own, that Google outranks the generic key, and that a half-configured
// generic is not a configuration.

const env = (over: Partial<Env>) => over as Env;
const generic = { AI_API_KEY: 'x', AI_BASE_URL: 'http://x/v1', AI_VISION_MODEL: 'local' };

afterEach(() => vi.restoreAllMocks());

describe('the presets', () => {
  it('resolves Google from its own key, at its own endpoint, on the reader default', () => {
    expect(resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'k' }))).toEqual({
      provider: 'google',
      baseUrl: GOOGLE_BASE_URL,
      apiKey: 'k',
      model: GOOGLE_DEFAULT_VISION_MODEL,
      strictSchema: true,
    });
  });

  it('resolves anything else from a key, a base URL and a model', () => {
    expect(
      resolveAiProvider(
        env({ AI_API_KEY: 'k', AI_BASE_URL: 'http://127.0.0.1:8080/v1', AI_VISION_MODEL: 'm' }),
      ),
    ).toEqual({
      provider: 'generic',
      baseUrl: 'http://127.0.0.1:8080/v1',
      apiKey: 'k',
      model: 'm',
      strictSchema: false,
    });
  });

  it('tolerates the trailing slash somebody pasted out of a provider’s docs', () => {
    const out = resolveAiProvider(env({ ...generic, AI_BASE_URL: 'http://127.0.0.1:8080/v1///' }));
    expect(out?.baseUrl).toBe('http://127.0.0.1:8080/v1');
  });
});

describe('the generic key is the last resort', () => {
  it('Google outranks it, and the dead secret is reported', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = resolveAiProvider(env({ ...generic, GOOGLE_AI_STUDIO_API_KEY: 'g' }));
    expect(out?.provider).toBe('google');
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toContain('[ai] AI_API_KEY is set but unused');
  });

  it('never prints a key while reporting it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    resolveAiProvider(
      env({ ...generic, AI_API_KEY: 'super-secret', GOOGLE_AI_STUDIO_API_KEY: 'also' }),
    );
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
    expect(resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: '' }))).toBeNull();
  });

  it('an empty Google key does not outrank a real generic one', () => {
    const out = resolveAiProvider(env({ ...generic, GOOGLE_AI_STUDIO_API_KEY: '' }));
    expect(out?.provider).toBe('generic');
  });

  it('a generic key with nowhere to send it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveAiProvider(env({ AI_API_KEY: 'k', AI_VISION_MODEL: 'm' }))).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('a generic key with nothing to ask for', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(resolveAiProvider(env({ AI_API_KEY: 'k', AI_BASE_URL: 'http://x/v1' }))).toBeNull();
  });
});

describe('aiConfigured', () => {
  it('is true for any usable key', () => {
    expect(aiConfigured(env({ GOOGLE_AI_STUDIO_API_KEY: 'g' }))).toBe(true);
    expect(aiConfigured(env(generic))).toBe(true);
  });

  it('is false with no usable key', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(aiConfigured(env({}))).toBe(false);
    expect(aiConfigured(env({ AI_API_KEY: 'k' }))).toBe(false);
  });
});

describe('which model', () => {
  // Reading handwriting is literal work, and measured on a real wall the small
  // cheap model does it better than a big one (99% of words vs 95%) at about
  // a quarter the cost and four times the speed. See
  // docs/research/vision/handwriting-readers.md.
  it('reads with the cheap fast model by default', () => {
    expect(resolveAiProvider(env({ GOOGLE_AI_STUDIO_API_KEY: 'k' }))?.model).toBe(
      'gemini-2.5-flash-lite',
    );
  });

  it('AI_VISION_MODEL overrides the Google default', () => {
    const out = resolveAiProvider(
      env({ GOOGLE_AI_STUDIO_API_KEY: 'k', AI_VISION_MODEL: 'gemini-x' }),
    );
    expect(out).toMatchObject({ provider: 'google', model: 'gemini-x' });
  });
});
