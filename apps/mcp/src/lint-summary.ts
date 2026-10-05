// The diagram lint's summary line on the MCP's write tools (docs/specs/024-agents/diagram-lint.md "Where it
// runs", LN24): from a changeset's report, or read per created tab through `?view=lint&json=1`. A lint
// that is missing or fails reads `lint unavailable` and never fails the tool.

import type { LintReport } from '@livediagram/api-schema';
import { lintSummaryLine } from '@livediagram/diagram-lint';
import { apiJson } from './api';
import type { Env } from './env';

export const LINT_UNAVAILABLE = 'lint unavailable';

export function lintLineOf(report: LintReport | null): string {
  return report ? lintSummaryLine(report) : LINT_UNAVAILABLE;
}

// One summary line per created tab, in order.
export async function lintLinesOf(
  env: Env,
  token: string,
  documentId: string,
  tabIds: readonly string[],
): Promise<string[]> {
  return Promise.all(
    tabIds.map(async (tabId) => {
      try {
        const report = await apiJson<LintReport>(
          env,
          token,
          `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}?view=lint&json=1`,
        );
        return lintSummaryLine(report);
      } catch (err) {
        console.error('[lint] failed', { where: 'mcp', error: String(err) });
        return LINT_UNAVAILABLE;
      }
    }),
  );
}
