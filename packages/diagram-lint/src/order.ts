// The order findings are reported in (blueprint step 4, LN18): severity, then code order, then the
// primary subject's reading position (rounded top, then left; none first), then the refs. Each product
// binds it to its own codes, in its spec's table order, and their severities.

import type { LintFindingOf, LintSeverity, RawFindingOf } from './findings';

export type LintCodeTable<C extends string> = {
  // The codes in the spec's table order.
  codes: readonly C[];
  // The severities, most severe first.
  severities: readonly LintSeverity[];
  // Fixed per code by the spec.
  severity: Readonly<Record<C, LintSeverity>>;
};

// By UTF-16 code units, as the refs sort: no locale.
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const rank = <T>(list: readonly T[], value: T) => list.indexOf(value);

export function createSortFindings<C extends string>({
  codes,
  severities,
  severity,
}: LintCodeTable<C>): (raw: readonly RawFindingOf<C>[]) => LintFindingOf<C>[] {
  const position = (f: RawFindingOf<C>) =>
    f.at ? [Math.round(f.at.y), Math.round(f.at.x)] : [-Infinity, -Infinity];
  return (raw) =>
    [...raw]
      .sort((a, b) => {
        const [pa, pb] = [position(a), position(b)];
        return (
          rank(severities, severity[a.code]) - rank(severities, severity[b.code]) ||
          rank(codes, a.code) - rank(codes, b.code) ||
          pa[0]! - pb[0]! ||
          pa[1]! - pb[1]! ||
          compareText(a.refs.join(' '), b.refs.join(' '))
        );
      })
      .map(({ code, refs, message, fix }) => ({
        code,
        severity: severity[code],
        refs,
        message,
        fix,
      }));
}
