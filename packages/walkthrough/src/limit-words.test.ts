// A walkthrough's tier limits in words (walkthroughs.md "With Pro on").
import { describe, expect, it } from 'vitest';
import { minutesOf, stoppedAtLimit, stoppedNote, storedFull } from './limit-state';
import { lengthLimitWords, lengthNoteWords, storedLimitSentence } from './limit-words';

const FIVE = 5 * 60 * 1000;
const owner = { tier: 'free', upgradeTo: 'pro' } as const;
const member = { tier: 'free', upgradeTo: null } as const;
const outsider = { tier: null, upgradeTo: null } as const;

describe('whether a limit was met', () => {
  it('words a length in minutes', () => {
    expect(minutesOf(60_000)).toBe('1 minute');
    expect(minutesOf(30 * 60_000)).toBe('30 minutes');
  });

  it('counts a recording as stopped at its limit within the clock’s last tick', () => {
    expect(stoppedAtLimit(FIVE, FIVE)).toBe(true);
    expect(stoppedAtLimit(FIVE - 1000, FIVE)).toBe(true);
    expect(stoppedAtLimit(FIVE - 1001, FIVE)).toBe(false);
  });

  it('is full only at a limit the server answered', () => {
    const limits = { maxMs: FIVE, stored: 5, storedLimit: 5, owner: null };
    expect(storedFull(limits)).toBe(true);
    expect(storedFull({ ...limits, stored: 4 })).toBe(false);
    expect(storedFull({ ...limits, stored: 500, storedLimit: null })).toBe(false);
    expect(storedFull(null)).toBe(false);
    expect(storedFull(undefined)).toBe(false);
  });
});

describe('at the stored limit', () => {
  it('tells the owner what Free keeps and what Pro does', () => {
    expect(storedLimitSentence(5, owner)).toBe(
      'You have 5 walkthroughs, the most Free keeps. Delete one to record another, or keep as many as you like with Pro.',
    );
    expect(storedLimitSentence(5, { tier: 'free', upgradeTo: 'team' })).toContain(
      'or keep as many as you like with Pro for Teams.',
    );
  });

  it('tells anyone else the limit and nothing of an offer', () => {
    expect(storedLimitSentence(5, member)).toBe(
      'You have 5 walkthroughs, the most Free keeps. Delete one to record another.',
    );
    expect(storedLimitSentence(1, outsider)).toBe(
      'You have 1 walkthrough, the most you can keep here. Delete one to record another.',
    );
  });
});

describe('a recording that ran to its length', () => {
  it('says it was saved in full, whose limit it met, and what Pro records', () => {
    expect(lengthLimitWords(FIVE, owner)).toEqual({
      title: 'Saved at 5:00',
      sentence: 'Your walkthrough reached Free’s 5 minutes and is saved in full.',
      offer: 'Pro records up to 30 minutes.',
    });
  });

  it('offers nothing to someone who may not upgrade, or who already has the longest', () => {
    expect(lengthLimitWords(FIVE, member).offer).toBe('');
    expect(lengthLimitWords(60_000, outsider)).toEqual({
      title: 'Saved at 1:00',
      sentence: 'Your walkthrough reached the 1 minute one may run here and is saved in full.',
      offer: '',
    });
    expect(lengthLimitWords(30 * 60 * 1000, { tier: 'pro', upgradeTo: 'pro' }).offer).toBe('');
  });
});

describe('the save card’s note', () => {
  it('is the line it always was with no limit from the server, and the minutes with one', () => {
    expect(stoppedNote(10 * 60 * 1000, false)).toBe(
      'Stopped at 10 minutes, the longest a walkthrough may be.',
    );
    expect(stoppedNote(FIVE, true)).toBe('Stopped at 5 minutes, the longest this may record.');
  });
});

describe('lengthNoteWords', () => {
  it('names both tiers for someone who may upgrade, and only the minutes for anyone else', () => {
    expect(lengthNoteWords(FIVE, owner)).toEqual({
      offer: 'Free records up to 5 minutes. Pro records up to 30 minutes.',
      others: 'A walkthrough here records up to 5 minutes.',
    });
    expect(lengthNoteWords(FIVE, { tier: null, upgradeTo: null })?.offer).toBe(
      'A walkthrough here records up to 5 minutes.',
    );
  });

  it('is nothing once the length is already the longest', () => {
    expect(lengthNoteWords(30 * 60 * 1000, { tier: 'pro', upgradeTo: null })).toBeNull();
  });
});
