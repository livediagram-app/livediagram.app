// A walkthrough's media upload as the save card shows it (Work Tracker 1175): the share sent, and about how long is
// left at the speed so far.
import { describe, expect, it } from 'vitest';
import {
  ESTIMATE_AFTER_MS,
  formatTimeLeft,
  megabytes,
  PROGRESS_EVERY_MS,
  uploadEstimate,
  uploadMoved,
  uploadPercent,
} from './upload-progress';

const MB = 1024 * 1024;

describe('uploadEstimate', () => {
  it('works the time left out from the average speed since the media began', () => {
    // 10 MB of 40 in 20 s: 30 MB more at the same speed is 60 s.
    expect(uploadEstimate(10 * MB, 40 * MB, 20_000)).toEqual({
      sent: 10 * MB,
      total: 40 * MB,
      leftMs: 60_000,
    });
  });

  it("doesn't guess before a second has passed or before any byte has gone", () => {
    expect(uploadEstimate(5 * MB, 40 * MB, ESTIMATE_AFTER_MS - 1).leftMs).toBeNull();
    expect(uploadEstimate(0, 40 * MB, 5_000).leftMs).toBeNull();
  });

  it('says none left once every byte has gone', () => {
    expect(uploadEstimate(40 * MB, 40 * MB, 30_000).leftMs).toBe(0);
  });
});

describe('uploadPercent', () => {
  it('is the whole percentage sent, never past 100', () => {
    expect(uploadPercent({ sent: 1, total: 3 })).toBe(33);
    expect(uploadPercent({ sent: 3, total: 3 })).toBe(100);
    expect(uploadPercent({ sent: 4, total: 3 })).toBe(100);
  });

  it('is 0 for a body of no known size', () => {
    expect(uploadPercent({ sent: 0, total: 0 })).toBe(0);
  });
});

describe('uploadMoved', () => {
  it('draws the first time, when the percentage moves, and after a while', () => {
    expect(uploadMoved(null, 0, 0)).toBe(true);
    expect(uploadMoved({ percent: 4, at: 1_000 }, 5, 1_010)).toBe(true);
    expect(uploadMoved({ percent: 4, at: 1_000 }, 4, 1_010)).toBe(false);
    expect(uploadMoved({ percent: 4, at: 1_000 }, 4, 1_000 + PROGRESS_EVERY_MS)).toBe(true);
  });
});

describe('the wording', () => {
  it('says megabytes to one decimal place', () => {
    expect(megabytes(33.6 * MB)).toBe('33.6');
    expect(megabytes(0)).toBe('0.0');
  });

  it('says the time left in fives of seconds, then in minutes', () => {
    expect(formatTimeLeft(0)).toBe('Less than 5 seconds left');
    expect(formatTimeLeft(4_999)).toBe('Less than 5 seconds left');
    expect(formatTimeLeft(41_000)).toBe('About 40 seconds left');
    expect(formatTimeLeft(56_000)).toBe('About 55 seconds left');
    // Rounds up to the minute rather than saying "60 seconds".
    expect(formatTimeLeft(58_000)).toBe('About 1 minute left');
    expect(formatTimeLeft(89_000)).toBe('About 1 minute left');
    expect(formatTimeLeft(125_000)).toBe('About 2 minutes left');
  });
});
