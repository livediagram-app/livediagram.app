import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VersionSummary } from '@liveknowledge/api-schema';
import {
  copyName,
  dayHeading,
  kindWords,
  timeOfDay,
  versionsByDay,
  versionTitle,
  whenWords,
} from './version-words';

// The panel's words (docs/specs/006-document/version-history.md "In the editor"), on a pinned clock and locale.

const NOW = new Date(2026, 10, 15, 15, 0).getTime(); // Sunday 15 November 2026, 15:00 local
const at = (day: number, hour = 9, minute = 30, month = 10, year = 2026) =>
  new Date(year, month, day, hour, minute).getTime();
const version = (
  id: string,
  savedAt: number,
  extra: Partial<VersionSummary> = {},
): VersionSummary => ({
  id,
  tabId: 't1',
  rev: 1,
  kind: 'idle',
  name: null,
  author: null,
  savedAt,
  createdAt: savedAt,
  bytes: 1,
  elementCount: 0,
  ...extra,
});

// ICU puts a narrow no-break space before AM / PM in newer releases.
const plain = (text: string) => text.replace(/\s/g, ' ');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('titles', () => {
  it('names a version by its name, else its kind', () => {
    expect(versionTitle({ name: 'Pitch', kind: 'idle' })).toBe('Pitch');
    expect(versionTitle({ name: null, kind: 'idle' })).toBe('Automatic');
    expect(versionTitle({ name: null, kind: 'agent' })).toBe('Before an AI edit');
    expect(versionTitle({ name: null, kind: 'restore' })).toBe('Before restoring');
    expect(kindWords('manual')).toBe('Named');
  });
});

describe('days', () => {
  it('heads today, yesterday, the weekday within the week, then the date', () => {
    expect(dayHeading(at(15), NOW, 'en-GB')).toBe('Today');
    expect(dayHeading(at(14, 23, 59), NOW, 'en-GB')).toBe('Yesterday');
    expect(dayHeading(at(11), NOW, 'en-GB')).toBe('Wednesday');
    expect(dayHeading(at(3), NOW, 'en-GB')).toBe('3 November');
    expect(dayHeading(at(3, 9, 30, 10, 2025), NOW, 'en-GB')).toBe('3 November 2025');
  });

  it('groups versions under their day, newest first', () => {
    const days = versionsByDay(
      [
        version('a', at(15, 14)),
        version('b', at(15, 9)),
        version('c', at(14)),
        version('d', at(3)),
      ],
      NOW,
      'en-GB',
    );
    expect(days.map((d) => [d.heading, d.versions.map((v) => v.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['3 November', ['d']],
    ]);
  });
});

describe('times', () => {
  it('says when in the viewer’s clock', () => {
    expect(plain(timeOfDay(at(15, 9, 5), 'en-US'))).toBe('9:05 AM');
    expect(plain(timeOfDay(at(15, 21, 5), 'en-US'))).toBe('9:05 PM');
    expect(plain(whenWords(at(15, 9, 5), NOW, 'en-US'))).toBe('today at 9:05 AM');
    expect(plain(whenWords(at(14, 9, 5), NOW, 'en-US'))).toBe('yesterday at 9:05 AM');
    expect(plain(whenWords(at(3, 9, 5), NOW, 'en-US'))).toBe('on November 3 at 9:05 AM');
  });

  it('names a copy for the day it was kept', () => {
    expect(copyName('Pitch', at(14), 'en-GB')).toBe('Pitch (14 Nov)');
  });
});
