// Lookup and reference functions (docs/specs/029-sheets/formulas.md "Functions": Lookup). INDEX and OFFSET return
// references, so `SUM(INDEX(A:C, 0, 2))` and `SUM(OFFSET(A1, 0, 0, 3))` read ranges; INDIRECT reads A1 text.
import type { Frame, RangeRef } from '../../engine/frame';
import { isRef } from '../../engine/frame';
import { a1ToPos, posToRange } from '../../engine/refs';
import {
  MANY,
  arrayArg,
  boolArg,
  deref,
  fn,
  intArg,
  lazyFn,
  opt,
  refArg,
  scalarArg,
  type FnDef,
} from '../fn';
import { parseFormula } from '../parse';
import { makeCriterion } from '../criteria';
import {
  compareScalars,
  dims,
  err,
  isError,
  scalarOf,
  type Scalar,
  type Value,
  type ValueArray,
} from '../values';

function sameKind(a: Scalar, b: Scalar): boolean {
  return typeof a === typeof b && a !== null && b !== null;
}

function hasWildcard(v: Scalar): v is string {
  return typeof v === 'string' && /(^|[^~])[*?]/.test(v);
}

// The index of an exact match in `list` (text ignoring case, wildcards when the key has them), or -1.
function exactIndex(list: Scalar[], key: Scalar, reverse = false, wildcards = true): number {
  const crit = wildcards && hasWildcard(key) ? makeCriterion(key) : null;
  const n = list.length;
  for (let k = 0; k < n; k++) {
    const i = reverse ? n - 1 - k : k;
    const v = list[i]!;
    if (crit ? crit(v) : sameKind(v, key) && compareScalars(v, key) === 0) return i;
  }
  return -1;
}

