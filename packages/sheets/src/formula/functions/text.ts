// Text functions (docs/specs/029-sheets/formulas.md "Functions": Text). Results are bounded by TEXT_RESULT_MAX;
// REGEX functions by a work estimate, since a regular expression cannot be interrupted.
import { REGEX_WORK_MAX, TEXT_RESULT_MAX } from '../../limits';
import { textFormat } from '../../number-format';
import { parseLocaleNumber } from '../../input';
import { localeDayFirst, parseDateText, parseTimeText } from '../../dates';
import { MANY, boolArg, flatScalars, fn, opt, scalarFn, textArg, type FnDef } from '../fn';
import { err, isError, toNumber, toText, type Scalar, type Value } from '../values';

function bounded(text: string): Value {
  return text.length > TEXT_RESULT_MAX
    ? err('#VALUE!', 'The text is longer than a cell holds')
    : text;
}

function texts(xs: Scalar[]): string[] | Value {
  const out: string[] = [];
  for (const x of xs) {
    const t = toText(x);
    if (isError(t)) return t;
    out.push(t);
  }
  return out;
}

// A text function of fixed arguments: the first `nText` read as text, the rest as numbers (absent ones undefined).
function textFn(
  min: number,
  max: number,
  nText: number,
  each: (ts: string[], ns: (number | undefined)[]) => Value,
): FnDef {
  return scalarFn(min, max, (xs) => {
    const ts: string[] = [];
    const ns: (number | undefined)[] = [];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!;
      if (i < nText) {
        const t = toText(x);
        if (isError(t)) return t;
        ts.push(t);
      } else if (x === null && i >= min) {
        ns.push(undefined);
      } else {
        const n = toNumber(x);
        if (typeof n !== 'number') return n;
        ns.push(n);
      }
    }
    const out = each(ts, ns);
    return typeof out === 'string' ? bounded(out) : out;
  });
}

function regex(pattern: string, text: string, flags = 'u'): RegExp | Value {
  if (pattern.length * Math.max(1, text.length) > REGEX_WORK_MAX)
    return err('#VALUE!', 'This pattern is too costly to run on this text');
  try {
    return new RegExp(pattern, flags);
  } catch {
    return err('#VALUE!', `"${pattern}" is not a valid regular expression`);
  }
}

// A SEARCH pattern as a regular expression: * and ? are wildcards, ~ escapes them, everything else is literal.
function wildcardSource(pattern: string): string {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '~' && i + 1 < pattern.length && '*?~'.includes(pattern[i + 1]!)) {
      const next = pattern[++i]!;
      out += next === '~' ? '~' : `\\${next}`;
    } else if (ch === '*') out += '[\\s\\S]*';
    else if (ch === '?') out += '[\\s\\S]';
    else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return out;
}

