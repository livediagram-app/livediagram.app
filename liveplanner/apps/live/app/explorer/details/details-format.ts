// The Details view's cell text (docs/specs/013-workspace/explorer-details-view.md "Columns").
// `locale` is the reader's (undefined) outside tests.

const KB = 1024;
const MB = 1024 * KB;

function count(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatObjects(n: number, locale?: string): string {
  return `${count(n, locale)} ${n === 1 ? 'object' : 'objects'}`;
}

export function formatItems(n: number, locale?: string): string {
  return `${count(n, locale)} ${n === 1 ? 'item' : 'items'}`;
}

// One decimal below 10 of the unit, whole numbers from there.
function amount(value: number, locale?: string): string {
  const digits = value < 10 ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

// Kilobytes, or megabytes from 1 MB.
export function formatBytes(bytes: number, locale?: string): string {
  if (bytes >= MB) return `${amount(bytes / MB, locale)} MB`;
  return `${amount(bytes / KB, locale)} KB`;
}

export function formatSize(stats: { elements: number; bytes: number }, locale?: string): string {
  return `${formatObjects(stats.elements, locale)} (${formatBytes(stats.bytes, locale)})`;
}

export function formatDateTime(
  at: number,
  { locale, timeZone }: { locale?: string; timeZone?: string } = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(at);
}
