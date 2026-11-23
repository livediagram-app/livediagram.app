import { describe, expect, it } from 'vitest';
import {
  agentDoor,
  agentSample,
  agentScopeChips,
  agentWriteChoice,
  lastSeenText,
  lastEditedText,
  moreNotListedText,
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
    ).toBe('Asked 4 times by people and Coding Agent');
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
    ).toBe('Asked 1,200 times by MCP, CLI and Coding Agent');
    expect(askedByText({ asked: 2, byPeople: 0, agents: [] })).toBe('Asked 2 times');
  });

  it('how an agent connects, and what it has been seen to do', () => {
    expect(agentDoor({ name: 'MCP' }).door).toBe('mcp');
    expect(agentDoor({ name: 'CLI' }).door).toBe('cli');
    expect(agentDoor({ name: 'API Token' }).door).toBe('token');
    expect(agentDoor({ name: 'Coding Agent' }).door).toBe('named');
    // What the room saw of the token wins over the name.
    expect(agentDoor({ name: 'Coding Agent', door: 'cli' })).toEqual({
      door: 'cli',
      how: 'Through the command line',
    });
  });

  it('the chips are the scopes the room answers, never a guess', () => {
    expect(agentScopeChips({ scopes: ['read'] })).toEqual(['Reads']);
    expect(agentScopeChips({ scopes: ['read', 'suggest'] })).toEqual(['Reads', 'Suggests Edits']);
    expect(agentScopeChips({ scopes: ['read', 'suggest', 'write'] })).toEqual([
      'Reads',
      'Suggests Edits',
      'Writes',
    ]);
    // Known only by its reads: it reads.
    expect(agentScopeChips({})).toEqual(['Reads']);
  });

  it('what an Editor may change about a connection’s writing', () => {
    const base = { tokenId: 't1', canHoldWrite: true };
    expect(agentWriteChoice({ ...base, scopes: ['read', 'suggest'] })).toEqual({
      kind: 'allow',
      tokenId: 't1',
    });
    expect(agentWriteChoice({ ...base, scopes: ['read', 'suggest', 'write'] })).toEqual({
      kind: 'stop',
      tokenId: 't1',
    });
    // No token id in the read (not an Editor), or an agent known only by its reads: nothing, and no reason.
    expect(agentWriteChoice({ scopes: ['read', 'suggest'], canHoldWrite: true })).toEqual({
      kind: 'none',
      why: null,
    });
    expect(agentWriteChoice({ tokenId: 't1' })).toEqual({ kind: 'none', why: null });
    const participant = agentWriteChoice({
      ...base,
      canHoldWrite: false,
      scopes: ['read', 'suggest'],
    });
    expect(participant).toMatchObject({
      kind: 'none',
      why: expect.stringContaining('not an Editor'),
    });
    const readOnly = agentWriteChoice({ ...base, canHoldWrite: false, scopes: ['read'] });
    expect(readOnly).toMatchObject({ kind: 'none', why: expect.stringContaining('read-only') });
  });

  it('when a connection was last seen, by the day', () => {
    const now = 10 * 86_400_000;
    expect(lastSeenText(now - 1000, now)).toBe('Last seen today');
    expect(lastSeenText(now - 86_400_000, now)).toBe('Last seen yesterday');
    expect(lastSeenText(now - 3 * 86_400_000, now)).toBe('Last seen 3 days ago');
    expect(lastSeenText(now + 5000, now)).toBe('Last seen today');
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
    expect(overviewFailureText(new Error('x'), 'accept-suggestion', '“Onboarding”')).toBe(
      'The edit to “Onboarding” could not be accepted. Try again.',
    );
  });
});

describe('Not Read in 90 Days in words', () => {
  const NOW = Date.UTC(2026, 10, 20);
  const ago = (days: number) => NOW - days * 86_400_000;
  it('says how long ago the page was last edited, in days, months or years', () => {
    expect(lastEditedText(undefined, NOW)).toBe('Last edit not kept');
    expect(lastEditedText(ago(1), NOW)).toBe('Last edited 1 day ago');
    expect(lastEditedText(ago(95), NOW)).toBe('Last edited 95 days ago');
    expect(lastEditedText(ago(150), NOW)).toBe('Last edited 5 months ago');
    expect(lastEditedText(ago(800), NOW)).toBe('Last edited 2 years ago');
    expect(moreNotListedText(1234)).toBe('1,234 more not listed');
  });
});

describe('the agent sample under a Review Period of Never', () => {
  it('says verification is off', () => {
    const overview = { reviewEvery: 'never', conflicts: [], context: { pages: [] }, agents: [] };
    expect(agentSample(overview as never, Date.UTC(2026, 10, 20))).toContain(
      'trust: verification off',
    );
  });
});
