// The order findings are reported in (blueprint step 4, LN18): severity, then code order, then the
// primary subject's reading position (rounded top, then left; none first), then the refs.

import {
  LINT_CODES,
  LINT_SEVERITIES,
  LINT_SEVERITY,
  type LintFinding,
} from '@livediagram/api-schema';
import type { RawFinding } from './checks/types';

// By UTF-16 code units, as the refs sort: no locale.
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const rank = <T>(list: readonly T[], value: T) => list.indexOf(value);

export function sortFindings(raw: readonly RawFinding[]): LintFinding[] {
  const position = (f: RawFinding) =>
    f.at ? [Math.round(f.at.y), Math.round(f.at.x)] : [-Infinity, -Infinity];
  return [...raw]
    .sort((a, b) => {
      const [pa, pb] = [position(a), position(b)];
      return (
        rank(LINT_SEVERITIES, LINT_SEVERITY[a.code]) -
          rank(LINT_SEVERITIES, LINT_SEVERITY[b.code]) ||
        rank(LINT_CODES, a.code) - rank(LINT_CODES, b.code) ||
        pa[0]! - pb[0]! ||
        pa[1]! - pb[1]! ||
        compareText(a.refs.join(' '), b.refs.join(' '))
      );
    })
    .map(({ code, refs, message, fix }) => ({
      code,
      severity: LINT_SEVERITY[code],
      refs,
      message,
      fix,
    }));
}
