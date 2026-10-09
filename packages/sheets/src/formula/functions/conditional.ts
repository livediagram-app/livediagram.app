// The criteria-range functions' shared part (SUMIF(S), COUNTIF(S), AVERAGEIF(S), MINIFS, MAXIFS): which cells of
// equal-sized ranges pass every criterion.
import { isRef, type EvalValue, type Frame } from '../../engine/frame';
import { arrayArg, flatValues, scalarArg } from '../fn';
import { makeCriterion } from '../criteria';
import { dims, err, isError, type SheetError, type ValueArray } from '../values';

// A range the same size as `like`, from the top-left of `v` (SUMIF's sum range, as Sheets reads a short one).
export function sameSizeAs(v: EvalValue, like: ValueArray, f: Frame): ValueArray {
  const d = dims(like);
  if (isRef(v)) {
    const r = v.ref;
    return arrayArg(
      {
        ref: {
          sheetId: r.sheetId,
          r1: r.r1,
          c1: r.c1,
          r2: r.r1 + d.rows - 1,
          c2: r.c1 + d.cols - 1,
        },
      },
      f,
    );
  }
  return arrayArg(v, f);
}

// Pairs of (range, criterion) to a mask over the first range's cells, row-major. Ranges of another size are
// #VALUE!.
export function criteriaMask(
  pairs: [EvalValue, EvalValue][],
  f: Frame,
): { mask: boolean[]; shape: ValueArray } | SheetError {
  let shape: ValueArray | null = null;
  let mask: boolean[] | null = null;
  for (const [rangeArg, critArg] of pairs) {
    const range = arrayArg(rangeArg, f);
    const critValue = scalarArg(critArg, f);
    if (isError(critValue)) return critValue;
    const crit = makeCriterion(critValue);
    if (shape) {
      const a = dims(shape);
      const b = dims(range);
      if (a.rows !== b.rows || a.cols !== b.cols)
        return err('#VALUE!', 'The ranges must be the same size');
    } else {
      shape = range;
    }
    const cells = flatValues(range);
    if (!mask) mask = cells.map(() => true);
    cells.forEach((c, i) => {
      if (mask![i] && !crit(c)) mask![i] = false;
    });
  }
  return { mask: mask ?? [], shape: shape ?? { rows: [] } };
}

// The numbers among `values` where the mask is set (non-numbers skipped, as SUMIF does).
export function maskedNumbers(values: ValueArray, mask: boolean[]): number[] | SheetError {
  const out: number[] = [];
  const cells = flatValues(values);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const c = cells[i];
    if (c !== undefined && isError(c)) return c;
    if (typeof c === 'number') out.push(c);
  }
  return out;
}

// args as (range, criterion) pairs from `start`; odd counts are #N/A.
export function pairsFrom(args: EvalValue[], start: number): [EvalValue, EvalValue][] | null {
  const rest = args.slice(start);
  if (rest.length === 0 || rest.length % 2 !== 0) return null;
  const out: [EvalValue, EvalValue][] = [];
  for (let i = 0; i < rest.length; i += 2) out.push([rest[i]!, rest[i + 1]!]);
  return out;
}
