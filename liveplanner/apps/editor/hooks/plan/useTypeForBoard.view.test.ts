import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/project';
import { newTypeForBoard, withTypeOnView } from './useTypeForBoard';

// docs/specs/026-plan/plan-views.md "Gantt Chart": Add New Card Type from a Gantt chart.
describe('a new card type made from a Gantt chart', () => {
  it('starts with Start and Due beside the new type’s own fields, every status on', () => {
    const t = newTypeForBoard({ viewId: 'g', fields: ['start', 'due'] });
    expect(t.fields).toEqual(expect.arrayContaining(['title', 'start', 'due']));
    expect(t.statuses).toBeUndefined();
  });

  it('joins a chart naming its own types, and leaves one drawing every type alone', () => {
    const named = {
      id: 'g',
      type: 'shape',
      shape: 'plan-view',
      planView: { view: 'gantt', types: ['project'] },
    };
    const all = { id: 'h', type: 'shape', shape: 'plan-view', planView: { view: 'gantt' } };
    const els = [named, all] as unknown as Element[];
    const out = withTypeOnView(els, 'g', 'launch');
    expect((out[0] as unknown as typeof named).planView.types).toEqual(['project', 'launch']);
    expect(withTypeOnView(els, 'h', 'launch')).toBe(els);
  });
});
