// @livedesign/diagram-lint: how a tab is drawn, checked (docs/specs/024-agents/diagram-lint.md).

export { lintTab, type LintOptions } from './lint';
export { formatLintReport, lintFooterPart, lintSummaryLine, lintVerdict } from './format';
export { consoleLintLogger, type LintLogger } from './log';
export * from './constants';
