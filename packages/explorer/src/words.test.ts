import { describe, expect, it } from 'vitest';
import { scopeWords } from './words';

describe('scopeWords', () => {
  it('says pages for a knowledgebase and tabs everywhere else', () => {
    expect(scopeWords('liveknowledge').all).toBe('All Pages');
    expect(scopeWords('liveknowledge').many).toBe('Pages');
    expect(scopeWords('livediagram').all).toBe('All tabs');
    expect(scopeWords().many).toBe('Tabs');
  });
});
