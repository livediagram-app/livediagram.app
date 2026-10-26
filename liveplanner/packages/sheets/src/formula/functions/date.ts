// Date and time functions (docs/specs/029-sheets/formulas.md "Functions": Date and time). Dates are serials
// (dates.ts); TODAY and NOW read the viewer's local time through the frame.
import {
  SERIAL_MAX,
  dateFromSerial,
  localeDayFirst,
  parseDateText,
  parseTimeText,
  serialFromDate,
} from '../../dates';
import type { EvalValue, Frame } from '../../engine/frame';
import {
  arrayArg,
  finite,
  flatValues,
  fn,
  numArg,
  numFn,
  opt,
  scalarArg,
  scalarFn,
  textArg,
  volatileFn,
  type FnDef,
} from '../fn';
import { err, isError, toNumber, type Value } from '../values';

function checkSerial(n: number): Value {
  return n < 0 || n > SERIAL_MAX ? err('#NUM!', 'The date is out of range') : n;
}

// DATE(y, m, d): months and days past their range roll over (DATE(2026, 13, 1) is January 2027), and years before
// 1900 count from 1900, as spreadsheets do.
export function dateSerial(y: number, m: number, d: number): Value {
  let year = Math.trunc(y);
  if (year >= 0 && year < 1900) year += 1900;
  if (year < 0 || year > 9999) return err('#NUM!');
  const ms = Date.UTC(year, Math.trunc(m) - 1, 1) + (Math.trunc(d) - 1) * 86_400_000;
  const dt = new Date(ms);
  return checkSerial(serialFromDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
}

function addMonths(serial: number, months: number, endOfMonth: boolean): Value {
  const p = dateFromSerial(serial);
  const total = p.y * 12 + (p.m - 1) + Math.trunc(months);
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  if (y < 1 || y > 9999) return err('#NUM!');
  const last = serialFromDate(y, m + 1, 1) - serialFromDate(y, m, 1);
  // Before 30 December 1899 is out of range, as for every other date function.
  return checkSerial(serialFromDate(y, m, endOfMonth ? last : Math.min(p.d, last)));
}

// A date function over numbers whose first argument may also be text that reads as a date or a time
// ("2026-03-01", "14:30"), as Excel and Google Sheets read it: YEAR("2026-03-01") is 2026. The rest are numbers.
function dateFn(min: number, max: number, each: (ns: number[]) => Value): FnDef {
  return scalarFn(min, max, (xs, f) => {
    const ns: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i]!;
      if (i === 0 && typeof x === 'string') {
        const serial = parseDateText(x, localeDayFirst(f.locale))?.serial ?? parseTimeText(x);
        if (serial !== null) {
          ns.push(serial);
          continue;
        }
      }
      const n = toNumber(x);
      if (typeof n !== 'number') return n;
      ns.push(n);
    }
    return finite(each(ns));
  });
}

// A date argument: a number, or text that reads as a date ("2026-10-08").
function dateArg(v: EvalValue, f: Frame): number | Value {
  const x = scalarArg(v, f);
  if (typeof x === 'string') {
    const d = parseDateText(x, localeDayFirst(f.locale));
    if (d) return d.serial;
  }
  return toNumber(x);
}

function holidaysOf(args: EvalValue[], i: number, f: Frame): Set<number> | Value {
  const out = new Set<number>();
  const a = args[i];
  if (a === undefined || a === null) return out;
  for (const x of flatValues(arrayArg(a, f))) {
    if (isError(x)) return x;
    if (typeof x === 'number') out.add(Math.floor(x));
  }
  return out;
}

function isWeekend(serial: number): boolean {
  const wd = dateFromSerial(serial).weekday;
  return wd === 0 || wd === 6;
}

// The week of the year whose weeks start on `startDay` (0 Sunday), the week holding 1 January being week 1.
function weekNumber(serial: number, startDay: number): number {
  const p = dateFromSerial(serial);
  const jan1 = serialFromDate(p.y, 1, 1);
  const jan1wd = dateFromSerial(jan1).weekday;
  const offset = (jan1wd - startDay + 7) % 7;
  return Math.floor((Math.floor(serial) - jan1 + offset) / 7) + 1;
}

// The day a week starts on for WEEKDAY's and WEEKNUM's types 11 to 17 (Excel's, and Google Sheets' WEEKNUM):
// 11 Monday through 16 Saturday, 17 Sunday. Null for any other type.
function weekStartOfType(type: number): number | null {
  return Number.isInteger(type) && type >= 11 && type <= 17 ? (type - 10) % 7 : null;
}

