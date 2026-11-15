// An iCalendar writer for the calendar feed (docs/specs/026-plan/calendar-feed.md "How it answers"; RFC 5545;
// blueprint calendar-feed.md "Interfaces and contracts"): one VCALENDAR of all-day VEVENTs, text escaped, lines
// folded at 75 octets and ended with CRLF. Pure.

import { DAY_MS } from '@liveplanner/items';

// One card as a calendar event: all day, from `startDay` to `endDay` (day numbers since 1970-01-01, both included).
export type FeedEvent = {
  uid: string;
  summary: string;
  url: string;
  description: string;
  startDay: number;
  endDay: number;
  // The card's last change (epoch ms) and its revision, so a calendar app updates the event in place.
  stamp: number;
  sequence: number;
};

export type FeedCalendar = { name: string; events: readonly FeedEvent[] };

// The most octets a content line holds before it folds (RFC 5545 3.1).
export const ICS_LINE_OCTETS = 75;

const CRLF = '\r\n';

/** A TEXT value escaped (RFC 5545 3.3.11): backslash, semicolon, comma and line breaks; other controls dropped. */
export function escapeText(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    const code = ch.charCodeAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === ';') out += '\\;';
    else if (ch === ',') out += '\\,';
    else if (ch === '\r') {
      out += '\\n';
      if (value[i + 1] === '\n') i++;
    } else if (ch === '\n') out += '\\n';
    else if (code < 0x20 || code === 0x7f) continue;
    else out += ch;
  }
  return out;
}

const encoder = new TextEncoder();

/** One content line folded at 75 octets, each continuation starting with a space, never inside a character. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= ICS_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  // The first line holds 75 octets; each continuation 74 after its leading space.
  let limit = ICS_LINE_OCTETS;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
      limit = ICS_LINE_OCTETS - 1;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** A day number as an iCalendar DATE (`yyyymmdd`). */
export function icsDate(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** An instant as an iCalendar UTC DATE-TIME (`yyyymmddThhmmssZ`). */
export function icsStamp(ms: number): string {
  const d = new Date(ms);
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** The whole calendar, CRLF after every line. */
export function writeCalendar({ name, events }: FeedCalendar): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//liveplanner//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`${name || 'Untitled'} · liveplanner`)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(e.uid)}`,
      `DTSTAMP:${icsStamp(e.stamp)}`,
      `DTSTART;VALUE=DATE:${icsDate(e.startDay)}`,
      // DTEND is exclusive for a DATE (RFC 5545 3.6.1): the day after the last.
      `DTEND;VALUE=DATE:${icsDate(e.endDay + 1)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      // A URI value, never TEXT-escaped (RFC 5545 3.3.13).
      `URL:${e.url}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `SEQUENCE:${Math.max(0, Math.floor(e.sequence))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
