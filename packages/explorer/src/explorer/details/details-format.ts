// The Details view's cell text. `locale` is the reader's (undefined) outside tests.

import { dateFormat, type DateFormat } from '@liveworkspace/ui/date-format';

const KB = 1024;
const MB = 1024 * KB;

function count(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatObjects(n: number, locale?: string): string {
  return `${count(n, locale)} ${n === 1 ? 'object' : 'objects'}`;
}

/** A folder's Size cell: what it holds, in the host's noun ("1 plan", "4 diagrams"). */
export function formatHeld(n: number, one: string, many: string, locale?: string): string {
  return `${count(n, locale)} ${n === 1 ? one : many}`;
}

// One decimal below 10 of the unit, whole numbers from there.
function amount(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

/** Kilobytes, or megabytes from 1 MB. */
export function formatBytes(bytes: number, locale?: string): string {
  if (bytes >= MB) return `${amount(bytes / MB, locale)} MB`;
  return `${amount(bytes / KB, locale)} KB`;
}

/** "12 objects (3.4 KB)", or just the bytes when the app counts no objects. */
export function formatSize(
  { elements, bytes }: { elements?: number; bytes: number },
  locale?: string,
): string {
  return elements === undefined
    ? formatBytes(bytes, locale)
    : `${formatObjects(elements, locale)} (${formatBytes(bytes, locale)})`;
}

// One shared format per time zone (@liveworkspace/ui/date-format), each keeping one formatter per locale: rows call
// these a lot, and none makes a formatter of its own.
const dateTimeFormats = new Map<string, DateFormat>();
const dateFormats = new Map<string, DateFormat>();
function zoned(
  cache: Map<string, DateFormat>,
  options: Intl.DateTimeFormatOptions,
  timeZone: string | undefined,
): DateFormat {
  const key = timeZone ?? '';
  let format = cache.get(key);
  if (!format) {
    format = dateFormat(timeZone ? { ...options, timeZone } : options);
    cache.set(key, format);
  }
  return format;
}

/** "23 Oct 2026, 14:05" in the reader's locale. */
export function formatDateTime(
  at: number,
  { locale, timeZone }: { locale?: string; timeZone?: string } = {},
): string {
  return zoned(dateTimeFormats, { dateStyle: 'medium', timeStyle: 'short' }, timeZone).format(
    at,
    locale,
  );
}

/** "23 Oct 2026" in the reader's locale, for the Created column. */
export function formatDate(
  at: number,
  { locale, timeZone }: { locale?: string; timeZone?: string } = {},
): string {
  return zoned(dateFormats, { dateStyle: 'medium' }, timeZone).format(at, locale);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago, as a person says it: "Just now", "5 min ago", "3 hours ago", "Yesterday", "4 days ago", then the
 *  date ("12 Oct 2026"). The Updated column reads this, its exact time in the cell's title. */
export function formatAgo(
  at: number,
  { now = Date.now(), locale, timeZone }: { now?: number; locale?: string; timeZone?: string } = {},
): string {
  const ago = now - at;
  if (ago < MINUTE) return 'Just now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  if (ago < DAY) {
    const hours = Math.floor(ago / HOUR);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (ago < 2 * DAY) return 'Yesterday';
  if (ago < 7 * DAY) return `${Math.floor(ago / DAY)} days ago`;
  return formatDate(at, { locale, timeZone });
}
