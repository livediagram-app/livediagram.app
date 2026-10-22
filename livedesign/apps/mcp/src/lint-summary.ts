// The diagram lint on the MCP's write tools (docs/specs/024-agents/diagram-lint.md "Where it runs", LN24): the
// summary line in the structured result, and the summary with every finding (refs first, the fix last) as a text
// block, so the model can act on each one. From a changeset's report, or read per created tab through
// `?view=lint&json=1`. A lint that is missing or fails reads `lint unavailable` and never fails the tool.

import type { LintReport } from '@livedesign/api-schema';
import { formatLintReport, lintSummaryLine } from '@livedesign/diagram-lint';
import { apiJson } from './api';
import type { Env } from './env';

const LINT_UNAVAILABLE = 'lint unavailable';

export function lintLineOf(report: LintReport | null): string {
  return report ? lintSummaryLine(report) : LINT_UNAVAILABLE;
}

// The summary line and the findings, one a line, for the text block.
export function lintTextOf(report: LintReport | null): string {
  return report ? formatLintReport(report) : LINT_UNAVAILABLE;
}

// Each created tab's report, in order; null where the lint is unavailable.
export async function lintReportsOf(
  env: Env,
  token: string,
  documentId: string,
  tabIds: readonly string[],
): Promise<(LintReport | null)[]> {
  return Promise.all(
    tabIds.map(async (tabId) => {
      try {
        const report = await apiJson<LintReport>(
          env,
          token,
          `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}?view=lint&json=1`,
        );
        return report;
      } catch (err) {
        console.error('[lint] failed', { where: 'mcp', error: String(err) });
        return null;
      }
    }),
  );
}
