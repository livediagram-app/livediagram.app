import { describe, expect, it } from 'vitest';
import {
  cleanText,
  commentHeader,
  cutText,
  httpLink,
  trackerDay,
  trackerEstimate,
  trackerInstant,
  trackerPersonOf,
  trackerPriority,
} from './tracker-text';

// docs/specs/026-plan/tracker-import.md "Reading the file": every value is untrusted text, read as characters.

describe('cleanText', () => {
  it('keeps text, tabs and line breaks, drops control characters, trims and cuts', () => {
    expect(cleanText('  a\tb\r\nc\rd\u0000\u0007\u007f\u0085e  ', 100)).toBe('a\tb\nc\nde');
    expect(cleanText('<b>bold</b>', 100)).toBe('<b>bold</b>');
    expect(cleanText('abcdef', 4)).toBe('abc…');
    expect(cleanText(42, 10)).toBe('42');
    expect(cleanText(Number.NaN, 10)).toBe('');
    expect(cleanText({ a: 1 }, 10)).toBe('');
    expect(cleanText('', 10)).toBe('');
  });

  it('cuts with the ellipsis inside the length, trimming the end', () => {
    expect(cutText('ab cd', 4)).toBe('ab…');
    expect(cutText('abc', 3)).toBe('abc');
    expect(cutText('abc', 0)).toBe('…');
  });
});

describe('httpLink', () => {
  it('keeps http and https addresses only', () => {
    expect(httpLink(' https://example.com/a b ')).toBe('https://example.com/a%20b');
    expect(httpLink('http://example.com')).toBe('http://example.com/');
    expect(httpLink('javascript:alert(1)')).toBeUndefined();
    expect(httpLink('data:text/html,hi')).toBeUndefined();
    expect(httpLink('not a url')).toBeUndefined();
    expect(httpLink('  ')).toBeUndefined();
    expect(httpLink(3)).toBeUndefined();
  });
});

describe('dates', () => {
  it('reads ISO, day-first and Jira days, refusing days that do not exist', () => {
    expect(trackerDay('2026-11-14T17:00:00.000Z')).toBe('2026-11-14');
    expect(trackerDay('31/12/2026')).toBe('2026-12-31');
    expect(trackerDay('20/Mar/25')).toBe('2025-03-20');
    expect(trackerDay('1/Feb/2026 3:45 PM')).toBe('2026-02-01');
    expect(trackerDay('31/Feb/26')).toBeUndefined();
    expect(trackerDay('31/Foo/26')).toBeUndefined();
    expect(trackerDay('soon')).toBeUndefined();
    expect(trackerDay(' ')).toBeUndefined();
    expect(trackerDay(null)).toBeUndefined();
  });

  it('reads instants from ISO and Jira dates with 12- and 24-hour times', () => {
    expect(trackerInstant('2026-10-27T09:05:00.000Z')).toBe(Date.UTC(2026, 9, 27, 9, 5));
    expect(trackerInstant('2026-13-45')).toBeNull();
    expect(trackerInstant('12/Mar/25 12:15 AM')).toBe(Date.UTC(2025, 2, 12, 0, 15));
    expect(trackerInstant('12/Mar/25 12:15 PM')).toBe(Date.UTC(2025, 2, 12, 12, 15));
    expect(trackerInstant('12/Mar/2025 17:30')).toBe(Date.UTC(2025, 2, 12, 17, 30));
    expect(trackerInstant('12/Mar/25')).toBe(Date.UTC(2025, 2, 12));
    expect(trackerInstant('30/Feb/25 1:00')).toBeNull();
    expect(trackerInstant('yesterday')).toBeNull();
    expect(trackerInstant(undefined)).toBeNull();
  });
});

describe('trackerPriority and trackerEstimate', () => {
  it('maps the tools’ priority words', () => {
    expect(['Highest', 'Urgent', 'Critical', 'Blocker'].map(trackerPriority)).toEqual([
      'urgent',
      'urgent',
      'urgent',
      'urgent',
    ]);
    expect(trackerPriority('High')).toBe('high');
    expect(trackerPriority('Normal')).toBe('medium');
    expect(['Low', 'Lowest', 'Minor', 'Trivial'].map(trackerPriority)).toEqual([
      'low',
      'low',
      'low',
      'low',
    ]);
    expect(trackerPriority('No priority')).toBeUndefined();
    expect(trackerPriority(1)).toBeUndefined();
  });

  it('reads an estimate from 0 to 999', () => {
    expect(trackerEstimate('3')).toBe(3);
    expect(trackerEstimate(0.5)).toBe(0.5);
    expect(trackerEstimate('1000')).toBeUndefined();
    expect(trackerEstimate('-1')).toBeUndefined();
    expect(trackerEstimate('')).toBeUndefined();
    expect(trackerEstimate('abc')).toBeUndefined();
    expect(trackerEstimate(null)).toBeUndefined();
  });
});

describe('commentHeader and trackerPersonOf', () => {
  it('starts a comment with its author and day', () => {
    expect(commentHeader('Ana Lopez', Date.UTC(2025, 2, 12, 23, 59))).toBe(
      'Ana Lopez · 12 Mar 2025',
    );
    expect(commentHeader('', null)).toBe('Unknown');
  });

  it('keeps an email lower-cased, naming the person by its local part unless named', () => {
    expect(trackerPersonOf('Ana Lopez', 'Ana@Example.com')).toEqual({
      name: 'Ana Lopez',
      email: 'ana@example.com',
    });
    expect(trackerPersonOf('Ben@Example.com')).toEqual({ name: 'ben', email: 'ben@example.com' });
    expect(trackerPersonOf('', 'carla@example.com')).toEqual({
      name: 'carla',
      email: 'carla@example.com',
    });
    expect(trackerPersonOf('Dana', 'not an email')).toEqual({ name: 'Dana' });
    expect(trackerPersonOf('x'.repeat(80))!.name).toHaveLength(60);
    expect(trackerPersonOf('', '')).toBeUndefined();
    expect(trackerPersonOf(undefined)).toBeUndefined();
  });
});
