import { describe, expect, it } from 'vitest';
import {
  agentDoor,
  agentSample,
  agentScopes,
  askedByText,
  budgetText,
  healthParts,
  readsText,
  suggestionLines,
  tokensText,
} from './overview-words';
import { overviewFailureText } from './suggestions-api';

describe('what AI Knowledge says', () => {
  it('who asked, counting asks', () => {
    expect(
      askedByText({ asked: 4, byPeople: 3, agents: [{ name: 'Coding Agent', asked: 1 }] }),
    ).toBe('Asked 4 times by people and the Coding Agent');
    expect(askedByText({ asked: 1, byPeople: 1, agents: [] })).toBe('Asked once by people');
    expect(
      askedByText({
        asked: 1200,
        byPeople: 0,
        agents: [
          { name: 'MCP', asked: 600 },
          { name: 'CLI', asked: 500 },
          { name: 'Coding Agent', asked: 100 },
        ],
      }),
    ).toBe('Asked 1,200 times by the MCP, the CLI and the Coding Agent');
    expect(askedByText({ asked: 2, byPeople: 0, agents: [] })).toBe('Asked 2 times');
  });

  it('how an agent connects, and what it has been seen to do', () => {
    expect(agentDoor('MCP').door).toBe('mcp');
    expect(agentDoor('CLI').door).toBe('cli');
    expect(agentDoor('API Token').door).toBe('token');
    expect(agentDoor('Coding Agent').door).toBe('named');
    expect(agentScopes({ name: 'A' }, [])).toEqual(['Reads']);
    expect(agentScopes({ name: 'A' }, [{ agent: 'A' }])).toEqual(['Reads', 'Suggests Edits']);
  });

  it('counts with their nouns', () => {
    expect(readsText(1)).toBe('1 page read this week');
    expect(readsText(1200)).toBe('1,200 pages read this week');
    expect(tokensText(1240)).toBe('1,240 tokens');
    expect(budgetText(4410, 8000)).toBe('4,410 of 8,000 tokens');
  });

  it('the health bar for a screen reader', () => {
    expect(healthParts({ verified: 1, reviewDue: 0, neverVerified: 0, total: 1 }).label).toBe(
      'Of 1 page: 1 verified, 0 review due, 0 never verified.',
    );
  });

  it('a suggestion as lines: an append takes nothing out', () => {
    expect(suggestionLines({ kind: 'append', before: '', after: 'One.\n\nTwo.' })).toEqual({
      removed: [],
      added: ['One.', 'Two.'],
    });
    expect(suggestionLines({ kind: 'replace', before: 'Old.', after: 'New.' })).toEqual({
      removed: ['Old.'],
      added: ['New.'],
    });
  });

  it('a sample with nothing real to show is a made-up page', () => {
    expect(agentSample(null, 0)).toContain('1. Release Process');
  });

  it('a refusal in words', () => {
    expect(overviewFailureText(new Error('x'), 'dismiss-question')).toBe(
      'The question could not be dismissed. Try again.',
    );
  });
});
