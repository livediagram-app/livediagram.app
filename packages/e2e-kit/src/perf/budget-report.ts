// What the nightly run does with the budget issue (each product's docs/specs/008-canvas/canvas-performance.md
// "Measuring"), and what it says. Pure: nightly.mjs does the I/O.

// Each product has its own issue, found by this title (no label).
export function budgetIssueTitle(product: string): string {
  return `Canvas performance budget: ${product}`;
}

type BudgetIssueAction = 'open' | 'comment' | 'close' | 'none';

// The most commits a report lists (git log's order: the latest first), then how many more. Every night from
// 2026-10-16 listed all 2,219 since the last green one, 190 KB against GitHub's 65,536-character body, and
// the 422 failed the run.
export const MAX_LISTED_COMMITS = 30;

// Only a run on main reports; a branch measured by hand writes its job summary and nothing else.
export function budgetIssueAction(run: {
  misses: number;
  issueOpen: boolean;
  onMain: boolean;
}): BudgetIssueAction {
  if (!run.onMain) return 'none';
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
  const listed = report.commits.slice(0, MAX_LISTED_COMMITS);
  const more = report.commits.length - listed.length;
  const commits = report.commits.length
    ? [
        '',
        'Commits since the previous run:',
        '',
        ...listed.map((c) => `- ${c}`),
        ...(more > 0 ? ['', `And ${more} more.`] : []),
      ]
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
