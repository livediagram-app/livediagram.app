// `graph lint --compare` (blueprint "Compare", LN26, LN27): a graph source laid out in each variant of the
// named dimensions, measured, and the best marked.

import type { LintMeasures, LintReport, LintSeverity } from '@livediagram/api-schema';
import type { ArrowStyle, GraphInput } from '@livediagram/document';
import { lintGraph } from './lint';
import { lintVerdict } from './format';
import type { LintLogger } from './log';

export const COMPARE_DIMENSIONS = ['direction', 'groups', 'lines'] as const;
export type CompareDimension = (typeof COMPARE_DIMENSIONS)[number];

export type CompareVariant = { direction: 'down' | 'right'; groups: boolean; lines: ArrowStyle };

export type CompareRow = {
  label: string;
  variant: CompareVariant;
  measures: LintMeasures;
  counts: Record<LintSeverity, number>;
  ratio: number | null;
  best: boolean;
};

export function parseCompareDimensions(text: string): CompareDimension[] | { error: string } {
  const names = text.split(',').map((s) => s.trim());
  const dims: CompareDimension[] = [];
  for (const name of names) {
    const dim = COMPARE_DIMENSIONS.find((d) => d === name);
    if (!dim || dims.includes(dim))
      return { error: `unknown dimension "${name}"; use direction, groups, lines` };
    dims.push(dim);
  }
  return dims;
}

const hasGroups = (input: GraphInput) =>
  (input.groups?.length ?? 0) > 0 || input.nodes.some((n) => n.group !== undefined);

// Every variant, the dimensions nested in the order named, each in its fixed value order.
function variantsOf(input: GraphInput, dims: readonly CompareDimension[]): CompareVariant[] {
  const values: { [K in CompareDimension]: readonly CompareVariant[keyof CompareVariant][] } = {
    direction: ['down', 'right'],
    groups: hasGroups(input) ? [true, false] : [false],
    lines: ['straight', 'angled', 'curved'],
  };
  const base: CompareVariant = {
    direction: input.direction ?? 'down',
    groups: hasGroups(input),
    lines: input.lines ?? 'straight',
  };
  let variants: CompareVariant[] = [base];
  for (const dim of dims)
    variants = variants.flatMap((v) => values[dim].map((value) => ({ ...v, [dim]: value })));
  return variants;
}

function applied(input: GraphInput, v: CompareVariant): GraphInput {
  const { groups: _groups, ...rest } = input;
  const nodes = v.groups ? input.nodes : input.nodes.map(({ group: _g, ...node }) => node);
  return { ...(v.groups ? input : rest), nodes, direction: v.direction, lines: v.lines };
}

const labelOf = (v: CompareVariant, dims: readonly CompareDimension[]) =>
  dims
    .map((d) =>
      d === 'direction'
        ? v.direction
        : d === 'groups'
          ? v.groups
            ? 'groups'
            : 'no-groups'
          : v.lines,
    )
    .join(' ');

// Lower is better: errors, crossings plus behind, warnings, aspect away from 1, area, enumeration order.
// Every variant of one source has the same arrows, so crossings are skipped in all rows or in none: a
// skipped count reads 0 everywhere.
function score(report: LintReport): number[] {
  const { measures, counts } = report;
  const extent = measures.extent;
  const crossings = measures.crossings ?? 0;
  return [
    counts.error,
    crossings + measures.behind,
    counts.warning,
    extent ? Math.abs(Math.log(extent.width / extent.height)) : 0,
    extent ? extent.width * extent.height : 0,
  ];
}

export function compareGraphLayouts(
  input: GraphInput,
  dims: readonly CompareDimension[],
  options: { log?: LintLogger } = {},
): CompareRow[] {
  const started = performance.now();
  const variants = variantsOf(input, dims);
  const reports = variants.map((v) => lintGraph(applied(input, v), options).report);
  const scores = reports.map(score);
  let best = 0;
  scores.forEach((s, i) => {
    const b = scores[best]!;
    const k = s.findIndex((value, j) => value !== b[j]);
    if (k >= 0 && s[k]! < b[k]!) best = i;
  });
  options.log?.('[lint] compare', {
    variants: variants.length,
    bestIndex: best,
    ms: Math.round(performance.now() - started),
  });
  return variants.map((variant, i) => {
    const report = reports[i]!;
    const extent = report.measures.extent;
    return {
      label: labelOf(variant, dims),
      variant,
      measures: report.measures,
      counts: report.counts,
      ratio: extent ? extent.width / extent.height : null,
      best: i === best,
    };
  });
}

export function formatCompareTable(rows: readonly CompareRow[]): string {
  const header = ['variant', 'crossings', 'behind', 'overlaps', 'extent', 'ratio', 'verdict'];
  const cells = rows.map((row) => {
    const { measures } = row;
    const report = {
      measures,
      counts: row.counts,
      findings: [],
      skipped: { crossings: measures.crossings === null },
    };
    return [
      row.label,
      measures.crossings === null ? 'skipped' : String(measures.crossings),
      String(measures.behind),
      String(measures.overlaps),
      measures.extent ? `${measures.extent.width}×${measures.extent.height}` : 'empty',
      row.ratio === null ? '-' : row.ratio.toFixed(1),
      lintVerdict(report) + (row.best ? '  ← best' : ''),
    ];
  });
  const widths = header.map((h, i) =>
    Math.max([...h].length, ...cells.map((c) => [...c[i]!].length)),
  );
  const line = (c: readonly string[]) =>
    c
      .map((cell, i) =>
        i === c.length - 1 ? cell : cell + ' '.repeat(widths[i]! - [...cell].length),
      )
      .join('  ');
  return [line(header), ...cells.map(line)].join('\n');
}
