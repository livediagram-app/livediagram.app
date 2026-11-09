import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { ShownItem } from '../data/overlay';
import { makeItem } from '../test/fakeClient';
import { kindWords } from '../words';
import { trashGroups } from './TrashPane';

const item = (i: number, teamId: string | null) => makeItem(i, { teamId }) as ShownItem;
const names: Record<string, string> = { t2: 'Team 2', t10: 'Team 10', ta: 'alpha' };
const teamName = (id: string | null) => (id ? (names[id] ?? null) : null);
const words = kindWords('liveplanner');

describe('trashGroups', () => {
  it('puts yours first, then each team by name, numbers read as numbers', () => {
    const groups = trashGroups(
      [item(1, 't10'), item(2, null), item(3, 't2'), item(4, 'ta'), item(5, 't10')],
      teamName,
      words,
    );
    expect(groups.map((g) => g.key)).toEqual(['mine', 'team:ta', 'team:t2', 'team:t10']);
    expect(groups.at(-1)!.rows.map((r) => r.id)).toEqual(['item-1', 'item-5']);
  });

  // It runs on every render of the Trash: one big team's Trash must not grow it quadratically.
  it('groups 20,000 items of one team within budget', () => {
    const items = Array.from({ length: 20_000 }, (_, i) => item(i, 't2'));
    const ms = cpuMsOf(() => {
      const groups = trashGroups(items, teamName, words);
      expect(groups[0]!.rows).toHaveLength(20_000);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});
