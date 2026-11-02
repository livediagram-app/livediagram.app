// Dates in the reader's locale (liveworkspace/docs/specs/004-index/one-explorer.md "Dates"): every date the Explorer,
// the Settings panel and liveworkspace.app's pages write goes through here, so none forces a locale ("en-GB") and the
// browser's language and region order the parts ("3 Nov 2026" in the UK, "Nov 3, 2026" in the US).
//
// Building an Intl.DateTimeFormat is the costly part (Date#toLocaleDateString builds one on every call), so a format
// is declared once at module scope (`dateFormat(options)`) and keeps one formatter per locale, made the first time it
// is asked for and never again: a list of thousands of rows makes none per row. A caller that has to name a locale
// (a test, a server writing for a known reader) passes it; otherwise the runtime's default is the browser's.

export type DateInput = number | Date;

export type DateFormat = {
  /** The date as text, in `locale` (default: the browser's). */
  format: (at: DateInput, locale?: string) => string;
  /** The same, in parts, for a caller that lays them out itself. */
  formatToParts: (at: DateInput, locale?: string) => Intl.DateTimeFormatPart[];
  /** The formatter itself, made once per locale. */
  formatter: (locale?: string) => Intl.DateTimeFormat;
};

// The runtime's default locale has no name here: `undefined` is its key.
const DEFAULT = '';

// `hour: '2-digit'` asks for a 24-hour clock's "09:05", but a 12-hour locale pads with it too ("09:05 AM", where the
// US writes "9:05 AM"). So a two-digit hour is asked for only where the locale's clock runs 0 to 23.
function clockOptions(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatOptions {
  if (options.hour !== '2-digit') return options;
  const { hourCycle } = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    hour12: options.hour12,
    hourCycle: options.hourCycle,
  }).resolvedOptions();
  return hourCycle === 'h11' || hourCycle === 'h12' ? { ...options, hour: 'numeric' } : options;
}

/** One date format, declared once: its formatters are made lazily, one per locale, and reused. */
export function dateFormat(options: Intl.DateTimeFormatOptions): DateFormat {
  const byLocale = new Map<string, Intl.DateTimeFormat>();
  const formatter = (locale?: string) => {
    const key = locale ?? DEFAULT;
    let made = byLocale.get(key);
    if (!made) {
      made = new Intl.DateTimeFormat(locale, clockOptions(locale, options));
      byLocale.set(key, made);
    }
    return made;
  };
  return {
    format: (at, locale) => formatter(locale).format(at),
    formatToParts: (at, locale) => formatter(locale).formatToParts(at),
    formatter,
  };
}

/** "3 Nov" */
export const DAY_MONTH = dateFormat({ day: 'numeric', month: 'short' });
/** "3 November" */
export const DAY_LONG_MONTH = dateFormat({ day: 'numeric', month: 'long' });
/** "3 Nov 2026" */
export const DAY_MONTH_YEAR = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' });
/** "November 2026" */
export const MONTH_YEAR = dateFormat({ month: 'long', year: 'numeric' });
/** "14:05" or "2:05 PM", as the locale writes a time. */
export const TIME = dateFormat({ hour: '2-digit', minute: '2-digit' });
/** "14:05:09" or "2:05:09 PM". */
export const TIME_SECONDS = dateFormat({ hour: '2-digit', minute: '2-digit', second: '2-digit' });
/** "3 Nov 2026" in the locale's medium style. */
export const MEDIUM_DATE = dateFormat({ dateStyle: 'medium' });
/** "3 Nov 2026, 14:05" in the locale's medium style: the full date a relative one gives on hover. */
export const MEDIUM_DATE_TIME = dateFormat({ dateStyle: 'medium', timeStyle: 'short' });
/** "Monday" */
export const WEEKDAY = dateFormat({ weekday: 'long' });
