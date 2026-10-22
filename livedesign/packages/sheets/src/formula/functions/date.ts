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
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (y < 1 || y > 9999) return err('#NUM!');
  return serialFromDate(y, m, endOfMonth ? last : Math.min(p.d, last));
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

function weekNumber(serial: number, startsMonday: boolean): number {
  const p = dateFromSerial(serial);
  const jan1 = serialFromDate(p.y, 1, 1);
  const jan1wd = dateFromSerial(jan1).weekday;
  const offset = startsMonday ? (jan1wd + 6) % 7 : jan1wd;
  return Math.floor((Math.floor(serial) - jan1 + offset) / 7) + 1;
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

function yearFrac(a: number, b: number, basis: number): Value {
  const [s, e] = a <= b ? [a, b] : [b, a];
  const ps = dateFromSerial(s);
  const pe = dateFromSerial(e);
  switch (basis) {
    case 0: {
      let d1 = ps.d;
      let d2 = pe.d;
      if (d1 === 31) d1 = 30;
      if (d2 === 31 && d1 >= 30) d2 = 30;
      return ((pe.y - ps.y) * 360 + (pe.m - ps.m) * 30 + (d2 - d1)) / 360;
    }
    case 1: {
      const days = e - s;
      if (ps.y === pe.y) {
        const leap = new Date(Date.UTC(ps.y, 1, 29)).getUTCMonth() === 1;
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
    const t = (Math.trunc(h!) * 3600 + Math.trunc(m!) * 60 + Math.trunc(s!)) / 86_400;
    if (t < 0) return err('#NUM!');
    return t - Math.floor(t);
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
  YEAR: numFn(1, 1, ([s]) => dateFromSerial(s!).y),
  MONTH: numFn(1, 1, ([s]) => dateFromSerial(s!).m),
  DAY: numFn(1, 1, ([s]) => dateFromSerial(s!).d),
  HOUR: numFn(1, 1, ([s]) => dateFromSerial(s!).h),
  MINUTE: numFn(1, 1, ([s]) => dateFromSerial(s!).min),
  SECOND: numFn(1, 1, ([s]) => dateFromSerial(s!).s),
  WEEKDAY: numFn(1, 2, ([s, type = 1]) => {
    const wd = dateFromSerial(s!).weekday;
    if (type === 1) return wd + 1;
    if (type === 2) return ((wd + 6) % 7) + 1;
    if (type === 3) return (wd + 6) % 7;
    return err('#NUM!');
  }),
  WEEKNUM: numFn(1, 2, ([s, type = 1]) => {
    if (type !== 1 && type !== 2) return err('#NUM!');
    return weekNumber(s!, type === 2);
  }),
  ISOWEEKNUM: numFn(1, 1, ([s]) => isoWeek(s!)),
  EDATE: numFn(2, 2, ([s, m]) => addMonths(s!, m!, false)),
  EOMONTH: numFn(2, 2, ([s, m]) => addMonths(s!, m!, true)),
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