function isoWeek(serial: number): number {
  const s = Math.floor(serial);
  const wd = (dateFromSerial(s).weekday + 6) % 7; // Monday 0
  const thursday = s - wd + 3;
  const year = dateFromSerial(thursday).y;
  const firstThursdayWeek = serialFromDate(year, 1, 4);
  const fwd = (dateFromSerial(firstThursdayWeek).weekday + 6) % 7;
  return Math.floor((thursday - (firstThursdayWeek - fwd + 3)) / 7) + 1;
}

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const isLastOfFebruary = (p: { y: number; m: number; d: number }) =>
  p.m === 2 && p.d === (isLeapYear(p.y) ? 29 : 28);

// YEARFRAC's year fraction, as Excel and Google Sheets count it. Basis 0 is US 30/360 with its February rule (the
// last day of February counts as the 30th); basis 1 divides by 366 when a span of a year or less takes in a
// 29 February, else by 365, and a longer span by the average length of the years it touches.
function yearFrac(a: number, b: number, basis: number): Value {
  const [s, e] = a <= b ? [a, b] : [b, a];
  const ps = dateFromSerial(s);
  const pe = dateFromSerial(e);
  switch (basis) {
    case 0: {
      let d1 = ps.d;
      let d2 = pe.d;
      if (d1 === 31 && d2 === 31) [d1, d2] = [30, 30];
      else if (d1 === 31) d1 = 30;
      else if (d1 === 30 && d2 === 31) d2 = 30;
      else if (isLastOfFebruary(ps) && isLastOfFebruary(pe)) [d1, d2] = [30, 30];
      else if (isLastOfFebruary(ps)) d1 = 30;
      return ((pe.y - ps.y) * 360 + (pe.m - ps.m) * 30 + (d2 - d1)) / 360;
    }
    case 1: {
      const days = e - s;
      const withinAYear =
        ps.y === pe.y || (pe.y === ps.y + 1 && (ps.m > pe.m || (ps.m === pe.m && ps.d >= pe.d)));
      if (withinAYear) {
        let leap = ps.y === pe.y && isLeapYear(ps.y);
        for (let y = ps.y; !leap && y <= pe.y; y++) {
          if (!isLeapYear(y)) continue;
          const feb29 = serialFromDate(y, 2, 29);
          leap = s <= feb29 && feb29 <= e;
        }
        return days / (leap ? 366 : 365);
      }
      let total = 0;
      for (let y = ps.y; y <= pe.y; y++)
        total += serialFromDate(y + 1, 1, 1) - serialFromDate(y, 1, 1);
      return days / (total / (pe.y - ps.y + 1));
    }
    case 2:
      return (e - s) / 360;
    case 3:
      return (e - s) / 365;
    case 4: {
      const d1 = Math.min(ps.d, 30);
      const d2 = Math.min(pe.d, 30);
      return ((pe.y - ps.y) * 360 + (pe.m - ps.m) * 30 + (d2 - d1)) / 360;
    }
    default:
      return err('#NUM!');
  }
}

