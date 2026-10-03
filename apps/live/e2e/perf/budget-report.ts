// What the nightly run does with the budget issue (docs/specs/008-canvas/canvas-performance.md
// "Measuring"), and what it says. Pure: nightly.ts does the I/O.

export const BUDGET_ISSUE_TITLE = 'Canvas performance budget';

export type BudgetIssueAction = 'open' | 'comment' | 'close' | 'none';

export function budgetIssueAction(run: { misses: number; issueOpen: boolean }): BudgetIssueAction {
  if (run.misses > 0) return run.issueOpen ? 'comment' : 'open';
  return run.issueOpen ? 'close' : 'none';
}

export function budgetIssueComment(report: {
  action: BudgetIssueAction;
  table: string;
  misses: number;
  rows: number;
  sha: string;
  commits: readonly string[];
  runUrl: string;
}): string {
  const head =
    report.action === 'close'
      ? `Back within budget at ${report.sha}.`
      : `${report.misses} of ${report.rows} rows over budget at ${report.sha}.`;
  const commits = report.commits.length
    ? ['', 'Commits since the previous run:', '', ...report.commits.map((c) => `- ${c}`)]
    : [];
  return [
    head,
    '',
    report.table,
    ...commits,
    '',
    `Run, traces and screenshots: ${report.runUrl}`,
  ].join('\n');
}
