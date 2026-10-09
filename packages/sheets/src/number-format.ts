// How a value is drawn (docs/specs/029-sheets/sheet.md "Number formats"): in the viewer's locale, so two people
// may see 1,234.50 and 1.234,50 for one value. Intl formatters are cached per locale and options.
import { dateFromSerial } from './dates';
import { formatCodeText } from './format-codes';
import type { CellFormat } from './sheet';
import { DEFAULT_WHY, isArray, isError, numberText, scalarOf, type Value } from './formula/values';
import { localeSeparators } from './input';

export type DisplayText = {
  text: string;
  // How the value aligns unless the cell sets its own (numbers right, text left, booleans centre).
  align: 'l' | 'c' | 'r';
  error?: string; // the hover reason, for an error
  kind: 'empty' | 'number' | 'text' | 'boolean' | 'error';
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();
function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = FORMATTERS.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, opts);
    } catch {
      f = new Intl.NumberFormat('en', opts);
    }
    FORMATTERS.set(key, f);
  }
  return f;
}

const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
function df(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = DATE_FORMATTERS.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' });
    } catch {
      f = new Intl.DateTimeFormat('en', { ...opts, timeZone: 'UTC' });
    }
    DATE_FORMATTERS.set(key, f);
  }
  return f;
}

function utcDate(serial: number): Date {
  const p = dateFromSerial(serial);
  return new Date(Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s));
}

function decimals(format: CellFormat | undefined, fallback: number): number {
  return format?.dp ?? fallback;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// A number in Automatic: as typed, with the locale's decimal mark and no grouping.
function autoNumber(n: number, locale: string): string {
  const t = numberText(n);
  const { decimal } = localeSeparators(locale);
  return decimal === '.' ? t : t.replace('.', decimal);
}

export function formatNumber(n: number, format: CellFormat | undefined, locale: string): string {
  const kind = format?.nf ?? 'auto';
  switch (kind) {
    case 'number': {
      const dp = decimals(format, 2);
      return nf(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
    }
    case 'percent': {
      const dp = decimals(format, 2);
      return nf(locale, {
        style: 'percent',
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      }).format(n);
    }
    case 'currency':
    case 'accounting': {
      const dp = decimals(format, 2);
      const sym = format?.cur ?? '£';
      const body = nf(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(
        Math.abs(n),
      );
      if (kind === 'accounting') return n < 0 ? `${sym} (${body})` : `${sym} ${body}`;
      return `${n < 0 ? '-' : ''}${sym}${body}`;
    }
    case 'scientific': {
      const dp = decimals(format, 2);
      const [m, e] = n.toExponential(dp).split('e');
      const exp = Number(e);
      const { decimal } = localeSeparators(locale);
      return `${m!.replace('.', decimal)}E${exp < 0 ? '-' : '+'}${pad2(Math.abs(exp))}`;
    }
    case 'date':
      return df(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(utcDate(n));
    case 'time':
      return df(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(utcDate(n));
    case 'datetime':
      return df(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(utcDate(n));
    case 'duration': {
      const total = Math.round(Math.abs(n) * 86_400);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return `${n < 0 ? '-' : ''}${h}:${pad2(m)}:${pad2(s)}`;
    }
    case 'text':
    case 'auto':
    default:
      if (format?.dp !== undefined)
        return nf(locale, {
          minimumFractionDigits: format.dp,
          maximumFractionDigits: format.dp,
          useGrouping: false,
        }).format(n);
      return autoNumber(n, locale);
  }
}

export function displayValue(
  value: Value,
  format: CellFormat | undefined,
  locale: string,
): DisplayText {
  const v = isArray(value) ? scalarOf(value) : value;
  if (v === null) return { text: '', align: 'l', kind: 'empty' };
  if (isError(v)) return { text: v.e, align: 'c', kind: 'error', error: v.why ?? DEFAULT_WHY[v.e] };
  if (typeof v === 'boolean') return { text: v ? 'TRUE' : 'FALSE', align: 'c', kind: 'boolean' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { text: '#NUM!', align: 'c', kind: 'error' };
    return { text: formatNumber(v, format, locale), align: 'r', kind: 'number' };
  }
  return { text: v, align: 'l', kind: 'text' };
}

// TEXT(value, code) (formulas.md "Functions"): spreadsheet format codes, locale-independent (en), as Sheets.
export function textFormat(value: number | string, code: string): string {
  return formatCodeText(value, code);
}