// The last index whose value is <= key in a list sorted ascending (approximate match), or -1.
function sortedIndex(list: Scalar[], key: Scalar, descending = false): number {
  let lo = 0;
  let hi = list.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = list[mid]!;
    if (v === null || isError(v) || !sameKind(v, key)) {
      // Skip values of another kind by narrowing linearly (rare in sorted data).
      let j = mid - 1;
      while (j >= lo && !sameKind(list[j]!, key)) j--;
      if (j < lo) {
        lo = mid + 1;
        continue;
      }
      hi = j;
      continue;
    }
    const c = compareScalars(v, key);
    if (descending ? c >= 0 : c <= 0) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

function column(a: ValueArray, j: number): Scalar[] {
  return a.rows.map((row) => scalarOf(row[j] ?? null));
}

function row(a: ValueArray, i: number): Scalar[] {
  return (a.rows[i] ?? []).map((x) => scalarOf(x));
}

function vhLookup(vertical: boolean): FnDef {
  return fn(3, 4, (args, f) => {
    const key = scalarArg(args[0]!, f);
    if (isError(key)) return key;
    const table = arrayArg(args[1]!, f);
    const idx = intArg(args[2]!, f);
    if (isError(idx)) return idx;
    const sortedMode = opt(args, 3, f, boolArg, true);
    if (isError(sortedMode)) return sortedMode;
    const d = dims(table);
    const span = vertical ? d.cols : d.rows;
    if (idx < 1 || idx > span) return err('#REF!', `Index ${idx} is outside the range`);
    const keys = vertical ? column(table, 0) : row(table, 0);
    const i = sortedMode ? sortedIndex(keys, key) : exactIndex(keys, key);
    if (i < 0) return err('#N/A', 'No match was found');
    const out = vertical ? table.rows[i]![idx - 1] : table.rows[idx - 1]![i];
    return scalarOf(out ?? null);
  });
}

function matchIn(list: Scalar[], key: Scalar, mode: number, search: number): number {
  const reverse = search < 0;
  if (mode === 2) return exactIndex(list, key, reverse, true);
  const exact = exactIndex(list, key, reverse, false);
  if (exact >= 0 || mode === 0) return exact;
  // Exact or next smaller (-1) / next larger (1), over unsorted data.
  let best = -1;
  for (let i = 0; i < list.length; i++) {
    const v = list[i]!;
    if (!sameKind(v, key)) continue;
    const c = compareScalars(v, key);
    if (mode === -1 && c < 0 && (best < 0 || compareScalars(v, list[best]!) > 0)) best = i;
    if (mode === 1 && c > 0 && (best < 0 || compareScalars(v, list[best]!) < 0)) best = i;
  }
  return best;
}

function lineOf(v: ValueArray): { list: Scalar[]; vertical: boolean } | null {
  const d = dims(v);
  if (d.cols === 1) return { list: column(v, 0), vertical: true };
  if (d.rows === 1) return { list: row(v, 0), vertical: false };
  return null;
}

function refFromText(text: string, f: Frame): RangeRef | null {
  const parsed = parseFormula(`=${text}`);
  if (!parsed.ok || parsed.ast.k !== 'ref') return null;
  const pos = a1ToPos(parsed.ast.ref, f);
  return pos ? posToRange(pos, f) : null;
}

function ownRef(f: Frame): RangeRef {
  return { sheetId: f.sheetId, r1: f.row, c1: f.col, r2: f.row, c2: f.col };
}

export const LOOKUP_FUNCTIONS: Record<string, FnDef> = {
  VLOOKUP: vhLookup(true),
  HLOOKUP: vhLookup(false),
  LOOKUP: fn(2, 3, (args, f) => {
    const key = scalarArg(args[0]!, f);
    if (isError(key)) return key;
    const keys = arrayArg(args[1]!, f);
    const line = lineOf(keys) ?? { list: column(keys, 0), vertical: true };
    const i = sortedIndex(line.list, key);
    if (i < 0) return err('#N/A', 'No match was found');
    if (args[2] === undefined || args[2] === null) {
      const d = dims(keys);
      return scalarOf(
        (line.vertical ? keys.rows[i]![d.cols - 1] : keys.rows[d.rows - 1]![i]) ?? null,
      );
    }
    const result = lineOf(arrayArg(args[2], f));
    return result ? (result.list[i] ?? err('#N/A')) : err('#N/A');
  }),
  MATCH: fn(2, 3, (args, f) => {
    const key = scalarArg(args[0]!, f);
    if (isError(key)) return key;
    const line = lineOf(arrayArg(args[1]!, f));
    if (!line) return err('#N/A', 'MATCH needs one row or one column');
    const type = opt(args, 2, f, intArg, 1);
    if (isError(type)) return type;
    const i = type === 0 ? exactIndex(line.list, key) : sortedIndex(line.list, key, type < 0);
    return i < 0 ? err('#N/A', 'No match was found') : i + 1;
  }),
  XMATCH: fn(2, 4, (args, f) => {
    const key = scalarArg(args[0]!, f);
    if (isError(key)) return key;
    const line = lineOf(arrayArg(args[1]!, f));
    if (!line) return err('#N/A', 'XMATCH needs one row or one column');
    const mode = opt(args, 2, f, intArg, 0);
    const search = opt(args, 3, f, intArg, 1);
    if (isError(mode)) return mode;
    if (isError(search)) return search;
    const i = matchIn(line.list, key, mode, search);
    return i < 0 ? err('#N/A', 'No match was found') : i + 1;
  }),
  XLOOKUP: fn(3, 6, (args, f) => {
    const key = scalarArg(args[0]!, f);
    if (isError(key)) return key;
    const keys = arrayArg(args[1]!, f);
    const line = lineOf(keys);
    if (!line) return err('#VALUE!', 'The lookup range must be one row or one column');
    const results = arrayArg(args[2]!, f);
    const mode = opt(args, 4, f, intArg, 0);
    const search = opt(args, 5, f, intArg, 1);
    if (isError(mode)) return mode;
    if (isError(search)) return search;
    const i = matchIn(line.list, key, mode, search);
    if (i < 0) {
      const missing = args[3];
      return missing !== undefined && missing !== null
        ? deref(missing, f)
        : err('#N/A', 'No match was found');
    }
    const d = dims(results);
    if (line.vertical) {
      if (d.rows !== line.list.length) return err('#VALUE!', 'The ranges must be the same length');
      return d.cols === 1 ? scalarOf(results.rows[i]![0]!) : { rows: [results.rows[i]!] };
    }
    if (d.cols !== line.list.length) return err('#VALUE!', 'The ranges must be the same length');
    return d.rows === 1
      ? scalarOf(results.rows[0]![i]!)
      : { rows: results.rows.map((r) => [r[i]!]) };
  }),
  INDEX: fn(1, 3, (args, f) => {
    const r = intArg(args[1] ?? 0, f);
    const c = opt(args, 2, f, intArg, 0);
    if (isError(r)) return r;
    if (isError(c)) return c;
    const target = args[0]!;
    if (isRef(target)) {
      const ref = target.ref;
      const rows = ref.r2 - ref.r1 + 1;
      const cols = ref.c2 - ref.c1 + 1;
      // A one-row range takes its single index as a column.
      const [ri, ci] = rows === 1 && args.length === 2 ? [1, r] : [r, c];
      if (ri < 0 || ci < 0 || ri > rows || ci > cols)
        return err('#REF!', 'The index is outside the range');
      return {
        ref: {
          sheetId: ref.sheetId,
          r1: ri === 0 ? ref.r1 : ref.r1 + ri - 1,
          r2: ri === 0 ? ref.r2 : ref.r1 + ri - 1,
          c1: ci === 0 ? ref.c1 : ref.c1 + ci - 1,
          c2: ci === 0 ? ref.c2 : ref.c1 + ci - 1,
        },
      };
    }
    const a = arrayArg(target, f);
    const d = dims(a);
    const [ri, ci] = d.rows === 1 && args.length === 2 ? [1, r] : [r, c];
    if (ri < 0 || ci < 0 || ri > d.rows || ci > d.cols)
      return err('#REF!', 'The index is outside the range');
    if (ri === 0 && ci === 0) return a;
    if (ri === 0) return { rows: a.rows.map((x) => [x[ci - 1]!]) };
    if (ci === 0) return { rows: [a.rows[ri - 1]!] };
    return a.rows[ri - 1]![ci - 1]!;
  }),
  CHOOSE: lazyFn(2, MANY, (args, f) => {
    const i = intArg(args[0]!(), f);
    if (isError(i)) return i;
    if (i < 1 || i >= args.length) return err('#VALUE!', `CHOOSE has no value ${i}`);
    return args[i]!();
  }),
  ROW: fn(0, 1, (args, f) => {
    const r = args.length ? refArg(args[0]) : ownRef(f);
    if (!r) return err('#VALUE!', 'ROW needs a reference');
    if (r.r1 === r.r2) return r.r1 + 1;
    const out: Value[][] = [];
    for (let i = r.r1; i <= r.r2; i++) out.push([i + 1]);
    return { rows: out };
  }),
  COLUMN: fn(0, 1, (args, f) => {
    const r = args.length ? refArg(args[0]) : ownRef(f);
    if (!r) return err('#VALUE!', 'COLUMN needs a reference');
    if (r.c1 === r.c2) return r.c1 + 1;
    const out: Value[] = [];
    for (let j = r.c1; j <= r.c2; j++) out.push(j + 1);
    return { rows: [out] };
  }),
  ROWS: fn(1, 1, (args, f) => {
    const r = refArg(args[0]);
    return r ? r.r2 - r.r1 + 1 : dims(arrayArg(args[0]!, f)).rows;
  }),
  COLUMNS: fn(1, 1, (args, f) => {
    const r = refArg(args[0]);
    return r ? r.c2 - r.c1 + 1 : dims(arrayArg(args[0]!, f)).cols;
  }),
  OFFSET: {
    min: 3,
    max: 5,
    volatile: true,
    impl: (args, f) => {
      const base = refArg(args[0]);
      if (!base) return err('#VALUE!', 'OFFSET needs a reference');
      const dr = intArg(args[1]!, f);
      const dc = intArg(args[2]!, f);
      const h = opt(args, 3, f, intArg, base.r2 - base.r1 + 1);
      const w = opt(args, 4, f, intArg, base.c2 - base.c1 + 1);
      for (const x of [dr, dc, h, w]) if (isError(x)) return x;
      const [a, b, hh, ww] = [dr, dc, h, w] as number[];
      if (hh! < 1 || ww! < 1) return err('#REF!');
      const r1 = base.r1 + a!;
      const c1 = base.c1 + b!;
      const grid = f.grid(base.sheetId);
      if (!grid || r1 < 0 || c1 < 0 || r1 + hh! > grid.rows || c1 + ww! > grid.cols)
        return err('#REF!', 'The reference is off the sheet');
      return { ref: { sheetId: base.sheetId, r1, c1, r2: r1 + hh! - 1, c2: c1 + ww! - 1 } };
    },
  },
  INDIRECT: {
    min: 1,
    max: 2,
    volatile: true,
    impl: (args, f) => {
      const text = scalarArg(args[0]!, f);
      if (isError(text)) return text;
      const a1 = opt(args, 1, f, boolArg, true);
      if (isError(a1)) return a1;
      if (!a1) return err('#REF!', 'Only A1 references are read');
      const range = typeof text === 'string' ? refFromText(text.trim(), f) : null;
      return range ? { ref: range } : err('#REF!', `"${String(text)}" is not a reference`);
    },
  },
};
