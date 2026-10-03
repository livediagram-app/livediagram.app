import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_OPEN_HEADER,
  HOME_REJECTIONS,
  HOME_VERBS,
  isHomeRejection,
  readDocumentOpen,
  windowStartOf,
  WITHIN_REACH_USE_WINDOW_DAYS,
} from './home';

// Explorer Home's wire (docs/specs/013-workspace/explorer-home.md): the api answers these tokens
// and verbs, the editor reads them, so both take them from one place.
describe('home rejections', () => {
  it('names every refusal the blueprint lists', () => {
    expect([...HOME_REJECTIONS]).toEqual(['tz_invalid']);
  });

  it('recognises a home token and nothing else', () => {
    expect(isHomeRejection('tz_invalid')).toBe(true);
    expect(isHomeRejection('bad_request')).toBe(false);
    expect(isHomeRejection('cursor_invalid')).toBe(false);
    expect(isHomeRejection(null)).toBe(false);
  });
});

describe('home verbs', () => {
  it('runs in the order a sentence names them', () => {
    expect(HOME_VERBS).toEqual([
      'commented',
      'replied',
      'resolved',
      'edited',
      'assigned_you',
      'assigned',
      'completed',
      'shared',
    ]);
  });
});

describe('the open marker', () => {
  it('is one header with one value', () => {
    expect(DOCUMENT_OPEN_HEADER).toBe('X-Document-Open');
    expect(readDocumentOpen('1')).toBe(true);
  });

  it('reads anything else as not an open', () => {
    expect(readDocumentOpen(null)).toBe(false);
    expect(readDocumentOpen('true')).toBe(false);
    expect(readDocumentOpen('')).toBe(false);
  });
});

describe('the use window', () => {
  it('is the last 90 UTC days, today included, from midnight', () => {
    const now = Date.UTC(2026, 9, 3, 15, 30);
    const start = windowStartOf(now);
    expect(new Date(start).toISOString()).toBe('2026-07-06T00:00:00.000Z');
    // 2026-07-06 to 2026-10-03 inclusive is 90 days.
    expect(Math.round((Date.UTC(2026, 9, 3) - start) / 86_400_000) + 1).toBe(
      WITHIN_REACH_USE_WINDOW_DAYS,
    );
  });

  it('starts at the same midnight wherever in the day it is asked', () => {
    expect(windowStartOf(Date.UTC(2026, 9, 3, 0, 0))).toBe(
      windowStartOf(Date.UTC(2026, 9, 3, 23, 59)),
    );
  });
});
