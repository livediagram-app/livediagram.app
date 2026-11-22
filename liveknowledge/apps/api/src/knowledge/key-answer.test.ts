import { describe, expect, it } from 'vitest';
import { keyAnswerOf } from './ai-settings';

// Describe a Rule in liveknowledge (liveworkspace/docs/specs/003-accounts/ai-keys.md "Every AI feature honours the
// choice"): the key that applies to the asker, as the shared automations engine reads it.
describe('keyAnswerOf', () => {
  it('names whose key applies: the knowledgebase’s own, the team’s or the person’s', () => {
    const opened = { provider: 'openai' as const, apiKey: 'sk-planted', model: 'gpt-6.2-astra' };
    expect(keyAnswerOf({ ...opened, source: 'knowledgebase' })).toEqual({
      status: 'key',
      source: 'item',
      provider: 'openai',
      model: 'gpt-6.2-astra',
      key: 'sk-planted',
    });
    expect(keyAnswerOf({ ...opened, source: 'team' })).toMatchObject({ source: 'team' });
    expect(keyAnswerOf({ ...opened, source: 'personal' })).toMatchObject({ source: 'account' });
  });

  it('says a key that will not open, accounts that could not answer, or none', () => {
    expect(keyAnswerOf('unreadable')).toEqual({ status: 'unreadable', source: 'item' });
    expect(keyAnswerOf('team-unreadable')).toEqual({ status: 'unreadable', source: 'team' });
    expect(keyAnswerOf('personal-unreadable')).toEqual({ status: 'unreadable', source: 'account' });
    expect(keyAnswerOf('shared-unavailable')).toEqual({ status: 'unavailable' });
    expect(keyAnswerOf('no-key')).toEqual({ status: 'none' });
    expect(keyAnswerOf('no-secret')).toEqual({ status: 'none' });
  });
});
