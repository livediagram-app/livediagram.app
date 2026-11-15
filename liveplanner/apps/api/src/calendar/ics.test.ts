// The calendar feed's iCalendar writer (docs/specs/026-plan/calendar-feed.md "How it answers"; RFC 5545).
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { escapeText, foldLine, icsDate, icsStamp, writeCalendar, type FeedEvent } from './ics';

const octets = (s: string) => new TextEncoder().encode(s).length;

const event = (extra: Partial<FeedEvent> = {}): FeedEvent => ({
  uid: 'card1.plan1@liveplanner.app',
  summary: '#1 Launch',
  url: 'https://www.liveplanner.app/project/plan1#item=card1',
  description: 'Kanban · To Do\nhttps://www.liveplanner.app/project/plan1#item=card1',
  startDay: 20_400,
  endDay: 20_400,
  stamp: Date.UTC(2026, 0, 2, 3, 4, 5),
  sequence: 3,
  ...extra,
});

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and every line break, and drops other controls', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf\rg\u0007h\u007f')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng' + 'h');
  });
});

describe('foldLine', () => {
  it('leaves a line of 75 octets alone', () => {
    const line = 'x'.repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it('folds at 75 octets, continuations starting with a space and holding 74 more', () => {
    const folded = foldLine('x'.repeat(200));
    const lines = folded.split('\r\n');
    expect(lines[0]).toHaveLength(75);
    expect(lines.slice(1).every((l) => l.startsWith(' ') && octets(l) <= 75)).toBe(true);
    expect(lines.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe('x'.repeat(200));
  });

  it('never splits a multi-byte character across lines', () => {
    const line = `SUMMARY:${'é'.repeat(60)}🚀${'日'.repeat(30)}`;
    const lines = foldLine(line).split('\r\n');
    expect(lines.every((l) => octets(l) <= 75)).toBe(true);
    expect(lines.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(line);
  });

  it('folds a very long line in linear time', () => {
    const line = 'é'.repeat(200_000);
    expect(cpuMsOf(() => foldLine(line))).toBeLessThan(1500);
  });
});

describe('dates', () => {
  it('writes a day as a DATE and an instant as a UTC DATE-TIME', () => {
    expect(icsDate(Date.UTC(2026, 10, 15) / 86_400_000)).toBe('20261115');
    expect(icsStamp(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe('20260102T030405Z');
  });
});

describe('writeCalendar', () => {
  it('writes a VCALENDAR of all-day VEVENTs, CRLF after every line', () => {
    const text = writeCalendar({ name: 'Relaunch, v2', events: [event({ endDay: 20_402 })] });
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(text.split('\r\n').slice(0, 8)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//liveplanner//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Relaunch\\, v2 · liveplanner',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
    ]);
    expect(text).not.toMatch(/[^\r]\n/);
    expect(text).toContain('DTSTART;VALUE=DATE:20251108\r\n');
    // DTEND is the day after the last.
    expect(text).toContain('DTEND;VALUE=DATE:20251111\r\n');
    expect(text).toContain('DTSTAMP:20260102T030405Z\r\n');
    expect(text).toContain('UID:card1.plan1@liveplanner.app\r\n');
    expect(text).toContain('SUMMARY:#1 Launch\r\n');
    expect(text).toContain('URL:https://www.liveplanner.app/project/plan1#item=card1\r\n');
    expect(text).toContain('SEQUENCE:3\r\n');
    expect(text).toContain('DESCRIPTION:Kanban · To Do\\nhttps://www.liveplanner.app/proj');
  });

  it('names an unnamed plan Untitled, and writes an empty calendar for no events', () => {
    const text = writeCalendar({ name: '', events: [] });
    expect(text).toContain('X-WR-CALNAME:Untitled · liveplanner');
    expect(text).not.toContain('BEGIN:VEVENT');
  });
});
