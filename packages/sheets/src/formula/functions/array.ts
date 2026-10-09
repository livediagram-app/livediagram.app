// Array functions (docs/specs/029-sheets/formulas.md "Functions": Arrays, "Arrays and spills"). Each returns an
// array that spills; results are bounded by ARRAY_CELLS_MAX.
import { sortKeyCompare } from '../../sort';
import { MANY, arrayArg, boolArg, deref, fn, intArg, numArg, opt, tooBig, type FnDef } from '../fn';
import { dims, err, isError, scalarOf, toBool, type Scalar, type Value } from '../values';

const NOTHING = err('#N/A', 'No rows matched');

function cellKey(row: Value[]): string {
  return JSON.stringify(
    row.map((x) => {
      const s = scalarOf(x);
      return typeof s === 'string' ? `s:${s.toLowerCase()}` : s;
    }),
  );
}

export const ARRAY_FUNCTIONS: Record<string, FnDef> = {
  FILTER: fn(2, MANY, (args, f) => {
    const range = arrayArg(args[0]!, f);
    const d = dims(range);
    const conds = args.slice(1).map((a) => arrayArg(a!, f));
    // Conditions run along the rows (a column of TRUE/FALSE) or along the columns (a row of them).
    const byRows = conds.every((c) => dims(c).rows === d.rows && dims(c).cols === 1);
    const byCols = !byRows && conds.every((c) => dims(c).cols === d.cols && dims(c).rows === 1);
    if (!byRows && !byCols)
      return err('#VALUE!', 'FILTER conditions must match the range in length');
    const n = byRows ? d.rows : d.cols;
    const keep: boolean[] = [];
    for (let i = 0; i < n; i++) {
      let ok = true;
      for (const c of conds) {
        const v = scalarOf(byRows ? c.rows[i]![0]! : c.rows[0]![i]!);
        if (isError(v)) return v;
        const b = toBool(v);
        if (isError(b)) return b;
        if (!b) ok = false;
      }
      keep.push(ok);
    }
    if (byRows) {
      const rows = range.rows.filter((_, i) => keep[i]);
      return rows.length ? { rows } : NOTHING;
    }
    const rows = range.rows.map((r) => r.filter((_, j) => keep[j]));
    return rows[0]?.length ? { rows } : NOTHING;
  }),
  SORT: fn(1, MANY, (args, f) => {
    const range = arrayArg(args[0]!, f);
    const keys: { col: number; asc: boolean }[] = [];
    for (let i = 1; i < args.length; i += 2) {
      const col = intArg(args[i]!, f);
      if (isError(col)) return col;
      const asc = opt(args, i + 1, f, boolArg, true);
      if (isError(asc)) return asc;
      if (col < 1 || col > dims(range).cols) return err('#VALUE!', `There is no column ${col}`);
      keys.push({ col: col - 1, asc });
    }
    if (keys.length === 0) keys.push({ col: 0, asc: true });
    const rows = [...range.rows].sort((a, b) => {
      for (const k of keys) {
        const c = sortKeyCompare(scalarOf(a[k.col]!), scalarOf(b[k.col]!), k.asc);
        if (c !== 0) return c;
      }
      return 0;
    });
    return { rows };
  }),
  SORTBY: fn(2, MANY, (args, f) => {
    const range = arrayArg(args[0]!, f);
    const d = dims(range);
    const keys: { by: Scalar[]; asc: boolean }[] = [];
    for (let i = 1; i < args.length; i += 2) {
      const by = arrayArg(args[i]!, f);
      if (dims(by).rows !== d.rows) return err('#VALUE!', 'SORTBY ranges must match the rows');
      const order = opt(args, i + 1, f, intArg, 1);
      if (isError(order)) return order;
      keys.push({ by: by.rows.map((r) => scalarOf(r[0]!)), asc: order !== -1 });
    }
    const index = range.rows.map((_, i) => i);
    index.sort((a, b) => {
      for (const k of keys) {
        const c = sortKeyCompare(k.by[a]!, k.by[b]!, k.asc);
        if (c !== 0) return c;
      }
      return a - b;
    });
    return { rows: index.map((i) => range.rows[i]!) };
  }),
  UNIQUE: fn(1, 3, (args, f) => {
    const range = arrayArg(args[0]!, f);
    const byCol = opt(args, 1, f, boolArg, false);
    const once = opt(args, 2, f, boolArg, false);
    if (isError(byCol)) return byCol;
    if (isError(once)) return once;
    const lines = byCol ? range.rows[0]!.map((_, j) => range.rows.map((r) => r[j]!)) : range.rows;
    const counts = new Map<string, number>();
    for (const l of lines) counts.set(cellKey(l), (counts.get(cellKey(l)) ?? 0) + 1);
    const seen = new Set<string>();
    const out: Value[][] = [];
    for (const l of lines) {
      const k = cellKey(l);
      if (seen.has(k)) continue;
      seen.add(k);
      if (once && counts.get(k)! > 1) continue;
      out.push(l);
    }
    if (out.length === 0) return NOTHING;
    return byCol ? { rows: out[0]!.map((_, i) => out.map((l) => l[i]!)) } : { rows: out };
  }),
  SEQUENCE: fn(1, 4, (args, f) => {
    const rows = intArg(args[0]!, f);
    const cols = opt(args, 1, f, intArg, 1);
    const start = opt(args, 2, f, numArg, 1);
    const step = opt(args, 3, f, numArg, 1);
    for (const x of [rows, cols, start, step]) if (isError(x)) return x;
    const [r, c, s, st] = [rows, cols, start, step] as number[];
    if (r! < 1 || c! < 1) return err('#VALUE!', 'SEQUENCE needs at least one row and column');
    if (tooBig(r!, c!)) return err('#NUM!', 'The result is too large');
    const out: Value[][] = [];
    for (let i = 0; i < r!; i++) {
      const row: Value[] = [];
      for (let j = 0; j < c!; j++) row.push(s! + (i * c! + j) * st!);
      out.push(row);
    }
    return { rows: out };
  }),
  TRANSPOSE: fn(1, 1, (args, f) => {
    const range = arrayArg(args[0]!, f);
    const d = dims(range);
    const out: Value[][] = [];
    for (let j = 0; j < d.cols; j++) out.push(range.rows.map((r) => r[j]!));
    return { rows: out };
  }),
  ARRAYFORMULA: fn(1, 1, (args, f) => deref(args[0]!, f)),
};
