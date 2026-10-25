// The diagram lint (docs/specs/024-agents/diagram-lint.md; blueprint "Behaviour and state"): a pure
// check of how a tab is drawn, returning its measures and findings in a fixed order.

import type { LintCode, LintReport, LintSeverity } from '@livedocuments/api-schema';
import type { Tab } from '@livedocuments/document';
import { LINT_CHECKS } from './checks';
import { textOverflow } from './checks/text-overflow';
import { LINT_MAX_ARROWS } from './constants';
import { prepareLintContext } from './context';
import { consoleLintLogger, type LintLogger } from '@liveworkspace/diagram-lint/log';
import { crossingPairs, lintExtent } from './measures';
import { sortFindings } from './order';

export type LintOptions = {
  flow?: 'down' | 'right';
  log?: LintLogger;
};

// The checks a tab is linted with. Every tab is a Pages tab, whose text is its content, so text that overflows its
// box or prints over other text is a finding (text-overflow).
const CHECKS = [...LINT_CHECKS, textOverflow];

export function lintTab(
  tab: Pick<Tab, 'elements' | 'layers' | 'theme'>,
  options: LintOptions = {},
): LintReport {
  const started = performance.now();
  const log = options.log ?? consoleLintLogger;
  const ctx = prepareLintContext(tab, { ...(options.flow ? { flow: options.flow } : {}) });
  const crossings = crossingPairs(ctx);
  if (!crossings)
    log('[lint] crossings skipped', { arrows: ctx.drawable.length, max: LINT_MAX_ARROWS });
  const findings = sortFindings(CHECKS.flatMap((check) => check({ ...ctx, crossings, log })));
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
