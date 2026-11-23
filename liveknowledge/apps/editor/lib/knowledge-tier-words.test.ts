import { afterEach, describe, expect, it } from 'vitest';
import {
  fullSentence,
  pagesBound,
  pagesTierOf,
  trimmedToast,
  trimOffer,
} from './knowledge-import/import-trim';
import {
  aiCreditsOf,
  creditsLine,
  creditsResetWords,
  creditsUsedSentence,
  forgetAiCreditsForTests,
  noteAiCredits,
  noteAiCreditsUsed,
} from './knowledge-credits';
import {
  forgetKnowledgeTiersForTests,
  knowledgeTierOf,
  openPagesMax,
  pagesMaxOf,
  setKnowledgeTier,
} from './knowledge-tier';

// The words and the figures of a knowledgebase's tier in the editor (docs/specs/030-knowledgebase/tiers.md).

afterEach(() => {
  forgetKnowledgeTiersForTests();
  forgetAiCreditsForTests();
});

describe('the tier store', () => {
  it('holds the open knowledgebase’s limit, 500 with Pro off', () => {
    expect(openPagesMax()).toBe(500);
    setKnowledgeTier('kb', { pagesMax: 100, historyDays: 30, owner: 'p:user_o' });
    expect(openPagesMax()).toBe(100);
    expect(pagesMaxOf('other')).toBe(500);
    setKnowledgeTier('kb', null);
    expect(knowledgeTierOf('kb')).toBeNull();
    expect(openPagesMax()).toBe(500);
    expect(knowledgeTierOf(null)).toBeNull();
  });
});

const FREE = { max: 42, account: { limit: 500, whose: 'yours' as const } };
const TEAM = { max: 42, account: { limit: 5000, whose: 'team' as const } };
const BOUND = { max: 500, account: null };

describe('the page bound', () => {
  it('is the owner’s limit less their other knowledgebases’ pages, where that is less than the fixed bound', () => {
    // 480 used over all their knowledgebases, 20 of them here: 460 elsewhere, so 40 fit in this one.
    expect(pagesBound(20, 500, { used: 480, limit: 500, whose: 'yours' })).toEqual({
      max: 40,
      account: { limit: 500, whose: 'yours' },
    });
    // Pro's 10,000 leave the fixed bound in charge.
    expect(pagesBound(20, 500, { used: 480, limit: 10_000, whose: 'yours' })).toEqual(BOUND);
    // A count told late reads no lower than none elsewhere, and never below nothing.
    expect(pagesBound(30, 500, { used: 10, limit: 20, whose: 'team' }).max).toBe(20);
    expect(pagesBound(0, 500, { used: 900, limit: 500, whose: 'yours' }).max).toBe(0);
    expect(pagesBound(5, 500, null)).toEqual(BOUND);
  });
});

describe('import over the limit', () => {
  it('words the offer against the owner’s pages on Free, and against the fixed bound', () => {
    expect(trimOffer(84, 42, FREE)).toEqual({
      title: '42 more pages fit on Free',
      detail:
        "Free holds 500 pages across your Knowledgebases. We'll import the first 42, in the export's order, and leave out the other 42. Pro holds 10,000.",
      importLabel: 'Import First 42',
    });
    expect(trimOffer(3, 1, TEAM)).toMatchObject({
      title: '1 more page fits on Pro for Teams',
      detail:
        "Pro for Teams holds 5,000 pages across this team’s Knowledgebases. We'll import the first 1, in the export's order, and leave out the other 2.",
    });
    expect(trimOffer(3, 1, { max: 1, account: { limit: 777, whose: 'yours' } }).title).toBe(
      '1 more page fits',
    );
    expect(trimOffer(3, 1, { max: 1, account: { limit: 777, whose: 'yours' } }).detail).toMatch(
      /^Your plan holds 777 pages/,
    );
    expect(trimOffer(600, 500, BOUND).detail).toBe(
      "A Knowledgebase holds 500 pages. We'll import the first 500, in the export's order, and leave out the other 100.",
    );
  });

  it('words a full knowledgebase and the finished note', () => {
    expect(fullSentence(FREE)).toBe(
      'You have 500 pages, the most Free holds across your Knowledgebases.',
    );
    expect(fullSentence(TEAM)).toBe(
      'This team has 5,000 pages, the most Pro for Teams holds across its Knowledgebases.',
    );
    expect(fullSentence({ max: 0, account: { limit: 7, whose: 'yours' } })).toBe(
      'You have 7 pages, the most you can hold across your Knowledgebases.',
    );
    expect(fullSentence(BOUND)).toBe('This Knowledgebase holds 500 pages, the most one can.');
    expect(trimmedToast(42, 42, FREE)).toBe(
      'Imported 42 of 84 pages. The other 42 were left out: your Knowledgebases are full on Free.',
    );
    expect(trimmedToast(1, 1, TEAM)).toBe(
      'Imported 1 of 2 pages. The other 1 were left out: this team’s Knowledgebases are full on Pro for Teams.',
    );
    expect(trimmedToast(1, 1, { max: 1, account: { limit: 7, whose: 'yours' } })).toContain(
      'are full.',
    );
    expect(trimmedToast(1, 1, BOUND)).toContain('this Knowledgebase is full.');
    expect(pagesTierOf(5000)).toBe('team');
    expect(pagesTierOf(7)).toBeNull();
  });
});

describe('AI credits', () => {
  it('says the line, then the month once an answer told it', () => {
    expect(creditsLine(null)).toBe('Uses 1 AI credit');
    noteAiCredits('kb', null);
    expect(aiCreditsOf('kb')).toBeNull();
    noteAiCredits('kb', { used: 38, limit: 1000 });
    expect(creditsLine(aiCreditsOf('kb'))).toBe('Uses 1 AI credit · 962 left this month');
    expect(aiCreditsOf('kb')?.usedUp).toBe(false);
    noteAiCreditsUsed('kb', 50, 50);
    expect(aiCreditsOf('kb')).toEqual({ used: 50, limit: 50, usedUp: true });
    expect(aiCreditsOf(undefined)).toBeNull();
  });

  it('says what the operation costs before it starts', () => {
    expect(creditsLine(null, 2)).toBe('Uses 2 AI credits');
    expect(creditsLine({ used: 10, limit: 50, usedUp: false }, 2)).toBe(
      'Uses 2 AI credits · 40 left this month',
    );
  });

  it('words the used-up notice for who may act and who may not', () => {
    const now = new Date(Date.UTC(2026, 10, 22));
    expect(creditsResetWords(now)).toBe('1 December');
    expect(creditsResetWords(new Date(Date.UTC(2026, 11, 5)))).toBe('1 January');
    expect(creditsUsedSentence(true, 'set up', 1000, now)).toBe(
      "This month's AI credits are used. They start again on 1 December. Add your own Claude key to set up now, or Pro gives 1,000 a month.",
    );
    expect(creditsUsedSentence(false, 'ask', 1000)).toBe(
      "The owner's AI credits for this month are used.",
    );
  });
});
