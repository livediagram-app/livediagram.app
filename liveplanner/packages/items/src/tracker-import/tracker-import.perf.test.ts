import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { isTrackerRefusal, readTrackerFile } from './read-tracker-file';
import { csvRows } from './test-csv';
import { TRACKER_CARDS_MAX } from './tracker-model';
import { planTrackerImport } from './tracker-plan';

// docs/specs/026-plan/blueprints/tracker-import.md "Performance": reading and planning are linear in the file, so a
// file at the caps (2,000 cards, ten comments each, a checklist and labels on every card) is read and planned well
// inside the budget. Budgets are CPU time, far above what was measured (about 260 ms for the 7.7 MB board,
// 120 ms for the CSV, on a laptop).

function bigTrello(): string {
  const lists = Array.from({ length: 8 }, (_, i) => ({ id: `l${i}`, name: `List ${i}`, pos: i }));
  const members = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, fullName: `Person ${i}` }));
  const cards = Array.from({ length: TRACKER_CARDS_MAX }, (_, i) => ({
    id: `c${i}`,
    name: `Card ${i}`,
    desc: `Description of card ${i}. `.repeat(20),
    idList: `l${i % 8}`,
    pos: i,
    due: '2026-11-14T17:00:00.000Z',
    idMembers: [`m${i % 40}`, `m${(i + 1) % 40}`],
    labels: [{ name: `Label ${i % 10}` }, { name: 'High' }],
    idChecklists: [`k${i}`],
    attachments: [{ name: 'spec.pdf', url: `https://example.com/${i}.pdf` }],
  }));
  const checklists = cards.map((c, i) => ({
    id: `k${i}`,
    idCard: c.id,
    checkItems: Array.from({ length: 10 }, (_, j) => ({
      name: `Step ${j}`,
      state: 'incomplete',
      pos: j,
    })),
  }));
  const actions = cards.flatMap((c, i) =>
    Array.from({ length: 10 }, (_, j) => ({
      type: 'commentCard',
      date: new Date(Date.UTC(2026, 0, 1) + (i * 10 + j) * 60_000).toISOString(),
      data: { text: `Comment ${j} on ${c.name}. `.repeat(5), card: { id: c.id } },
      memberCreator: { fullName: `Person ${j}` },
    })),
  );
  return JSON.stringify({ name: 'Big board', lists, members, cards, checklists, actions });
}

function bigJira(): string {
  const header =
    'Summary,Issue key,Issue Type,Status,Priority,Assignee,Labels,Labels,Description,Comment,Comment,Comment';
  const rows = Array.from(
    { length: TRACKER_CARDS_MAX },
    (_, i) =>
      `Issue ${i},K-${i},Task,Status ${i % 6},High,Person ${i % 30},a,b,"Line one\nLine two ${i}",01/Jan/26 9:00 AM;Ana;First,02/Jan/26 9:00 AM;Ben;Second,03/Jan/26 9:00 AM;Cy;Third`,
  );
  return [header, ...rows].join('\n');
}

const ctx = {
  types: [],
  statuses: [],
  people: [],
  members: [],
  room: TRACKER_CARDS_MAX,
  boardId: 'b',
};

describe('importing a file at the caps', () => {
  it('reads and plans a 2,000-card Trello board with 20,000 comments in budget', () => {
    const text = bigTrello();
    let creates = 0;
    let comments = 0;
    const ms = cpuMsOf(() => {
      const board = readTrackerFile(text, csvRows);
      if (isTrackerRefusal(board)) throw new Error(board.refusal);
      const plan = planTrackerImport(board, ctx);
      creates = plan.creates.length;
      comments = plan.preview.comments.count;
    });
    expect(creates).toBe(TRACKER_CARDS_MAX);
    expect(comments).toBe(20_000);
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
  });

  it('reads and plans a 2,000-row Jira CSV in budget', () => {
    const text = bigJira();
    let creates = 0;
    const ms = cpuMsOf(() => {
      const board = readTrackerFile(text, csvRows);
      if (isTrackerRefusal(board)) throw new Error(board.refusal);
      creates = planTrackerImport(board, ctx).creates.length;
    });
    expect(creates).toBe(TRACKER_CARDS_MAX);
    expect(ms).toBeLessThan(cpuBudgetMs(1000));
  });
});
