import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { MODEL_PROVIDERS } from '@liveknowledge/knowledge';
import { TEAM_PAYS_ANY_NOTE, aiSettingsFailureText, teamPaysNote } from './ai-settings-words';
import { askFailureWords } from './ask-failure-words';
import {
  PROVIDER_WORDS,
  addKeyLabel,
  providerWords,
  replaceProviderMessage,
  replaceProviderTitle,
} from './provider-words';

// docs/specs/030-knowledgebase/search-and-ask.md "Providers".
describe('how the two providers are named', () => {
  it('matches the names and key prefixes the knowledge package holds', () => {
    for (const provider of MODEL_PROVIDERS) {
      const words = PROVIDER_WORDS[provider.id];
      expect(words.name).toBe(provider.name);
      expect(words.spoken).toBe(provider.spoken);
      expect(words.keyPlaceholder).toBe(`${provider.keyPrefix}...`);
    }
  });

  it('reads a provider it does not know as the first', () => {
    expect(providerWords(undefined).spoken).toBe('Claude');
    expect(providerWords('gemini' as never).spoken).toBe('Claude');
  });

  it('asks before a key is replaced, in Title Case with the right article', () => {
    expect(replaceProviderTitle('anthropic', 'openai')).toBe(
      'Replace the Claude Key With an OpenAI Key?',
    );
    expect(replaceProviderTitle('openai', 'anthropic')).toBe(
      'Replace the OpenAI Key With a Claude Key?',
    );
    expect(replaceProviderMessage('anthropic', 'openai')).toContain(
      'The Claude key stays in use until you save an OpenAI key',
    );
    expect(replaceProviderMessage('openai', 'anthropic')).toContain('save a Claude key');
    expect(addKeyLabel('openai')).toBe('Add an OpenAI Key');
    expect(addKeyLabel('anthropic')).toBe('Add a Claude Key');
  });

  it('says who the team pays, and never that liveknowledge is free or has no paid tier', () => {
    expect(teamPaysNote('anthropic')).toBe(
      'liveknowledge pays for no model: your team pays Anthropic for what it uses.',
    );
    expect(teamPaysNote('openai')).toContain('pays OpenAI');
    for (const note of [teamPaysNote('anthropic'), teamPaysNote('openai'), TEAM_PAYS_ANY_NOTE])
      expect(note).not.toMatch(/free|paid tier/i);
  });
});

describe('a failure names the provider where it is the provider own', () => {
  const kinds = ['bad-key', 'no-credit', 'rate-limited', 'overloaded', 'refused'];

  it.each(kinds)('%s', (kind) => {
    const claude = askFailureWords(kind, { manageAi: true, provider: 'anthropic' });
    const openai = askFailureWords(kind, { manageAi: true, provider: 'openai' });
    expect(claude.title).toContain('Claude');
    expect(openai.title).toContain('OpenAI');
    expect(openai.title + openai.text).not.toContain('Claude');
    expect(askFailureWords(kind, { manageAi: true }).title).toBe(claude.title);
  });

  it('says "your team\'s AI key" where the provider does not matter', () => {
    for (const provider of ['anthropic', 'openai'] as const) {
      const words = askFailureWords('sign_in_required', { manageAi: false, provider });
      expect(words.text).toContain("your team's AI key");
      expect(words.title + words.text).not.toMatch(/Claude|OpenAI/);
    }
    expect(askFailureWords('no-credit', { manageAi: true, provider: 'openai' }).text).toContain(
      'the OpenAI platform',
    );
  });

  it('words a refused write for the provider the key was typed for', () => {
    const refused = new ApiError('set ai key', 400, 'invalid_key');
    expect(aiSettingsFailureText(refused, 'save-key', 'anthropic')).toContain(
      'That is not a Claude API key. Copy it again from the Claude Console',
    );
    expect(aiSettingsFailureText(refused, 'save-key', 'openai')).toContain(
      'That is not an OpenAI API key. Copy it again from the OpenAI platform',
    );
    expect(
      aiSettingsFailureText(new ApiError('x', 400, 'invalid_provider'), 'save-key', 'openai'),
    ).toBe('Choose Anthropic or OpenAI.');
    expect(
      aiSettingsFailureText(new ApiError('x', 400, 'invalid_model'), 'set-model', 'openai'),
    ).toBe('Choose one of the listed models.');
  });
});
