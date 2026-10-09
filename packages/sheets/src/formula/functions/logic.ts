// Logic and information functions (docs/specs/029-sheets/formulas.md "Functions": Logic, Information). IF, IFS,
// SWITCH, IFERROR and IFNA are lazy: the branch not taken is never worked out.
import type { EvalValue, Frame } from '../../engine/frame';
import {
  MANY,
  deref,
  flatScalars,
  fn,
  lazyFn,
  lift,
  refArg,
  scalarFn,
  type FnDef,
  type Thunk,
} from '../fn';
import {
  ERROR_CODES,
  compareScalars,
  err,
  isArray,
  isError,
  scalarOf,
  toBool,
  type Scalar,
  type Value,
} from '../values';

function boolsOf(args: EvalValue[], f: Frame): boolean[] | Value {
  const out: boolean[] = [];
  for (const x of flatScalars(args, f)) {
    if (isError(x)) return x;
    if (typeof x === 'boolean') out.push(x);
    else if (typeof x === 'number') out.push(x !== 0);
    else if (typeof x === 'string') {
      const l = x.toLowerCase();
      if (l === 'true' || l === 'false') out.push(l === 'true');
    }
  }
  if (out.length === 0) return err('#VALUE!', 'There are no TRUE or FALSE values');
  return out;
}

function whenArray(cond: Value, then: Thunk, otherwise: Thunk | null, f: Frame): Value {
  const a = deref(then(), f);
  const b = otherwise ? deref(otherwise(), f) : false;
  return lift([cond, a, b], ([c, x, y]) => {
    const t = toBool(c!);
    if (isError(t)) return t;
    return t ? x! : y!;
  });
}

function caught(test: (v: Value) => boolean): FnDef {
  return lazyFn(2, 2, ([value, fallback], f) => {
    const v = deref(value!(), f);
    if (isArray(v)) return lift([v, deref(fallback!(), f)], ([x, y]) => (test(x!) ? y! : x!));
    return test(v) ? fallback!() : v;
  });
}

export const LOGIC_FUNCTIONS: Record<string, FnDef> = {
  IF: lazyFn(2, 3, ([cond, then, otherwise], f) => {
    const c = deref(cond!(), f);
    if (isArray(c)) return whenArray(c, then!, otherwise ?? null, f);
    const t = toBool(c);
    if (isError(t)) return t;
    if (t) return then!();
    return otherwise ? otherwise() : false;
  }),
  IFS: lazyFn(2, MANY, (args, f) => {
    if (args.length % 2 !== 0) return err('#N/A', 'IFS takes pairs of condition and value');
    for (let i = 0; i < args.length; i += 2) {
      const t = toBool(deref(args[i]!(), f));
      if (isError(t)) return t;
      if (t) return args[i + 1]!();
    }
    return err('#N/A', 'No condition was TRUE');
  }),
  SWITCH: lazyFn(3, MANY, (args, f) => {
    const subject = scalarOf(deref(args[0]!(), f));
    if (isError(subject)) return subject;
    let i = 1;
    for (; i + 1 < args.length; i += 2) {
      const c = scalarOf(deref(args[i]!(), f));
      if (isError(c)) return c;
      if (typeof c === typeof subject && compareScalars(c, subject) === 0) return args[i + 1]!();
    }
    return i < args.length ? args[i]!() : err('#N/A', 'No case matched');
  }),
  AND: fn(1, MANY, (args, f) => {
    const bs = boolsOf(args, f);
    return Array.isArray(bs) ? bs.every(Boolean) : bs;
  }),
  OR: fn(1, MANY, (args, f) => {
    const bs = boolsOf(args, f);
    return Array.isArray(bs) ? bs.some(Boolean) : bs;
  }),
  XOR: fn(1, MANY, (args, f) => {
    const bs = boolsOf(args, f);
    return Array.isArray(bs) ? bs.filter(Boolean).length % 2 === 1 : bs;
  }),
  NOT: scalarFn(1, 1, ([x]) => {
    const t = toBool(x!);
    return isError(t) ? t : !t;
  }),
  TRUE: fn(0, 0, () => true),
  FALSE: fn(0, 0, () => false),
  IFERROR: caught((v) => isError(v)),
  IFNA: caught((v) => isError(v) && v.e === '#N/A'),
};

function is(test: (x: Scalar) => boolean): FnDef {
  return scalarFn(1, 1, ([x]) => test(x!));
}

export const INFO_FUNCTIONS: Record<string, FnDef> = {
  ISBLANK: is((x) => x === null),
  ISNUMBER: is((x) => typeof x === 'number'),
  ISTEXT: is((x) => typeof x === 'string'),
  ISLOGICAL: is((x) => typeof x === 'boolean'),
  ISERROR: is((x) => isError(x)),
  ISNA: is((x) => isError(x) && x.e === '#N/A'),
  ISFORMULA: fn(1, 1, (args, f) => {
    const r = refArg(args[0]);
    if (!r) return err('#N/A', 'ISFORMULA needs a cell reference');
    return f.isFormula(r.sheetId, r.r1, r.c1);
  }),
  'ERROR.TYPE': scalarFn(1, 1, ([x]) =>
    isError(x!) ? ERROR_CODES.indexOf(x.e) + 1 : err('#N/A', 'The value is not an error'),
  ),
  NA: fn(0, 0, () => err('#N/A')),
  N: scalarFn(1, 1, ([x]) => {
    if (typeof x === 'number') return x;
    if (typeof x === 'boolean') return x ? 1 : 0;
    if (isError(x!)) return x;
    return 0;
  }),
  TYPE: fn(1, 1, (args, f) => {
    const v = deref(args[0]!, f);
    if (isArray(v)) return 64;
    if (typeof v === 'number' || v === null) return 1;
    if (typeof v === 'string') return 2;
    if (typeof v === 'boolean') return 4;
    return 16;
  }),
};
