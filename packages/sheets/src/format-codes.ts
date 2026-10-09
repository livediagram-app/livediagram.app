// Spreadsheet format codes for TEXT(value, code) (docs/specs/029-sheets/formulas.md "Functions"): "0.00",
// "#,##0", "0%", "0.00E+00", "dd/mm/yyyy", "mmm yyyy", "hh:mm", "[h]:mm", "£#,##0.00", "@", sections split by ";".
// English names, locale-independent, as TEXT is in Sheets.
import { DAY_NAMES, MONTH_NAMES, dateFromSerial } from './dates';
import { numberText } from './formula/values';

type Tok =
  | { k: 'lit'; v: string }
  | { k: 'ph'; v: '0' | '#' | '?' }
  | { k: 'dot' }
  | { k: 'comma' }
  | { k: 'pct' }
  | { k: 'exp'; sign: '+' | '-'; digits: number }
  | { k: 'at' }
  | { k: 'date'; v: string };

function splitSections(code: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]!;
    if (ch === '"') quoted = !quoted;
    if (ch === '\\' && !quoted && i + 1 < code.length) {
      cur += ch + code[++i];
      continue;
    }
    if (ch === ';' && !quoted) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const DATE_RE =
  /^(\[h+\]|\[m+\]|\[s+\]|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm|a\/p|\.0+)/i;

function tokenize(section: string, dateMode: boolean): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < section.length) {
    const ch = section[i]!;
    if (ch === '"') {
      const end = section.indexOf('"', i + 1);
      const stop = end < 0 ? section.length : end;
      out.push({ k: 'lit', v: section.slice(i + 1, stop) });
      i = stop + 1;
      continue;
    }
    if (ch === '\\' && i + 1 < section.length) {
      out.push({ k: 'lit', v: section[i + 1]! });
      i += 2;
      continue;
    }
    if (ch === '_' && i + 1 < section.length) {
      out.push({ k: 'lit', v: ' ' });
      i += 2;
      continue;
    }
    if (ch === '*' && i + 1 < section.length) {
      i += 2;
      continue;
    }
    if (ch === '[' && !/^\[[hms]+\]/i.test(section.slice(i))) {
      // A colour or condition ([Red], [>100]) is read past.
      const end = section.indexOf(']', i);
      i = end < 0 ? section.length : end + 1;
      continue;
    }
    if (dateMode) {
      const m = DATE_RE.exec(section.slice(i));
      if (m) {
        out.push({ k: 'date', v: m[1]! });
        i += m[1]!.length;
        continue;
      }
    } else {
      if (ch === '0' || ch === '#' || ch === '?') {
        out.push({ k: 'ph', v: ch });
        i++;
        continue;
      }
      if (ch === '.') {
        out.push({ k: 'dot' });
        i++;
        continue;
      }
      if (ch === ',') {
        out.push({ k: 'comma' });
        i++;
        continue;
      }
      if (ch === '%') {
        out.push({ k: 'pct' });
        i++;
        continue;
      }
      const e = /^[eE]([+-])(0+)/.exec(section.slice(i));
      if (e) {
        out.push({ k: 'exp', sign: e[1] as '+' | '-', digits: e[2]!.length });
        i += e[0].length;
        continue;
      }
    }
    if (ch === '@') {
      out.push({ k: 'at' });
      i++;
      continue;
    }
    out.push({ k: 'lit', v: ch });
    i++;
  }
  return out;
}

