// The Details view's cell text. `locale` is the reader's (undefined) outside tests.

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

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

/** "23 Oct 2026, 14:05" in the reader's locale. The formatter is made once per locale (rows call this a lot). */
export function formatDateTime(
  at: number,
  { locale, timeZone }: { locale?: string; timeZone?: string } = {},
): string {
  const key = `${locale ?? ''}|${timeZone ?? ''}`;
  let format = dateTimeFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone });
    dateTimeFormats.set(key, format);
  }
  return format.format(at);
}
