// The editor's tests read dates as en-GB ("12 Nov"), whatever the machine's own locale: CI's runners default to
// en-US ("Nov 12"). The app itself formats in the reader's locale (Intl with no locale given); this pins only the
// default that those calls fall back to, before any test file loads a formatter.
const TEST_LOCALE = 'en-GB';

const BaseDateTimeFormat = Intl.DateTimeFormat;
const pinned = function DateTimeFormat(
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions,
) {
  return new BaseDateTimeFormat(locales ?? TEST_LOCALE, options);
} as unknown as typeof Intl.DateTimeFormat;
Object.assign(pinned, BaseDateTimeFormat);
Object.defineProperty(pinned, 'prototype', { value: BaseDateTimeFormat.prototype });
Intl.DateTimeFormat = pinned;

for (const method of ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'] as const) {
  const base = Date.prototype[method];
  Date.prototype[method] = function (
    this: Date,
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) {
    return base.call(this, locales ?? TEST_LOCALE, options);
  };
}