function isDateSection(section: string): boolean {
  const bare = section
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[[^\]hms]*\]/gi, '');
  return /[dmyhs]|am\/pm|a\/p/i.test(bare) && !/[0#?]/.test(bare.replace(/\.0+/g, ''));
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatNumberSection(n: number, toks: Tok[]): string {
  let value = n;
  const pctCount = toks.filter((t) => t.k === 'pct').length;
  value *= 100 ** pctCount;
  const firstPh = toks.findIndex((t) => t.k === 'ph');
  const dotAt = toks.findIndex((t) => t.k === 'dot');
  const expTok = toks.find((t) => t.k === 'exp') as Extract<Tok, { k: 'exp' }> | undefined;
  const expAt = toks.findIndex((t) => t.k === 'exp');
  const intEnd = dotAt >= 0 ? dotAt : expAt >= 0 ? expAt : toks.length;
  const intPh = toks.slice(0, intEnd).filter((t) => t.k === 'ph');
  const fracToks = dotAt >= 0 ? toks.slice(dotAt + 1, expAt >= 0 ? expAt : undefined) : [];
  const fracPh = fracToks.filter((t) => t.k === 'ph') as Extract<Tok, { k: 'ph' }>[];
  // Commas between integer placeholders group thousands; trailing commas after them scale by 1000.
  const intToks = toks.slice(firstPh < 0 ? 0 : firstPh, intEnd);
  const lastPhInInt = intToks.map((t) => t.k).lastIndexOf('ph');
  const grouping = intToks.some((t, i) => t.k === 'comma' && i < lastPhInInt);
  // Commas straight after the last placeholder (before or after the decimals) scale by 1000 each.
  const lastPh = toks.map((t) => t.k).lastIndexOf('ph');
  let trailingCommas = 0;
  for (let i = lastPh + 1; i < toks.length && toks[i]!.k === 'comma'; i++) trailingCommas++;
  value /= 1000 ** trailingCommas;

  let body: string;
  if (firstPh < 0) {
    body = '';
  } else if (expTok) {
    const fracDigits = fracPh.length;
    let exp = value === 0 ? 0 : Math.floor(Math.log10(Math.abs(value)));
    let mant = value / 10 ** exp;
    if (Number(Math.abs(mant).toFixed(fracDigits)) >= 10) {
      mant /= 10;
      exp += 1;
    }
    const m = Math.abs(mant).toFixed(fracDigits);
    const expText = String(Math.abs(exp)).padStart(expTok.digits, '0');
    body = `${m}E${exp < 0 ? '-' : expTok.sign === '+' ? '+' : ''}${expText}`;
  } else {
    const fracMax = fracPh.length;
    const fracMin = (() => {
      let k = fracPh.length;
      while (k > 0 && fracPh[k - 1]!.v === '#') k--;
      return k;
    })();
    const fixed = Math.abs(value).toFixed(fracMax);
    let [intPart, frac = ''] = fixed.split('.');
    while (frac.length > fracMin && frac.endsWith('0')) frac = frac.slice(0, -1);
    const minInt = intPh.filter((t) => t.k === 'ph' && t.v === '0').length;
    if (intPart === '0' && minInt === 0) intPart = '';
    intPart = intPart!.padStart(minInt, '0');
    if (grouping) intPart = group(intPart);
    body = dotAt >= 0 && (frac.length > 0 || fracPh.length > 0) ? `${intPart}.${frac}` : intPart;
    if (dotAt >= 0 && frac.length === 0 && fracMin === 0) body = `${intPart}.`;
  }
  // Literals before the first placeholder lead; the rest follow.
  let prefix = '';
  let suffix = '';
  toks.forEach((t, i) => {
    const text = t.k === 'lit' ? t.v : t.k === 'pct' ? '%' : '';
    if (!text) return;
    if (firstPh < 0 || i < firstPh) prefix += text;
    else suffix += text;
  });
  return `${prefix}${body}${suffix}`;
}

function formatDateSection(serial: number, toks: Tok[]): string {
  const p = dateFromSerial(serial);
  const hasAmPm = toks.some((t) => t.k === 'date' && /^(am\/pm|a\/p)$/i.test(t.v));
  let out = '';
  toks.forEach((t, i) => {
    if (t.k === 'lit') {
      out += t.v;
      return;
    }
    if (t.k !== 'date') return;
    const v = t.v.toLowerCase();
    // "m" after an hour or before a second is minutes.
    const prev = toks
      .slice(0, i)
      .reverse()
      .find((x) => x.k === 'date');
    const next = toks.slice(i + 1).find((x) => x.k === 'date');
    const minuteCtx =
      (prev?.k === 'date' && /^(h+|\[h+\])$/i.test(prev.v)) ||
      (next?.k === 'date' && /^s+$/i.test(next.v));
    const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
    const hour = hasAmPm ? h12 : p.h;
    switch (true) {
      case v === 'yyyy':
        out += String(p.y).padStart(4, '0');
        break;
      case v === 'yy':
        out += String(p.y % 100).padStart(2, '0');
        break;
      case v === 'mmmmm':
        out += MONTH_NAMES[p.m - 1]![0];
        break;
      case v === 'mmmm':
        out += MONTH_NAMES[p.m - 1];
        break;
      case v === 'mmm':
        out += MONTH_NAMES[p.m - 1]!.slice(0, 3);
        break;
      case v === 'mm':
        out += String(minuteCtx ? p.min : p.m).padStart(2, '0');
        break;
      case v === 'm':
        out += String(minuteCtx ? p.min : p.m);
        break;
      case v === 'dddd':
        out += DAY_NAMES[p.weekday];
        break;
      case v === 'ddd':
        out += DAY_NAMES[p.weekday]!.slice(0, 3);
        break;
      case v === 'dd':
        out += String(p.d).padStart(2, '0');
        break;
      case v === 'd':
        out += String(p.d);
        break;
      case v === 'hh':
        out += String(hour).padStart(2, '0');
        break;
      case v === 'h':
        out += String(hour);
        break;
      case v === 'ss':
        out += String(p.s).padStart(2, '0');
        break;
      case v === 's':
        out += String(p.s);
        break;
      case v === 'am/pm':
        out += p.h < 12 ? 'AM' : 'PM';
        break;
      case v === 'a/p':
        out += p.h < 12 ? 'A' : 'P';
        break;
      case /^\[h+\]$/.test(v):
        out += String(Math.floor(serial * 24)).padStart(v.length - 2, '0');
        break;
      case /^\[m+\]$/.test(v):
        out += String(Math.floor(serial * 1440)).padStart(v.length - 2, '0');
        break;
      case /^\[s+\]$/.test(v):
        out += String(Math.round(serial * 86_400)).padStart(v.length - 2, '0');
        break;
      case v.startsWith('.'): {
        const digits = v.length - 1;
        const frac = (serial * 86_400) % 1;
        out += `.${Math.floor(frac * 10 ** digits)
          .toString()
          .padStart(digits, '0')}`;
        break;
      }
    }
  });
  return out;
}

export function formatCodeText(value: number | string, code: string): string {
  const sections = splitSections(code);
  if (typeof value === 'string') {
    const textSection = sections[3] ?? sections.find((s) => s.includes('@'));
    if (!textSection) return value;
    return tokenize(textSection, false)
      .map((t) => (t.k === 'at' ? value : t.k === 'lit' ? t.v : ''))
      .join('');
  }
  let section = sections[0]!;
  let n = value;
  if (n < 0 && sections.length >= 2 && sections[1] !== '') {
    section = sections[1]!;
    n = -n;
  } else if (n === 0 && sections.length >= 3) {
    section = sections[2]!;
  }
  if (section.trim() === '' && code.trim() === '') return numberText(value);
  if (section.trim().toLowerCase() === 'general') return numberText(n);
  if (isDateSection(section)) return formatDateSection(n, tokenize(section, true));
  const toks = tokenize(section, false);
  const text = formatNumberSection(n, toks);
  // One section for every number: a negative keeps its minus.
  return value < 0 && section === sections[0] ? `-${text}` : text;
}
