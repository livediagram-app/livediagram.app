// The diagram lint (docs/specs/024-agents/diagram-lint.md; blueprint "Behaviour and state"): a pure
// check of how a tab is drawn, returning its measures and findings in a fixed order.

import type { LintReport, LintSeverity } from '@livehuddle/api-schema';
import type { Tab } from '@livehuddle/document';
import { LINT_CHECKS } from './checks';
import { textOverprint } from './checks/text-overflow';
import { prepareLintContext } from './context';
import { consoleLintLogger, type LintLogger } from '@liveworkspace/diagram-lint/log';
import { lintExtent } from './measures';
import { sortFindings } from './order';

export type LintOptions = {
  log?: LintLogger;
  // The elements whose colours a changeset set (coloursSet): colour-on-themed names only those, so a template's own
  // colours are never put to the agent as its doing. Absent, every element is judged.
  coloured?: ReadonlySet<string>;
};

// The checks a tab is linted with: text printed over text is a finding too (text-overflow).
const TAB_CHECKS = [...LINT_CHECKS, textOverprint];

export function lintTab(
  tab: Pick<Tab, 'elements' | 'theme'> & Partial<Pick<Tab, 'opensIn' | 'kind'>>,
  options: LintOptions = {},
): LintReport {
  const checks = TAB_CHECKS;
  const started = performance.now();
  const log = options.log ?? consoleLintLogger;
  const ctx = prepareLintContext(tab);
  const coloured = options.coloured;
  const findings = sortFindings(
    checks.flatMap((check) => check({ ...ctx, log, ...(coloured ? { coloured } : {}) })),
  );
  const counts: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 };
  const perCode: Record<string, number> = {};
  for (const f of findings) {
    counts[f.severity]++;
    perCode[f.code] = (perCode[f.code] ?? 0) + 1;
  }
  // The arrow and overlap measures stay on the wire at nothing: no arrow is drawn as one, and no box is joined to
  // another, since part 4 of the element engine.
  const report: LintReport = {
    measures: {
      crossings: 0,
      behind: 0,
      overlaps: 0,
      extent: lintExtent(ctx),
      arrows: 0,
      boxes: ctx.boxes.length,
    },
    findings,
    counts,
    skipped: { crossings: false },
  };
  log('[lint] run', {
    elements: tab.elements.length,
    boxes: ctx.boxes.length,
    skipped: ctx.skipped,
    errors: counts.error,
    warnings: counts.warning,
    infos: counts.info,
    ...perCode,
    ms: Math.round(performance.now() - started),
  });
  return report;
}
