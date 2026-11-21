import { describe, expect, it } from 'vitest';
import { knowledgeTabTitle } from './knowledge-tab-title';

describe('the browser tab title', () => {
  it('names the page, then the knowledgebase, then the app', () => {
    expect(knowledgeTabTitle('Onboarding', 'Team Wiki')).toBe(
      'Onboarding | Team Wiki | liveknowledge',
    );
  });
  it('leaves the page out while it has no name', () => {
    expect(knowledgeTabTitle('  ', 'Team Wiki')).toBe('Team Wiki | liveknowledge');
    expect(knowledgeTabTitle(undefined, 'Team Wiki')).toBe('Team Wiki | liveknowledge');
  });
});
