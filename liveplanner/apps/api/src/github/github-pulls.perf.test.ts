import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { ITEM_BULK_MAX, defaultCatalogue, itemStatus, type Item } from '@liveplanner/items';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { connection, githubWorld, prPayload, type GithubWorld } from './test-github-world';

// What one delivery costs a plan of 2,000 cards (docs/specs/026-plan/github-pull-requests.md "Limits"; blueprint
// "Part 3" "Performance and limits", "Part 4"): a pull request's state kept and sent, its opened trigger queuing a run
// on each card it links, and the room's wake running them (moving each card). The worst case for the field lookup: every card holds a pull request of the same repository whose number
// starts with the delivered one's (#42 and #4200 to #6194), so SQLite's LIKE matches all 2,000 and each is read and
// confirmed. CPU time, never wall-clock (testing.md).
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

const CARDS = 2000;
let w: GithubWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await githubWorld(['A']);
  await w.seed('A', connection(7, [{ id: 11 }]));
  const catalogue = structuredClone(defaultCatalogue()) as unknown as {
    types: { id: string; custom?: unknown[] }[];
  };
  const task = catalogue.types.find((t) => t.id === 'task')!;
  task.custom = [
    ...(task.custom ?? []),
    { id: 'f-pr', label: 'Pull Request', kind: 'pullrequest' },
  ];
  await w.send('PUT', '/api/projects/A/item-types', { itemTypes: catalogue });
  for (let from = 0; from < CARDS; from += ITEM_BULK_MAX) {
    const items = Array.from({ length: ITEM_BULK_MAX }, (_, j) => {
      const i = from + j;
      return {
        type: 'task',
        fields: {
          title: `Card ${i}`,
          description: `Notes for card ${i}, see github.com/acme/repo-11/pull/${4200 + i}`,
          'f-pr': `https://github.com/acme/repo-11/pull/${i < 5 ? 42 : 4200 + i}`,
        },
        place: { status: 'todo' },
      };
    });
    const res = await w.send('POST', '/api/projects/A/items/bulk', { items });
    if (res.status !== 201) throw new Error(`bulk answered ${res.status}: ${await res.text()}`);
  }
  await w.rule({
    name: 'Review on Open',
    trigger: { kind: 'pull_request_opened' },
    steps: [{ kind: 'move', status: 'review' }],
  });
}, 120_000);
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

describe('a delivery on a 2,000-card plan', () => {
  it('keeps the state and moves the 8 cards it links, by field and by mention, within budget', async () => {
    let status = 0;
    const opened = await cpuMsOfAsync(async () => {
      const res = await w.deliver(
        'pull_request',
        prPayload({ title: 'Ship A #1000, A #1500 and A #1999', body: 'x '.repeat(30_000) }),
      );
      status = res.status;
    });
    expect(status).toBe(202);
    // The wake runs the 8 queued runs (each a move at the column's end, read against the plan's 2,000 cards).
    const ran = await cpuMsOfAsync(() => w.plans.get('A')!.room.alarm());
    const items = await w.items('A');
    const moved = items.filter((i: Item) => itemStatus(i) === 'review');
    expect(moved.length).toBe(8);
    // A delivery with no rule to run: the state alone (an edit, a new commit).
    const edited = await cpuMsOfAsync(async () => {
      await w.deliver('pull_request', prPayload({ action: 'edited', at: '2026-11-12T11:00:00Z' }));
    });
    // Measured on an M-series Mac: opened (a 60 KB body read for mentions, LIKE over 2,000 cards, 2,000 read and
    // confirmed, 8 runs queued) 5 to 9 ms; the wake's 8 runs (each move reads the 2,000 cards for its place, as any
    // rule's move does) 104 to 145 ms; edited (the state alone) 1.4 to 2.7 ms.
    expect(opened).toBeLessThan(cpuBudgetMs(400));
    expect(ran).toBeLessThan(cpuBudgetMs(1500));
    expect(edited).toBeLessThan(cpuBudgetMs(50));
  }, 120_000);
});
