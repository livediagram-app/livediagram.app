import { describe, expect, it, vi } from 'vitest';

// The fallback switch is off for every model (claude-models.ts). The request and the header still know how to ask
// for one, for the day a model's switch is turned on: held here with a model whose switch is on.
vi.mock('./claude-models', async (original) => {
  const real = await original<typeof import('./claude-models')>();
  return {
    ...real,
    claudeModel: (id: unknown) => ({ ...real.claudeModel(id), fallbacks: true }),
  };
});

import { claudeHeaders } from './claude-client';
import { CLAUDE_FALLBACK_BETA, claudeRequest } from './claude-request';

describe('a model whose fallback switch is on', () => {
  it('names the fallback in its request, with the beta header', () => {
    const request = claudeRequest({
      model: 'claude-fable-5-2',
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 1000,
      effort: 'low',
    });
    expect(request.fallbacks).toBe('default');
    expect(claudeHeaders('sk-test', request)['anthropic-beta']).toBe(CLAUDE_FALLBACK_BETA);
  });
});
