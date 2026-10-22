// @livepages/diagram-lint: how a tab is drawn, checked (docs/specs/024-agents/diagram-lint.md).

export { lintGraph, lintTab, type LintOptions } from './lint';
export { formatLintReport, lintFooterPart, lintSummaryLine, lintVerdict } from './format';
export { compareGraphLayouts, formatCompareTable, parseCompareDimensions } from './compare';
export { consoleLintLogger, type LintLogger } from './log';
export type { LintSource } from './context';
export * from './constants';
