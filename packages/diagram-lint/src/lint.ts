// The diagram lint (docs/specs/024-agents/diagram-lint.md; blueprint "Behaviour and state"): a pure
// check of how a tab is drawn, returning its measures and findings in a fixed order.

import type { LintCode, LintReport, LintSeverity } from '@livediagram/api-schema';
import {
  conciseGraph,
  layoutGraph,
  type Element,
  type GraphInput,
  type Tab,
} from '@livediagram/document';
import { LINT_CHECKS } from './checks';
import { LINT_MAX_ARROWS } from './constants';
import { prepareLintContext, type LintSource } from './context';
import { consoleLintLogger, type LintLogger } from './log';
import { crossingPairs, lintExtent } from './measures';
import { sortFindings } from './order';

export type LintOptions = { source?: LintSource; flow?: 'down' | 'right'; log?: LintLogger };

export function lintTab(
  tab: Pick<Tab, 'elements' | 'layers' | 'theme'>,
  options: LintOptions = {},
): LintReport {
  const started = performance.now();
  const source = options.source ?? 'tab';
  const log = options.log ?? consoleLintLogger;
  const ctx = prepareLintContext(tab, { source, ...(options.flow ? { flow: options.flow } : {}) });
  const crossings = crossingPairs(ctx);
  if (!crossings)
    log('[lint] crossings skipped', { arrows: ctx.drawable.length, max: LINT_MAX_ARROWS });
  const findings = sortFindings(LINT_CHECKS.flatMap((check) => check({ ...ctx, crossings, log })));
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
