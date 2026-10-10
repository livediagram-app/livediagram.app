// What a typed input becomes, for everything but formulas (docs/specs/029-sheets/formulas.md "What a typed input
// becomes"; blueprint sheets-engine.md "Typed input"). Read once when saved, and stored as what it means, so every
// viewer reads it the same whatever their locale. Formulas are read by typed-input.ts, which adds the parser.
import { localeDayFirst, parseDateText, parseTimeText } from './dates';
import type { CellInput, NumberFormatKind } from './sheet';

export const CURRENCY_SYMBOLS = [
  'R$',
  'CHF',
  'zł',
  'kr',
  '£',
  '$',
  '€',
  '¥',
  '₹',
  '₩',
  '₽',
  '₺',
  '₪',
  '₫',
] as const;

export type FormatHint = { nf: NumberFormatKind; cur?: string };

export type LiteralRead =
  { kind: 'clear' } | { kind: 'value'; input: CellInput; hint?: FormatHint };

type Separators = { group: string; decimal: string };
const SEPARATORS = new Map<string, Separators>();

export function localeSeparators(locale: string): Separators {
  let v = SEPARATORS.get(locale);
  if (!v) {
    v = { group: ',', decimal: '.' };
    try {
      const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
      v = {
        group: parts.find((p) => p.type === 'group')?.value ?? ',',
        decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
      };
    } catch {
      // An unknown locale reads as en.
    }
    SEPARATORS.set(locale, v);
  }
  return v;
}

/** `s` as a literal inside a RegExp pattern. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A number typed in a locale ("1,234.5", "1.234,5", "1.2e3", "-3"), or null. Group separators must sit in
// threes, so "1,2" in en is not a number (it reads as text, as Sheets does).
export function parseLocaleNumber(text: string, locale: string): number | null {
  const { group, decimal } = localeSeparators(locale);
  // A no-break space group (fr) also accepts a plain space.
  const g = group === ' ' || group === ' ' ? '[\\s  ]' : escapeRegExp(group);
  const d = escapeRegExp(decimal);
  const re = new RegExp(
    `^([+-]?)(\\d{1,3}(?:${g}\\d{3})+|\\d+)?(?:${d}(\\d+))?(?:[eE]([+-]?\\d+))?$`,
  );
  const m = re.exec(text);
  if (!m || (m[2] === undefined && m[3] === undefined)) return null;
  const whole = (m[2] ?? '0').replace(new RegExp(g, 'g'), '');
  const n = Number(`${m[1]}${whole}${m[3] ? `.${m[3]}` : ''}${m[4] ? `e${m[4]}` : ''}`);
  return Number.isFinite(n) ? n : null;
}

// A plain `.`-decimal number with no grouping, as text in formulas is coerced ("3", "-1.5", "2e3").
export function parsePlainNumber(text: string): number | null {
  const t = text.trim();
  // The fraction only after a point, so the digits either side never compete for one run (linear).
  if (!/^[+-]?(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function readNumberish(text: string, locale: string): LiteralRead | null {
  let t = text;
  let sign = '';
  if (t.startsWith('-') || t.startsWith('+')) {
    sign = t[0]!;
    t = t.slice(1).trimStart();
  }
  let cur: string | undefined;
  for (const sym of CURRENCY_SYMBOLS) {
    if (t.startsWith(sym)) {
      cur = sym;
      t = t.slice(sym.length).trimStart();
      break;
    }
  }
  if (!cur && t.startsWith('-')) return null;
  let percent = false;
  if (t.endsWith('%')) {
    percent = true;
    t = t.slice(0, -1).trimEnd();
  }
  if (cur && percent) return null;
  const n = parseLocaleNumber(`${sign === '-' ? '-' : ''}${t}`, locale);
  if (n === null) return null;
  if (percent) return { kind: 'value', input: { n: n / 100 }, hint: { nf: 'percent' } };
  if (cur) return { kind: 'value', input: { n }, hint: { nf: 'currency', cur } };
  return { kind: 'value', input: { n } };
}

// A typed input that is not a formula, read in `locale`. `asText` is the cell's Plain Text format.
export function readLiteralInput(text: string, locale: string, asText = false): LiteralRead {
  if (asText) return text === '' ? { kind: 'clear' } : { kind: 'value', input: { s: text } };
  if (text.startsWith("'")) return { kind: 'value', input: { s: text.slice(1) } };
  const t = text.trim();
  if (t === '') return { kind: 'clear' };
  const lower = t.toLowerCase();
  if (lower === 'true' || lower === 'false')
    return { kind: 'value', input: { b: lower === 'true' } };
  const num = readNumberish(t, locale);
  if (num) return num;
  const time = parseTimeText(t);
  if (time !== null) return { kind: 'value', input: { n: time }, hint: { nf: 'time' } };
  const date = parseDateText(t, localeDayFirst(locale));
  if (date)
    return {
      kind: 'value',
      input: { n: date.serial },
      hint: { nf: date.hasTime ? 'datetime' : 'date' },
    };
  return { kind: 'value', input: { s: text } };
}
