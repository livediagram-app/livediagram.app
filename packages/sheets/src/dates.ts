// Dates and times as numbers (docs/specs/029-sheets/formulas.md "Values"): days since 30 December 1899, the time
// of day a fraction, as Google Sheets counts them. All arithmetic is in UTC so a value means the same everywhere.

const MS_PER_DAY = 86_400_000;
const EPOCH_MS = Date.UTC(1899, 11, 30);
// 31 December 9999, the last date a date function accepts.
export const SERIAL_MAX = 2_958_465;

export function serialFromDate(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_MS) / MS_PER_DAY);
}

export function serialFromParts(y: number, m: number, d: number, h = 0, min = 0, s = 0): number {
  return serialFromDate(y, m, d) + (h * 3600 + min * 60 + s) / 86_400;
}

export type DateParts = {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  s: number;
  weekday: number; // 0 Sunday
};

export function dateFromSerial(serial: number): DateParts {
  const whole = Math.floor(serial);
  // Rounded to the second so 0.1 + 0.2 style drift never shows 11:59:59.
  let secs = Math.round((serial - whole) * 86_400);
  let day = whole;
  if (secs >= 86_400) {
    secs -= 86_400;
    day += 1;
  }
  const date = new Date(EPOCH_MS + day * MS_PER_DAY);
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
    h: Math.floor(secs / 3600),
    min: Math.floor((secs % 3600) / 60),
    s: secs % 60,
    weekday: date.getUTCDay(),
  };
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function monthFromName(name: string): number {
  const lower = name.toLowerCase();
  if (lower.length < 3) return 0;
  const i = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(lower.slice(0, 3)));
  if (i < 0) return 0;
  // A longer name must be the month's own spelling ("Sept" is allowed as September's).
  const full = MONTH_NAMES[i]!.toLowerCase();
  return full.startsWith(lower) || (i === 8 && lower === 'sept') ? i + 1 : 0;
}

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || y < 1 || y > 9999) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= days;
}

function fullYear(y: number, digits: number): number {
  if (digits > 2) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

// Whether a locale writes the day before the month in numeric dates (en-GB 8/10/2026 is 8 October).
const DAY_FIRST = new Map<string, boolean>();
export function localeDayFirst(locale: string): boolean {
  let v = DAY_FIRST.get(locale);
  if (v === undefined) {
    try {
      const parts = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      }).formatToParts(new Date(Date.UTC(2026, 9, 8)));
      const order = parts.filter((p) => p.type === 'day' || p.type === 'month').map((p) => p.type);
      v = order[0] === 'day';
    } catch {
      v = true;
    }
    DAY_FIRST.set(locale, v);
  }
  return v;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([ap]\.?m\.?)?$/i;

// A time of day ("14:30", "2:30 pm", "14:30:15") as a fraction of a day; null when it is not one.
export function parseTimeText(text: string): number | null {
  const m = TIME_RE.exec(text.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const s = m[3] ? Number(m[3]) : 0;
  const ampm = m[4]?.toLowerCase().replace(/\./g, '');
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
  }
  if (h > 23 || min > 59 || s > 59) return null;
  return (h * 3600 + min * 60 + s) / 86_400;
}

export type ParsedDate = { serial: number; hasTime: boolean };

// A time after a date starts at its first non-space, so the space before it and the time never compete (linear).
const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\s*(\S.*))?$/;
const NUMERIC_RE = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:\s+(\S.*))?$/;
const NAMED_DMY_RE =
  /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]+)\.?,?[\s-]+(\d{2,4})(?:\s+(\S.*))?$/;
const NAMED_MDY_RE = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})(?:\s+(\S.*))?$/;

function withTime(serial: number, rest: string | undefined): ParsedDate | null {
  if (rest === undefined) return { serial, hasTime: false };
  const t = parseTimeText(rest);
  return t === null ? null : { serial: serial + t, hasTime: true };
}

// A typed date, with an optional time after it, as a serial; null when it is not one. Numeric day and month
// order follows `dayFirst` (the typist's locale), unless the first number is a four-digit year.
export function parseDateText(text: string, dayFirst: boolean): ParsedDate | null {
  const t = text.trim();
  let m = ISO_RE.exec(t);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validDate(y, mo, d) ? withTime(serialFromDate(y, mo, d), m[4]) : null;
  }
  m = NUMERIC_RE.exec(t);
  if (m) {
    const a = m[1]!;
    const b = m[2]!;
    const c = m[3]!;
    let y: number;
    let mo: number;
    let d: number;
    if (a.length === 4) {
      [y, mo, d] = [Number(a), Number(b), Number(c)];
    } else {
      if (c.length === 3) return null;
      y = fullYear(Number(c), c.length);
      [d, mo] = dayFirst ? [Number(a), Number(b)] : [Number(b), Number(a)];
    }
    return validDate(y, mo, d) ? withTime(serialFromDate(y, mo, d), m[4]) : null;
  }
  m = NAMED_DMY_RE.exec(t);
  if (m) {
    const mo = monthFromName(m[2]!);
    const y = fullYear(Number(m[3]), m[3]!.length);
    const d = Number(m[1]);
    return mo && validDate(y, mo, d) ? withTime(serialFromDate(y, mo, d), m[4]) : null;
  }
  m = NAMED_MDY_RE.exec(t);
  if (m) {
    const mo = monthFromName(m[1]!);
    const y = fullYear(Number(m[3]), m[3]!.length);
    const d = Number(m[2]);
    return mo && validDate(y, mo, d) ? withTime(serialFromDate(y, mo, d), m[4]) : null;
  }
  return null;
}

// Today's serial in UTC for `now` (ms), as TODAY() reads it.
export function serialFromMs(ms: number): number {
  return (ms - EPOCH_MS) / MS_PER_DAY;
}

// A serial's date as YYYY-MM-DD (a Plan card's date field): its whole day, the time of day dropped.
export function isoFromSerial(serial: number): string {
  return new Date(EPOCH_MS + Math.floor(serial) * MS_PER_DAY).toISOString().slice(0, 10);
}

// A YYYY-MM-DD date's serial, or null when it is not one.
export function serialFromIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? serialFromDate(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}
