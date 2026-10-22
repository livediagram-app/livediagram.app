import { describe, expect, it } from 'vitest';
import { applied, lines, refused } from '../fixtures/outcomes';
import { lockedDashboard, run } from '../fixtures/run';

describe('set', () => {
  it('changes the named fields and nothing else', () => {
    const outcome = run('set w1 planView={"view":"priority-matrix"} label=Priorities');
    const { tab, targets, elementOps } = applied(outcome);
    expect(tab.elements.find((el) => el.id === 'w1')).toMatchObject({
      planView: { view: 'priority-matrix' },
      label: 'Priorities',
      x: 0,
      y: 140,
      width: 500,
    });
    expect(targets).toEqual(['w1']);
    expect(elementOps).toHaveLength(1);
    expect(lines(outcome)).toEqual(['~ w1  planView (changed) · label "Workload"→"Priorities"']);
  });

  it('moves and resizes by the stored geometry', () => {
    expect(lines(run('set w1 x=20 y=160 width=480'))).toEqual([
      '~ w1  @0,140→@20,160 · width 500→480',
    ]);
  });

  it("changes a chart's look and the cells it reads", () => {
    expect(lines(run('set b1 chartVariant=horizontal chartAxis=true'))).toEqual([
      '~ b1  chartVariant →horizontal · chartAxis →true',
    ]);
  });

  it('refuses a value off a closed vocabulary, naming the values the field takes', () => {
    const rejection = refused(run('set w1 textSize=xl'));
    expect(rejection).toMatchObject({ code: 'invalid_value' });
    expect(JSON.stringify(rejection)).toContain('sm, md, lg');
  });

  it("refuses a field the element does not take, listing only a Plan element's fields", () => {
    expect(refused(run('set w1 fillColor=#ff0000'))).toEqual({
      code: 'unknown_field',
      operation: 1,
      details: [
        'plan-view has no field "fillColor"',
        'fields: x y width height label locked planView textSize',
      ],
    });
    expect(refused(run('set w1 planVeiw={"view":"gantt"}')).hint).toBe('did you mean planView?');
  });

  it('refuses identity and live fields', () => {
    expect(refused(run('set w1 shape=plan-board')).details).toEqual([
      'shape="plan-board": cannot be changed',
    ]);
    expect(refused(run('set w1 commentThread=[]')).hint).toContain('comment commands');
  });

  it('unsets a field given nothing', () => {
    const outcome = run('set w1 label=');
    expect(applied(outcome).tab.elements.find((el) => el.id === 'w1')).not.toHaveProperty('label');
    expect(lines(outcome)).toEqual(['~ w1  label "Workload"→']);
  });

  it('prints nothing for a value the element already holds (E1)', () => {
    const { results, elementOps } = applied(run('set w1 label=Workload'));
    expect(results).toEqual([]);
    expect(elementOps).toEqual([]);
  });

  it('sets several with all', () => {
    expect(lines(run('set type:plan-view label~o textSize=lg all'))).toEqual([
      '~ m2  textSize md→lg',
      '~ w1  textSize md→lg',
    ]);
  });

  it('refuses a locked element', () => {
    expect(refused(run('set w1 label=x', lockedDashboard('w1'))).code).toBe('element_locked');
  });
});
