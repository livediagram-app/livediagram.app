// docs/specs/012-collaboration/call-minutes.md "What people see": the sentences, in the numbers given and the reader's
// own date.
import { describe, expect, it } from 'vitest';
import {
  callMinutesLowWords,
  callMinutesOffer,
  callMinutesOfUsed,
  callMinutesResetDay,
  callMinutesResets,
  callMinutesUsedOf,
  callMinutesUsedWords,
  callsPausedHover,
  callsPausedWords,
} from './call-minutes-words';

// 20 November 2026, and the last second of the year (UTC).
const NOVEMBER = Date.UTC(2026, 10, 20, 12);
const NEW_YEARS_EVE = Date.UTC(2026, 11, 31, 23, 59, 59);

describe('call minutes words', () => {
  it('names the first of next month, in UTC, as the reader’s locale writes it', () => {
    expect(callMinutesResetDay(NOVEMBER, 'en-GB')).toBe('1 December');
    expect(callMinutesResetDay(NOVEMBER, 'en-US')).toBe('December 1');
    expect(callMinutesResetDay(NEW_YEARS_EVE, 'en-GB')).toBe('1 January');
    expect(callMinutesResets(NOVEMBER, 'en-GB')).toBe('Resets on 1 December.');
  });

  it('says what the tier above has, from the contract, and nothing with nobody to offer', () => {
    expect(callMinutesOffer('pro')).toBe('Pro has 5,000.');
    expect(callMinutesOffer('team')).toBe('Pro for Teams has 2,500 a member.');
    expect(callMinutesOffer(null)).toBe('');
  });

  it('counts in the numbers it is given', () => {
    expect(callMinutesOfUsed(1000)).toBe('of 1,000 used');
    expect(callMinutesUsedOf(1000, 1000)).toBe('1,000 of 1,000');
  });

  it('words running low with the offer, or with when the minutes start again', () => {
    expect(callMinutesLowWords(80, 'pro', NOVEMBER, 'en-GB')).toBe(
      '80 call minutes left this month. Pro has 5,000.',
    );
    expect(callMinutesLowWords(1, null, NOVEMBER, 'en-GB')).toBe(
      '1 call minute left this month. They start again on 1 December.',
    );
  });

  it('tells the owner what still works, and everyone else only that calls are paused', () => {
    expect(callMinutesUsedWords(NOVEMBER, 'en-GB')).toBe(
      'Calls start again on 1 December. The Space, its chat and everything on its walls still work.',
    );
    expect(callsPausedWords(NOVEMBER, 'en-GB')).toBe(
      'Calls are paused in this Space until 1 December.',
    );
    expect(callsPausedHover(NOVEMBER, 'en-GB')).toBe(
      'Calls are paused in this Space until 1 December. Everything else in the Space carries on.',
    );
  });
});
