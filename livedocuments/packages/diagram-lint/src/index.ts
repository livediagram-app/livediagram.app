// @livedocuments/diagram-lint: how a tab is drawn, checked (docs/specs/024-agents/diagram-lint.md).

export { lintTab, type LintOptions } from './lint';
export {
  formatLintReport,
  lintFooterPart,
  lintSummaryLine,
  lintVerdict,
} from '@liveworkspace/diagram-lint/format';
export { consoleLintLogger, type LintLogger } from '@liveworkspace/diagram-lint/log';
export * from './constants';
