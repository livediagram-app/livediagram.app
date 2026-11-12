import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  PULL_REQUESTS_KEPT,
  cardFieldPullRequests,
  cardLinkedPullRequests,
  pullRequestStatuses,
  type CardFieldPullRequest,
  type PullRequestStatus,
} from './index';

// What a delivery costs a 2,000-card board on screen (docs/specs/026-plan/blueprints/github-pull-requests.md "Part 3"
// "Performance and limits"): the plan's 500 kept states made into lookups once, then every card picking its linked
// pull requests again (each card holding one in a Pull Request field and one in a Link field, a third of them named by
// a state too). The editor keeps an unchanged pick, so only the cards it touches redraw. CPU time, never wall-clock.

const CARDS = 2000;
const type = {
  custom: [
    { id: 'pr', label: 'Pull Request', kind: 'pullrequest' as const },
    { id: 'link', label: 'Link', kind: 'link' as const },
  ],
};
const cards = Array.from({ length: CARDS }, (_, i) => ({
  id: `c${i}`,
  fields: {
    pr: `https://github.com/acme/web/pull/${i + 1}`,
    link: `https://github.com/acme/api/pull/${i + 1}`,
  },
}));
const states: PullRequestStatus[] = Array.from({ length: PULL_REQUESTS_KEPT }, (_, i) => ({
  key: `acme/web#${i + 1}`,
  url: `https://github.com/acme/web/pull/${i + 1}`,
  title: `PR ${i + 1}`,
  state: 'open',
  updatedAt: i,
  cards: [`c${(i * 3) % CARDS}`, `c${(i * 3 + 1) % CARDS}`],
}));

describe('pull request states on a 2,000-card board', () => {
  it('picks every card’s on the first draw, and again for a delivery with the fields kept, within budget', () => {
    let picked = 0;
    let fields: CardFieldPullRequest[][] = [];
    const first = cpuMsOf(() => {
      const statuses = pullRequestStatuses(states);
      fields = cards.map((c) => cardFieldPullRequests(c, type));
      cards.forEach((c, i) => {
        picked += cardLinkedPullRequests(c, type, statuses, fields[i]).length;
      });
    });
    expect(picked).toBeGreaterThan(CARDS * 2);
    // A delivery: one state changed, the lookups made again, every card's fields kept (pull-request-store.ts).
    const next = states.map((s, i) => (i === 0 ? { ...s, state: 'merged' as const } : s));
    const delivery = cpuMsOf(() => {
      const statuses = pullRequestStatuses(next);
      cards.forEach((c, i) => cardLinkedPullRequests(c, type, statuses, fields[i]));
    });
    // Measured on an M-series Mac at a load average near 60: the first draw 39 to 54 ms (4,000 addresses parsed), a
    // delivery 1.8 to 12 ms.
    expect(first).toBeLessThan(cpuBudgetMs(300));
    expect(delivery).toBeLessThan(cpuBudgetMs(40));
  });
});
