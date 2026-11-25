import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { revertStep } from './revert-step';

// liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md "Undo through the room, never a stale copy".

type Item = { id: string; v: number };
const item = (id: string, v = 0): Item => ({ id, v });
const ids = (xs: readonly Item[]) => xs.map((x) => x.id).join(',');

describe('revertStep', () => {
  it('with nothing changed since, gives back exactly the list before the step, order and all', () => {
    const before = [item('a'), item('b'), item('c'), item('d')];
    const after = [before[0]!, before[3]!];
    expect(revertStep(before, after, after)).toEqual(before);
  });

  it('a reset (everything removed) comes back whole, under anything added since', () => {
    const before = [item('a'), item('b')];
    const added = item('n');
    expect(ids(revertStep(before, [], [added]))).toBe('a,b,n');
  });

  it('puts a removed item back after the nearest earlier neighbour still there', () => {
    const [a, b, c, d] = [item('a'), item('b'), item('c'), item('d')];
    // b and c removed; a collaborator then removed a and added e at the end.
    const out = revertStep([a, b, c, d], [a, d], [d, item('e')]);
    expect(ids(out)).toBe('b,c,d,e');
  });

  it('takes back a change only when nobody has changed the item since', () => {
    const a0 = item('a', 0);
    const a1 = item('a', 1);
    expect(revertStep([a0], [a1], [a1])).toEqual([a0]);
    const a2 = item('a', 2);
    // A collaborator's later edit wins.
    expect(revertStep([a0], [a1], [a2])).toEqual([a2]);
  });

  it('removes what the step added, unless it was changed since', () => {
    const n = item('n');
    expect(revertStep([], [n], [n])).toEqual([]);
    const edited = item('n', 5);
    expect(revertStep([], [n], [edited])).toEqual([edited]);
  });

  it('never resurrects what someone else removed after the step', () => {
    const [a, b] = [item('a'), item('b')];
    // The step changed nothing about b; a collaborator deleted b afterwards.
    expect(ids(revertStep([a, b], [a, b], [a]))).toBe('a');
  });

  it('leaves an item someone already put back alone, and answers the same list when there is nothing to do', () => {
    const [a, b] = [item('a'), item('b')];
    const current = [a, b];
    expect(revertStep([a, b], [a], current)).toBe(current);
  });

  it('stays linear on a large tab', () => {
    const before = Array.from({ length: 20_000 }, (_, i) => item(`e${i}`));
    const after: Item[] = [];
    const current = Array.from({ length: 20_000 }, (_, i) => item(`n${i}`));
    let out: Item[] = [];
    const ms = cpuMsOf(() => {
      out = revertStep(before, after, current);
    });
    expect(out).toHaveLength(40_000);
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