export const DATE_FUNCTIONS: Record<string, FnDef> = {
  TODAY: volatileFn(0, 0, (_a, f) => Math.floor(f.now())),
  NOW: volatileFn(0, 0, (_a, f) => f.now()),
  DATE: numFn(3, 3, ([y, m, d]) => dateSerial(y!, m!, d!)),
  TIME: numFn(3, 3, ([h, m, s]) => {
    const secs = Math.trunc(h!) * 3600 + Math.trunc(m!) * 60 + Math.trunc(s!);
    if (secs < 0) return err('#NUM!');
    // Whole seconds wrapped before dividing, so TIME(25, 0, 0) is exactly TIME(1, 0, 0).
    return (secs % 86_400) / 86_400;
  }),
  DATEVALUE: scalarFn(1, 1, ([t], f) => {
    if (typeof t === 'number') return Math.floor(t);
    if (typeof t !== 'string') return err('#VALUE!');
    const d = parseDateText(t, localeDayFirst(f.locale));
    return d ? Math.floor(d.serial) : err('#VALUE!', `"${t}" is not a date`);
  }),
  TIMEVALUE: scalarFn(1, 1, ([t], f) => {
    if (typeof t !== 'string') return err('#VALUE!');
    const time = parseTimeText(t);
    if (time !== null) return time;
    const d = parseDateText(t, localeDayFirst(f.locale));
    return d ? d.serial - Math.floor(d.serial) : err('#VALUE!', `"${t}" is not a time`);
  }),
  YEAR: dateFn(1, 1, ([s]) => dateFromSerial(s!).y),
  MONTH: dateFn(1, 1, ([s]) => dateFromSerial(s!).m),
  DAY: dateFn(1, 1, ([s]) => dateFromSerial(s!).d),
  HOUR: dateFn(1, 1, ([s]) => dateFromSerial(s!).h),
  MINUTE: dateFn(1, 1, ([s]) => dateFromSerial(s!).min),
  SECOND: dateFn(1, 1, ([s]) => dateFromSerial(s!).s),
  WEEKDAY: dateFn(1, 2, ([s, type = 1]) => {
    const wd = dateFromSerial(s!).weekday;
    if (type === 1) return wd + 1;
    if (type === 2) return ((wd + 6) % 7) + 1;
    if (type === 3) return (wd + 6) % 7;
    const start = weekStartOfType(type);
    return start === null ? err('#NUM!') : ((wd - start + 7) % 7) + 1;
  }),
  WEEKNUM: dateFn(1, 2, ([s, type = 1]) => {
    if (type === 1 || type === 2) return weekNumber(s!, type === 2 ? 1 : 0);
    if (type === 21) return isoWeek(s!);
    const start = weekStartOfType(type);
    return start === null ? err('#NUM!') : weekNumber(s!, start);
  }),
  ISOWEEKNUM: dateFn(1, 1, ([s]) => isoWeek(s!)),
  EDATE: dateFn(2, 2, ([s, m]) => addMonths(s!, m!, false)),
  EOMONTH: dateFn(2, 2, ([s, m]) => addMonths(s!, m!, true)),
  DATEDIF: fn(3, 3, (args, f) => {
    const a = dateArg(args[0]!, f);
    const b = dateArg(args[1]!, f);
    if (typeof a !== 'number') return a;
    if (typeof b !== 'number') return b;
    const unit = textArg(args[2]!, f);
    if (isError(unit)) return unit;
    if (b < a) return err('#NUM!', 'The start date is after the end date');
    const pa = dateFromSerial(a);
    const pb = dateFromSerial(b);
    let months = (pb.y - pa.y) * 12 + (pb.m - pa.m);
    if (pb.d < pa.d) months -= 1;
    switch (unit.toUpperCase()) {
      case 'Y':
        return Math.floor(months / 12);
      case 'M':
        return months;
      case 'D':
        return Math.floor(b) - Math.floor(a);
      case 'MD': {
        // The days left after the whole months, counted from the start moved on by those months (a month end
        // clamps: 31 January plus a month is 28 February), never negative as Excel's can be.
        const moved = addMonths(Math.floor(a), months, false);
        return typeof moved === 'number' ? Math.floor(b) - moved : moved;
      }
      case 'YM':
        return months % 12;
      case 'YD': {
        let start = serialFromDate(pb.y, pa.m, pa.d);
        if (start > b) start = serialFromDate(pb.y - 1, pa.m, pa.d);
        return Math.floor(b) - start;
      }
      default:
        return err('#NUM!', `"${unit}" is not a DATEDIF unit`);
    }
  }),
  DAYS: fn(2, 2, (args, f) => {
    const e = dateArg(args[0]!, f);
    const s = dateArg(args[1]!, f);
    if (typeof e !== 'number') return e;
    if (typeof s !== 'number') return s;
    return Math.floor(e) - Math.floor(s);
  }),
  NETWORKDAYS: fn(2, 3, (args, f) => {
    const a = dateArg(args[0]!, f);
    const b = dateArg(args[1]!, f);
    if (typeof a !== 'number') return a;
    if (typeof b !== 'number') return b;
    const hol = holidaysOf(args, 2, f);
    if (!(hol instanceof Set)) return hol;
    const [s, e, sign] =
      a <= b ? [Math.floor(a), Math.floor(b), 1] : [Math.floor(b), Math.floor(a), -1];
    if (e - s > 400_000) return err('#NUM!');
    let n = 0;
    for (let d = s; d <= e; d++) if (!isWeekend(d) && !hol.has(d)) n++;
    return n * sign;
  }),
  WORKDAY: fn(2, 3, (args, f) => {
    const a = dateArg(args[0]!, f);
    const days = numArg(args[1]!, f);
    if (typeof a !== 'number') return a;
    if (isError(days)) return days;
    const hol = holidaysOf(args, 2, f);
    if (!(hol instanceof Set)) return hol;
    let d = Math.floor(a);
    let left = Math.trunc(days);
    const step = left < 0 ? -1 : 1;
    if (Math.abs(left) > 300_000) return err('#NUM!');
    while (left !== 0) {
      d += step;
      if (!isWeekend(d) && !hol.has(d)) left -= step;
    }
    return checkSerial(d);
  }),
  YEARFRAC: fn(2, 3, (args, f) => {
    const a = dateArg(args[0]!, f);
    const b = dateArg(args[1]!, f);
    if (typeof a !== 'number') return a;
    if (typeof b !== 'number') return b;
    const basis = opt(args, 2, f, numArg, 0);
    if (isError(basis)) return basis;
    return yearFrac(Math.floor(a), Math.floor(b), Math.trunc(basis));
  }),
};
