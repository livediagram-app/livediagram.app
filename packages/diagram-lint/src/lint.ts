// The diagram lint (docs/specs/024-agents/diagram-lint.md; blueprint "Behaviour and state"): a pure
// check of how a tab is drawn, returning its measures and findings in a fixed order.

import type { LintCode, LintReport, LintSeverity } from '@livediagram/api-schema';
import {
  opensInOf,
  conciseGraph,
  layoutGraph,
  type Element,
  type GraphInput,
  type Tab,
} from '@livediagram/document';
import { LINT_CHECKS } from './checks';
import { aspectExtreme } from './checks/aspect-extreme';
import { colourOnThemed } from './checks/colour-on-themed';
import { textOverflow, textOverprint } from './checks/text-overflow';
import { LINT_MAX_ARROWS } from './constants';
import { prepareLintContext, type LintSource } from './context';
import { consoleLintLogger, type LintLogger } from './log';
import { crossingPairs, lintExtent } from './measures';
import { sortFindings } from './order';

export type LintOptions = {
  source?: LintSource;
  flow?: 'down' | 'right';
  log?: LintLogger;
  // The elements whose colours a changeset set (coloursSet): colour-on-themed names only those, so a template's own
  // colours are never put to the agent as its doing. Absent, every element is judged.
  coloured?: ReadonlySet<string>;
};

// The checks a tab is linted with: a Pages tab's pages fix its shape, so a drawing wider than tall is no finding
// there (a deck of slides is a row of pages), and laying it out as a diagram would wreck them.
// and its text is its content, so text that overflows its box or prints over other text is (text-overflow).
const PAGE_CHECKS = [
  ...LINT_CHECKS.filter((check) => check !== aspectExtreme && check !== colourOnThemed),
  textOverflow,
];
// Any other tab: text printed over text is a finding there too (text-overflow's overprint half).
const TAB_CHECKS = [...LINT_CHECKS, textOverprint];

export function lintTab(
  tab: Pick<Tab, 'elements' | 'layers' | 'theme'> & Partial<Pick<Tab, 'opensIn' | 'kind'>>,
  options: LintOptions = {},
): LintReport {
  const checks = opensInOf(tab) === 'pages' ? PAGE_CHECKS : TAB_CHECKS;
  const started = performance.now();
  const source = options.source ?? 'tab';
  const log = options.log ?? consoleLintLogger;
  const ctx = prepareLintContext(tab, { source, ...(options.flow ? { flow: options.flow } : {}) });
  const crossings = crossingPairs(ctx);
  if (!crossings)
    log('[lint] crossings skipped', { arrows: ctx.drawable.length, max: LINT_MAX_ARROWS });
  const coloured = options.coloured;
  const findings = sortFindings(
    checks.flatMap((check) => check({ ...ctx, crossings, log, ...(coloured ? { coloured } : {}) })),
  );
  const count = (code: LintCode) => findings.filter((f) => f.code === code).length;
  const counts: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 };
  const perCode: Record<string, number> = {};
  for (const f of findings) {
    counts[f.severity]++;
    perCode[f.code] = (perCode[f.code] ?? 0) + 1;
  }
  const report: LintReport = {
    measures: {
      crossings: crossings?.pairs ?? null,
      behind: count('arrow-behind-box'),
      overlaps: count('box-overlap'),
      extent: lintExtent(ctx),
      arrows: ctx.drawable.length,
      boxes: ctx.boxes.length,
    },
    findings,
    counts,
    skipped: { crossings: crossings === null },
  };
  log('[lint] run', {
    source,
    elements: tab.elements.length,
    boxes: ctx.boxes.length,
    arrows: ctx.drawable.length,
    skipped: ctx.skipped,
    errors: counts.error,
    warnings: counts.warning,
    infos: counts.info,
    ...perCode,
    crossingsSkipped: crossings === null,
    ms: Math.round(performance.now() - started),
  });
  return report;
}

// Arrow ids for a laid-out graph source: `e1`, `e2`, … in edge order, suffixed on a clash with a node id,
// so a graph lint is deterministic (LN28).
export function graphEdgeIds(input: GraphInput): () => string {
  const nodeIds = new Set(input.nodes.map((n) => n.id));
  let n = 0;
  return () => {
    const base = `e${++n}`;
    let id = base;
    for (let k = 2; nodeIds.has(id); k++) id = `${base}-${k}`;
    return id;
  };
}

// A graph or Mermaid source, laid out as `create_document` lays it out, then linted.
export function lintGraph(
  input: GraphInput,
  options: { log?: LintLogger } = {},
): { report: LintReport; elements: Element[] } {
  const elements = layoutGraph(input, { makeEdgeId: graphEdgeIds(conciseGraph(input)) });
  const report = lintTab(
    { elements },
    { source: 'graph', ...(input.direction ? { flow: input.direction } : {}), ...options },
  );
  return { report, elements };
}
