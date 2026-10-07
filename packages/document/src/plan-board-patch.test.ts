import { describe, expect, it } from 'vitest';
import { presetSetup, type PlanBoardSetup } from '@livediagram/items';
import { applyPlanBoardPatch, isPlanBoardPatch, planBoardPatch } from './plan-board-patch';

// docs/specs/012-collaboration/collab-race-hardening.md, phase 6: a board's set-up change as only what changed.

const base = presetSetup('kanban');
const ids = base.columns.map((c) => c.id);
const rename = (s: PlanBoardSetup, id: string, name: string): PlanBoardSetup => ({
  ...s,
  columns: s.columns.map((c) => (c.id === id ? { ...c, name } : c)),
});

describe('planBoardPatch', () => {
  it('is null when nothing changed, and for a missing side', () => {
    expect(planBoardPatch(base, { ...base })).toBeNull();
    expect(planBoardPatch(undefined, base)).toBeNull();
  });

  it('names a changed column field by column id, and only that', () => {
    expect(planBoardPatch(base, rename(base, ids[1]!, 'Ready'))).toEqual({
      columns: { [ids[1]!]: { set: { name: 'Ready' } } },
    });
  });

  it('names top-level fields set and cleared', () => {
    const after = { ...base, title: 'Sprint', swimlaneBy: 'assignee' as const };
    expect(planBoardPatch(base, after)).toEqual({
      set: { title: 'Sprint', swimlaneBy: 'assignee' },
    });
    const compact = { ...base, cardSize: 'compact' as const };
    expect(base.cardSize).toBeUndefined();
    expect(planBoardPatch(compact, base)).toEqual({ clear: ['cardSize'] });
  });

  it('carries an added column whole, a removed one by id, and the order when they move', () => {
    const added = { id: 'new', status: 'new~x', name: 'New' };
    const after = {
      ...base,
      columns: [base.columns[1]!, base.columns[0]!, ...base.columns.slice(2, 4), added],
    };
    const patch = planBoardPatch(base, after)!;
    expect(patch.add).toEqual([added]);
    expect(patch.remove).toEqual([ids[4]]);
    expect(patch.order).toEqual(after.columns.map((c) => c.id));
  });

  it('leaves the order out when only a removal happened', () => {
    const after = { ...base, columns: base.columns.slice(0, 4) };
    expect(planBoardPatch(base, after)).toEqual({ remove: [ids[4]] });
  });
});

describe('applyPlanBoardPatch', () => {
  it('round-trips a diff', () => {
    const after = {
      ...rename(base, ids[2]!, 'Building'),
      title: 'Sprint',
      columns: [...rename(base, ids[2]!, 'Building').columns].reverse(),
    };
    expect(applyPlanBoardPatch(base, planBoardPatch(base, after))).toEqual(after);
  });

  it('commutes for edits to different columns', () => {
    const pa = planBoardPatch(base, rename(base, ids[1]!, 'Ready'));
    const pb = planBoardPatch(base, rename(base, ids[3]!, 'Checking'));
    const onA = applyPlanBoardPatch(applyPlanBoardPatch(base, pa), pb);
    const onB = applyPlanBoardPatch(applyPlanBoardPatch(base, pb), pa);
    expect(onA).toEqual(onB);
    expect(onA.columns.map((c) => c.name)).toEqual([
      'Backlog',
      'Ready',
      'In Progress',
      'Checking',
      'Done',
    ]);
  });

  it('keeps a column added meanwhile beside the one it followed when a move arrives', () => {
    const added = { id: 'mine', status: 'mine~x', name: 'Mine' };
    const local = {
      ...base,
      columns: [...base.columns.slice(0, 2), added, ...base.columns.slice(2)],
    };
    const moved = { ...base, columns: [base.columns[4]!, ...base.columns.slice(0, 4)] };
    const next = applyPlanBoardPatch(local, planBoardPatch(base, moved));
    expect(next.columns.map((c) => c.id)).toEqual([ids[4], ids[0], ids[1], 'mine', ids[2], ids[3]]);
  });

  it('ignores a malformed frame and one leaving no readable set-up', () => {
    expect(applyPlanBoardPatch(base, null)).toBe(base);
    expect(applyPlanBoardPatch(base, { set: { columns: [] } })).toBe(base);
    expect(applyPlanBoardPatch(base, { columns: { [ids[0]!]: { set: { evil: 1 } } } })).toBe(base);
    expect(applyPlanBoardPatch(base, { order: [1] })).toBe(base);
    expect(isPlanBoardPatch({ add: [{ id: '' }] })).toBe(false);
    expect(isPlanBoardPatch({ remove: 'x' })).toBe(false);
    expect(isPlanBoardPatch([])).toBe(false);
  });

  it('returns the set-up itself when the patch changes nothing', () => {
    expect(applyPlanBoardPatch(base, { remove: ['missing'] })).toBe(base);
  });
});
