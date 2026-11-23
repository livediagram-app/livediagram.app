import { describe, expect, it } from 'vitest';
import { mostReadPeriodOf, readAiCreditsHeader } from './knowledge-tier';

describe('readAiCreditsHeader', () => {
  it('reads used and limit', () => {
    expect(readAiCreditsHeader('38/1000')).toEqual({ used: 38, limit: 1000 });
  });
  it('is null when absent or malformed', () => {
    expect(readAiCreditsHeader(null)).toBeNull();
    expect(readAiCreditsHeader('')).toBeNull();
    expect(readAiCreditsHeader('3/x')).toBeNull();
    expect(readAiCreditsHeader('-1/5')).toBeNull();
  });
});

describe('mostReadPeriodOf', () => {
  it('takes an offered period within what is kept', () => {
    expect(mostReadPeriodOf('90', 365)).toBe(90);
    expect(mostReadPeriodOf('365', 365)).toBe(365);
  });
  it('clamps to the kept days', () => {
    expect(mostReadPeriodOf('365', 30)).toBe(30);
    expect(mostReadPeriodOf('90', 30)).toBe(30);
  });
  it('is 30 when absent or not offered', () => {
    expect(mostReadPeriodOf(null, 365)).toBe(30);
    expect(mostReadPeriodOf('7', 365)).toBe(30);
  });
});
