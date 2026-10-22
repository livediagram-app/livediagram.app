// Which formulas may spill (blueprint sheets-engine.md "Spills"): read statically from the tree, so an empty cell
// knows which formulas above and to its left to work out before it can say it is empty. A formula of an
// aggregate (SUM of a range) never spills; a range on its own, an array function, or a scalar function lifted
// over a range may.
import type { Node } from '../formula/ast';
import type { StoredRef } from '../sheet';

const SCALAR_RESULT = new Set([
  'SUM',
  'SUMIF',
  'SUMIFS',
  'SUMPRODUCT',
  'PRODUCT',
  'AVERAGE',
  'AVERAGEIF',
  'AVERAGEIFS',
  'MEDIAN',
  'MODE',
  'MIN',
  'MAX',
  'MINIFS',
  'MAXIFS',
  'COUNT',
  'COUNTA',
  'COUNTBLANK',
  'COUNTIF',
  'COUNTIFS',
  'LARGE',
  'SMALL',
  'RANK',
  'PERCENTILE',
  'QUARTILE',
  'STDEV',
  'STDEV.P',
  'VAR',
  'VAR.P',
  'CORREL',
  'VLOOKUP',
  'HLOOKUP',
  'MATCH',
  'XMATCH',
  'LOOKUP',
  'CONCAT',
  'CONCATENATE',
  'TEXTJOIN',
  'JOIN',
  'AND',
  'OR',
  'XOR',
  'NPV',
  'IRR',
  'ROWS',
  'COLUMNS',
  'ISFORMULA',
  'TYPE',
  'CARDCOUNT',
  'CARDSUM',
  'CARD',
  'GCD',
  'LCM',
  'NETWORKDAYS',
  'WORKDAY',
  'COUNTIFS',
]);

const ARRAY_RESULT = new Set([
  'FILTER',
  'SORT',
  'SORTBY',
  'UNIQUE',
  'SEQUENCE',
  'TRANSPOSE',
  'ARRAYFORMULA',
  'SPLIT',
  'CARDS',
  'OFFSET',
  'INDIRECT',
]);

function refIsRange(ref: StoredRef | undefined): boolean {
  if (!ref) return false;
  if (ref.spill || ref.open) return true;
  if (ref.st !== undefined) {
    const p = ref.p ?? [-1, -1, -1, -1];
    return p[0] < 0 || p[1] < 0 || p[2] >= 0 || p[3] >= 0;
  }
  return (
    ref.r1 === undefined || ref.c1 === undefined || ref.r2 !== undefined || ref.c2 !== undefined
  );
}

export function maySpill(node: Node, refs: readonly StoredRef[]): boolean {
  switch (node.k) {
    case 'stored':
      return refIsRange(refs[node.i]);
    case 'ref':
      return true;
    case 'arr':
      return node.rows.length > 1 || (node.rows[0]?.length ?? 0) > 1;
    case 'neg':
    case 'pos':
    case 'pct':
      return maySpill(node.a, refs);
    case 'bin':
      return maySpill(node.a, refs) || maySpill(node.b, refs);
    case 'call':
      if (SCALAR_RESULT.has(node.name)) return false;
      if (ARRAY_RESULT.has(node.name)) return true;
      return node.args.some((a) => a !== null && maySpill(a, refs));
    default:
      return false;
  }
}
