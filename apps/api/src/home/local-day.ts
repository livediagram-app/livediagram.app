// Days for Home (docs/specs/013-workspace/explorer-home.md).
//
// What happened groups by the READER's calendar day, so its headings say Today and Yesterday the
// way the reader means them; the zone comes from the client as an IANA name and Intl resolves each
// instant's own offset, daylight saving included. Opens are counted per UTC day, the boundary every
// coalesced timeline event uses, because one row is shared and must not split by who reads it.

import { HOME_TZ_MAX_LENGTH } from '@livediagram/api-schema';

/** The time zone to group in: UTC when none is sent, null when the name is not one Intl knows. */
export function parseTimeZone(raw: string | null): string | null {
  if (raw === null) return 'UTC';
  if (raw.length === 0 || raw.length > HOME_TZ_MAX_LENGTH) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: raw }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** `YYYY-MM-DD` of `at` in `timeZone`, which must have passed `parseTimeZone`. */
export function localDay(at: number, timeZone: string): string {
  let format = formatters.get(timeZone);
  if (!format) {
    // en-CA formats a date as YYYY-MM-DD.
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, format);
  }
  return format.format(at);
}

/** `YYYY-MM-DD` of `at` in UTC. */
export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}
