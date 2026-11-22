import { describe, expect, it } from 'vitest';
import {
  cardsSummary,
  speakingSecondsFor,
  speakingTimeLabel,
  spokenWordCount,
} from './speaking-time';

describe('speaking time', () => {
  it('counts words, keeping an apostrophe or hyphen inside one', () => {
    expect(spokenWordCount('')).toBe(0);
    expect(spokenWordCount("Don't over-think it, twice.")).toBe(4);
  });

  it('says the words at a steady pace, rounded up', () => {
    expect(speakingSecondsFor(0)).toBe(0);
    expect(speakingSecondsFor(130)).toBe(60);
    expect(speakingSecondsFor(1)).toBe(1);
  });

  it('labels a time in steps of five seconds, then minutes', () => {
    expect(speakingTimeLabel(0)).toBeNull();
    expect(speakingTimeLabel(6)).toBe('10 sec');
    expect(speakingTimeLabel(25)).toBe('25 sec');
    expect(speakingTimeLabel(59)).toBe('55 sec');
    expect(speakingTimeLabel(60)).toBe('1 min');
    expect(speakingTimeLabel(150)).toBe('3 min');
  });

  it('sums up a number of cards and their time', () => {
    expect(cardsSummary(3, 120)).toBe('3 cards · 2 min');
    expect(cardsSummary(1, 30)).toBe('1 card · 30 sec');
    expect(cardsSummary(2, 0)).toBe('2 cards');
    expect(cardsSummary(0, 30)).toBeNull();
  });
});
