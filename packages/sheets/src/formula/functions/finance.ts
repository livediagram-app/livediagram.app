// Finance functions (docs/specs/029-sheets/formulas.md "Functions": Finance), with Sheets' sign conventions:
// money paid out is negative.
import { MANY, arrayArg, flatValues, fn, numArg, numFn, numbersOf, opt, type FnDef } from '../fn';
import { err, isError, type Value } from '../values';

function pmt(rate: number, nper: number, pv: number, fv: number, type: number): number {
  if (rate === 0) return -(pv + fv) / nper;
  const pow = (1 + rate) ** nper;
  return (-rate * (pv * pow + fv)) / ((1 + rate * type) * (pow - 1));
}

function fv(rate: number, nper: number, payment: number, pv: number, type: number): number {
  if (rate === 0) return -(pv + payment * nper);
  const pow = (1 + rate) ** nper;
  return -(pv * pow + (payment * (1 + rate * type) * (pow - 1)) / rate);
}

// Newton's method from `guess`, up to 100 steps; null when it does not settle.
function solve(f: (x: number) => number, guess: number): number | null {
  let x = guess;
  for (let i = 0; i < 100; i++) {
    const y = f(x);
    if (Math.abs(y) < 1e-10) return x;
    const h = 1e-7 * Math.max(1, Math.abs(x));
    const d = (f(x + h) - y) / h;
    if (d === 0 || !Number.isFinite(d)) return null;
    const next = x - y / d;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - x) < 1e-12) return next;
    x = next;
  }
  return null;
}

function npv(rate: number, values: number[]): number {
  let s = 0;
  values.forEach((v, i) => {
    s += v / (1 + rate) ** (i + 1);
  });
  return s;
}

export const FINANCE_FUNCTIONS: Record<string, FnDef> = {
  PMT: numFn(3, 5, ([rate, nper, pv, f = 0, type = 0]) =>
    nper === 0 ? err('#NUM!') : pmt(rate!, nper!, pv!, f, type ? 1 : 0),
  ),
  FV: numFn(3, 5, ([rate, nper, payment, pv = 0, type = 0]) =>
    fv(rate!, nper!, payment!, pv, type ? 1 : 0),
  ),
  PV: numFn(3, 5, ([rate, nper, payment, f = 0, type = 0]) => {
    const t = type ? 1 : 0;
    if (rate === 0) return -(f + payment! * nper!);
    const pow = (1 + rate!) ** nper!;
    return -(f + (payment! * (1 + rate! * t) * (pow - 1)) / rate!) / pow;
  }),
  NPER: numFn(3, 5, ([rate, payment, pv, f = 0, type = 0]) => {
    const t = type ? 1 : 0;
    if (rate === 0) return payment === 0 ? err('#NUM!') : -(pv! + f) / payment!;
    const a = payment! * (1 + rate! * t) - f * rate!;
    const b = pv! * rate! + payment! * (1 + rate! * t);
    if (a / b <= 0) return err('#NUM!');
    return Math.log(a / b) / Math.log(1 + rate!);
  }),
  RATE: numFn(3, 6, ([nper, payment, pv, f = 0, type = 0, guess = 0.1]) => {
    const t = type ? 1 : 0;
    const r = solve(
      (x) => (x === 0 ? pv! + payment! * nper! + f : f - fv(x, nper!, payment!, pv!, t)),
      guess,
    );
    return r === null ? err('#NUM!', 'RATE did not settle; try another guess') : r;
  }),
  NPV: fn(2, MANY, (args, f) => {
    const rate = numArg(args[0]!, f);
    if (isError(rate)) return rate;
    const values = numbersOf(args.slice(1), f);
    if (isError(values)) return values;
    return npv(rate, values);
  }),
  IRR: fn(1, 2, (args, f) => {
    const values: number[] = [];
    for (const x of flatValues(arrayArg(args[0]!, f))) {
      if (isError(x)) return x as Value;
      if (typeof x === 'number') values.push(x);
    }
    if (!values.some((v) => v > 0) || !values.some((v) => v < 0))
      return err('#NUM!', 'IRR needs both a payment and a receipt');
    const guess = opt(args, 1, f, numArg, 0.1);
    if (isError(guess)) return guess;
    const r = solve((x) => values.reduce((s, v, i) => s + v / (1 + x) ** i, 0), guess);
    return r === null ? err('#NUM!', 'IRR did not settle; try another guess') : r;
  }),
};
