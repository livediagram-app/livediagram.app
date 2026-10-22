// The page lint (docs/specs/024-agents/page-lint.md; blueprint "Behaviour and state"): a pure check of whether a
// tab's text fits where it is drawn, returning its measures and findings in a fixed order.

import type { LintReport, LintSeverity } from '@livedesign/api-schema';
import type { Tab } from '@livedesign/document';
import { LINT_CHECKS } from './checks';
import { prepareLintContext } from './context';
import { consoleLintLogger, type LintLogger } from './log';
import { lintExtent } from './measures';
import { sortFindings } from './order';
import { lintTexts } from './checks/text-overflow';

export function lintTab(
  tab: Pick<Tab, 'elements' | 'layers'>,
  options: { log?: LintLogger } = {},
): LintReport {
  const started = performance.now();
  const log = options.log ?? consoleLintLogger;
  const ctx = prepareLintContext(tab);
  const findings = sortFindings(LINT_CHECKS.flatMap((check) => check(ctx)));
  const counts: Record<LintSeverity, number> = { error: 0, warning: 0, info: 0 };
  const perCode: Record<string, number> = {};
  for (const f of findings) {
    counts[f.severity]++;
    perCode[f.code] = (perCode[f.code] ?? 0) + 1;
  }
  const texts = lintTexts(ctx).length;
  const report: LintReport = {
    measures: { extent: lintExtent(ctx), boxes: ctx.boxes.length, texts },
    findings,
    counts,
  };
  log('[lint] run', {
    elements: tab.elements.length,
    boxes: ctx.boxes.length,
    texts,
    skipped: ctx.skipped,
    errors: counts.error,
    warnings: counts.warning,
    infos: counts.info,
    ...perCode,
    ms: Math.round(performance.now() - started),
  });
  return report;
}
