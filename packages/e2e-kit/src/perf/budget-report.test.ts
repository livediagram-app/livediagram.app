import { describe, expect, it } from 'vitest';
import {
  MAX_LISTED_COMMITS,
  budgetIssueAction,
  budgetIssueComment,
  budgetIssueTitle,
} from './budget-report';

// Each product's docs/specs/008-canvas/canvas-performance.md "Measuring": a failing run opens one issue or comments
// on it; the first all-pass run closes it.

describe('budgetIssueAction', () => {
  it('opens the issue on a miss when none is open, and comments on it when one is', () => {
    expect(budgetIssueAction({ misses: 2, issueOpen: false, onMain: true })).toBe('open');
    expect(budgetIssueAction({ misses: 2, issueOpen: true, onMain: true })).toBe('comment');
  });

  it('closes an open issue on an all-pass run, and does nothing otherwise', () => {
    expect(budgetIssueAction({ misses: 0, issueOpen: true, onMain: true })).toBe('close');
    expect(budgetIssueAction({ misses: 0, issueOpen: false, onMain: true })).toBe('none');
  });
});

describe('budgetIssueAction on a branch', () => {
  it('leaves the issue alone, whatever the run found', () => {
    expect(budgetIssueAction({ misses: 2, issueOpen: false, onMain: false })).toBe('none');
    expect(budgetIssueAction({ misses: 2, issueOpen: true, onMain: false })).toBe('none');
    expect(budgetIssueAction({ misses: 0, issueOpen: true, onMain: false })).toBe('none');
  });
});

describe('budgetIssueComment', () => {
  it('carries the table, the commits since the previous run, and the run', () => {
    const body = budgetIssueComment({
      action: 'comment',
      table: '| a |',
      misses: 3,
      rows: 38,
      sha: 'abc1234',
      commits: ['abc1234 Faster arrows', 'def5678 Map settles'],
      runUrl: 'https://github.com/o/r/actions/runs/1',
    });
    expect(body).toContain('3 of 38 rows over budget at abc1234');
    expect(body).toContain('| a |');
    expect(body).toContain('- abc1234 Faster arrows');
    expect(body).toContain('https://github.com/o/r/actions/runs/1');
  });

  // 2,219 commits since the last green night made a 190 KB body, and GitHub refuses one over 65,536 characters.
  it('lists the latest commits, then how many more, so a long gap stays postable', () => {
    const commits = Array.from(
      { length: 2219 },
      (_, i) => `${String(i).padStart(10, '0')} ${'x'.repeat(70)}`,
    );
    const body = budgetIssueComment({
      action: 'comment',
      table: '| a |',
      misses: 3,
      rows: 38,
      sha: 'abc1234',
      commits,
      runUrl: 'u',
    });
    expect(body).toContain(`- ${commits[0]}`);
    expect(body).toContain(`- ${commits[MAX_LISTED_COMMITS - 1]}`);
    expect(body).not.toContain(`- ${commits[MAX_LISTED_COMMITS]}`);
    expect(body).toContain(`And ${2219 - MAX_LISTED_COMMITS} more.`);
    expect(body.length).toBeLessThan(65_536);
  });

  it('says so when the budget holds again', () => {
    const body = budgetIssueComment({
      action: 'close',
      table: '| a |',
      misses: 0,
      rows: 38,
      sha: 'abc1234',
      commits: [],
      runUrl: 'u',
    });
    expect(body.startsWith('Back within budget at abc1234.')).toBe(true);
  });

  it("names each product's issue", () => {
    expect(budgetIssueTitle('livedesign')).toBe('Canvas performance budget: livedesign');
    expect(budgetIssueTitle('liveplanner')).toBe('Canvas performance budget: liveplanner');
  });
});