export const TEXT_FUNCTIONS: Record<string, FnDef> = {
  CONCAT: fn(1, MANY, (args, f) => {
    const ts = texts(flatScalars(args, f));
    return Array.isArray(ts) ? bounded(ts.join('')) : ts;
  }),
  CONCATENATE: fn(1, MANY, (args, f) => {
    const ts = texts(flatScalars(args, f));
    return Array.isArray(ts) ? bounded(ts.join('')) : ts;
  }),
  TEXTJOIN: fn(3, MANY, (args, f) => {
    const delim = textArg(args[0]!, f);
    if (isError(delim)) return delim;
    const skip = boolArg(args[1]!, f);
    if (isError(skip)) return skip;
    const ts = texts(flatScalars(args.slice(2), f));
    if (!Array.isArray(ts)) return ts;
    return bounded((skip ? ts.filter((t) => t !== '') : ts).join(delim));
  }),
  JOIN: fn(2, MANY, (args, f) => {
    const delim = textArg(args[0]!, f);
    if (isError(delim)) return delim;
    const ts = texts(flatScalars(args.slice(1), f));
    return Array.isArray(ts) ? bounded(ts.join(delim)) : ts;
  }),
  LEFT: textFn(1, 2, 1, ([t], [n = 1]) => (n < 0 ? err('#VALUE!') : [...t!].slice(0, n).join(''))),
  RIGHT: textFn(1, 2, 1, ([t], [n = 1]) => {
    if (n < 0) return err('#VALUE!');
    const chars = [...t!];
    return n === 0 ? '' : chars.slice(-n).join('');
  }),
  MID: textFn(3, 3, 1, ([t], [start, n]) => {
    if (start! < 1 || n! < 0) return err('#VALUE!');
    return [...t!].slice(start! - 1, start! - 1 + n!).join('');
  }),
  LEN: textFn(1, 1, 1, ([t]) => [...t!].length),
  UPPER: textFn(1, 1, 1, ([t]) => t!.toUpperCase()),
  LOWER: textFn(1, 1, 1, ([t]) => t!.toLowerCase()),
  PROPER: textFn(1, 1, 1, ([t]) =>
    t!
      .toLowerCase()
      .replace(/(^|[^\p{L}\p{N}'])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()),
  ),
  TRIM: textFn(1, 1, 1, ([t]) => t!.replace(/ +/g, ' ').trim()),
  CLEAN: textFn(1, 1, 1, ([t]) => [...t!].filter((ch) => ch.charCodeAt(0) >= 32).join('')),
  SUBSTITUTE: textFn(3, 4, 3, ([t, from, to], [nth]) => {
    if (from === '') return t!;
    if (nth === undefined) return t!.split(from!).join(to!);
    if (nth < 1) return err('#VALUE!');
    let at = -1;
    for (let k = 0; k < nth; k++) {
      at = t!.indexOf(from!, at + 1);
      if (at < 0) return t!;
    }
    return t!.slice(0, at) + to! + t!.slice(at + from!.length);
  }),
  REPLACE: scalarFn(4, 4, ([t, start, n, by]) => {
    const text = toText(t!);
    const s = toNumber(start!);
    const len = toNumber(n!);
    const rep = toText(by!);
    for (const x of [text, s, len, rep]) if (isError(x as Value)) return x as Value;
    if ((s as number) < 1 || (len as number) < 0) return err('#VALUE!');
    const chars = [...(text as string)];
    chars.splice((s as number) - 1, len as number, rep as string);
    return bounded(chars.join(''));
  }),
  FIND: textFn(2, 3, 2, ([needle, hay], [start = 1]) => {
    const i = hay!.indexOf(needle!, start - 1);
    return start < 1 || i < 0 ? err('#VALUE!', `"${needle}" was not found`) : i + 1;
  }),
  SEARCH: textFn(2, 3, 2, ([needle, hay], [start = 1]) => {
    if (start < 1 || start > hay!.length + 1) return err('#VALUE!');
    const re = regex(wildcardSource(needle!), hay!, 'iu');
    if (!(re instanceof RegExp)) return re;
    const m = re.exec(hay!.slice(start - 1));
    return m ? m.index + start : err('#VALUE!', `"${needle}" was not found`);
  }),
  REPT: textFn(2, 2, 1, ([t], [n]) => {
    if (n! < 0) return err('#VALUE!');
    if (t!.length * n! > TEXT_RESULT_MAX)
      return err('#VALUE!', 'The text is longer than a cell holds');
    return t!.repeat(Math.floor(n!));
  }),
  EXACT: textFn(2, 2, 2, ([a, b]) => a === b),
  TEXT: scalarFn(2, 2, ([v, code]) => {
    const c = toText(code!);
    if (isError(c)) return c;
    if (typeof v === 'number') return bounded(textFormat(v, c));
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (isError(v!)) return v;
    return bounded(textFormat(v ?? '', c));
  }),
  VALUE: scalarFn(1, 1, ([v], f) => {
    if (typeof v === 'number') return v;
    if (v === null) return 0;
    if (typeof v !== 'string') return isError(v!) ? v : err('#VALUE!');
    const t = v.trim();
    const pct = t.endsWith('%') ? parseLocaleNumber(t.slice(0, -1).trim(), f.locale) : null;
    if (pct !== null) return pct / 100;
    const n = parseLocaleNumber(t.replace(/^[£$€¥₹]/, ''), f.locale);
    if (n !== null) return n;
    const time = parseTimeText(t);
    if (time !== null) return time;
    const date = parseDateText(t, localeDayFirst(f.locale));
    return date ? date.serial : err('#VALUE!', `"${t}" is not a number`);
  }),
  CHAR: textFn(1, 1, 0, (_t, [n]) => {
    const code = Math.trunc(n!);
    return code < 1 || code > 0x10ffff ? err('#VALUE!') : String.fromCodePoint(code);
  }),
  CODE: textFn(1, 1, 1, ([t]) => (t === '' ? err('#VALUE!') : t!.codePointAt(0)!)),
  SPLIT: fn(2, 4, (args, f) => {
    const text = textArg(args[0]!, f);
    const delim = textArg(args[1]!, f);
    const each = opt(args, 2, f, boolArg, true);
    const dropEmpty = opt(args, 3, f, boolArg, true);
    for (const x of [text, delim, each, dropEmpty]) if (isError(x as Value)) return x as Value;
    if (delim === '') return text as string;
    let parts: string[];
    if (each) {
      const set = new Set([...(delim as string)]);
      parts = [];
      let cur = '';
      for (const ch of text as string) {
        if (set.has(ch)) {
          parts.push(cur);
          cur = '';
        } else cur += ch;
      }
      parts.push(cur);
    } else {
      parts = (text as string).split(delim as string);
    }
    if (dropEmpty) parts = parts.filter((p) => p !== '');
    if (parts.length === 0) return '';
    return { rows: [parts] };
  }),
  REGEXMATCH: textFn(2, 2, 2, ([t, p]) => {
    const re = regex(p!, t!);
    return re instanceof RegExp ? re.test(t!) : re;
  }),
  REGEXEXTRACT: textFn(2, 2, 2, ([t, p]) => {
    const re = regex(p!, t!);
    if (!(re instanceof RegExp)) return re;
    const m = re.exec(t!);
    if (!m) return err('#N/A', 'The pattern did not match');
    return m.length > 1 ? (m[1] ?? '') : m[0];
  }),
  REGEXREPLACE: textFn(3, 3, 3, ([t, p, by]) => {
    const re = regex(p!, t!, 'gu');
    return re instanceof RegExp ? t!.replace(re, by!) : re;
  }),
  // The link itself is the editor's (workbook.hyperlinkOf); the value is the label.
  HYPERLINK: textFn(1, 2, 2, ([url, label]) =>
    label === undefined || label === '' ? url! : label,
  ),
};
