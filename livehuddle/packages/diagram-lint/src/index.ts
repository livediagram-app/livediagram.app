// @livehuddle/diagram-lint: how a tab is drawn, checked (docs/specs/024-agents/diagram-lint.md).

export { lintGraph, lintTab, type LintOptions } from './lint';
export { coloursSet } from './colours-set';
export { withoutFindings } from './without-findings';
export {
  formatLintReport,
  lintFooterPart,
  lintSummaryLine,
  lintVerdict,
} from '@liveworkspace/diagram-lint/format';
export { compareGraphLayouts, formatCompareTable, parseCompareDimensions } from './compare';
export { consoleLintLogger, type LintLogger } from '@liveworkspace/diagram-lint/log';
export type { LintSource } from './context';
export * from './constants';
