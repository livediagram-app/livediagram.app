import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { applyEditOperations } from '../apply';
import { fixedIds, newView, sprintDashboard } from '../fixtures/sprint-dashboard';
import { applied, lines, refused } from '../fixtures/outcomes';
import type { EditOperation } from '../types';

const gantt = newView('g1', 'gantt');
const { id: _id, ...unnamed } = gantt;
const run = (operations: EditOperation[], tab: Tab = sprintDashboard()) =>
  applyEditOperations(tab, operations, { makeId: fixedIds() });

describe('add with an element', () => {
  it('takes the element as given, geometry kept, appended last', () => {
    const outcome = run([{ op: 'add', element: gantt }]);
    const { tab, createdIds, targets } = applied(outcome);
    expect(tab.elements.at(-1)).toMatchObject({ id: 'g1', x: 0, y: 840, width: 500 });
    expect(createdIds).toEqual(['g1']);
    expect(targets).toEqual([]);
    expect(lines(outcome)).toEqual(['+ g1  plan-view @0,840 500×360']);
  });

  it('mints an id with makeId when the element has none', () => {
    const { createdIds } = applied(run([{ op: 'add', element: unnamed }]));
    expect(createdIds).toEqual(['id-1']);
  });

  it('takes a chart of a Sheet', () => {
    const chart = {
      id: 'p1',
      type: 'shape',
      shape: 'pie-chart',
      x: 520,
      y: 520,
      width: 300,
      height: 300,
      chartSource: {
        sheetId: 'sheet-1',
        range: { r1: 'row1', c1: 'col1', r2: 'row4', c2: 'col2' },
      },
    };
    expect(lines(run([{ op: 'add', element: chart }]))).toEqual([
      '+ p1  pie-chart @520,520 300×300',
    ]);
  });

  it('refuses an element no liveplanner tab holds, naming the kinds there are', () => {
    for (const element of [
      { id: 's', type: 'sticky', x: 0, y: 0, width: 200, height: 200 },
      { id: 'q', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 60 },
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 9, y: 9 },
      },
    ]) {
      const rejection = refused(run([{ op: 'add', element }]));
      expect(rejection.code).toBe('invalid_value');
      expect(rejection.details[0]).toMatch(/is not an element a liveplanner tab holds$/);
      expect(rejection.hint).toContain('plan-board | plan-sheet | plan-view');
    }
  });

  it('refuses a chart that reads no Sheet', () => {
    const chart = {
      id: 'b2',
      type: 'shape',
      shape: 'bar-chart',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
    };
    expect(refused(run([{ op: 'add', element: chart }])).details).toEqual([
      'a bar-chart reads a Sheet\'s cells: it needs "chartSource" { "sheetId", "range" }',
    ]);
  });

  it('refuses an id the tab holds as id_taken, suggesting a free one', () => {
    const rejection = refused(run([{ op: 'add', element: { ...gantt, id: 'w1' } }]));
    expect(rejection).toMatchObject({
      code: 'id_taken',
      operation: 1,
      details: ['id "w1" is taken by plan-view "Workload"'],
      hint: 'use id w1-2',
    });
  });

  it('keeps the id of an element removed earlier in the changeset taken', () => {
    const rejection = refused(
      run([
        { op: 'rm', target: 'w1' },
        { op: 'add', element: { ...gantt, id: 'w1' } },
      ]),
    );
    expect(rejection).toMatchObject({ code: 'id_taken', operation: 2 });
  });

  it('refuses a prototype key as unknown_field', () => {
    // JSON.parse makes `__proto__` an own key, which an object literal cannot.
    const element = JSON.parse(
      '{"__proto__": {"x": 1}, "id": "p", "type": "shape", "shape": "plan-view"}',
    ) as Record<string, unknown>;
    expect(refused(run([{ op: 'add', element }]))).toMatchObject({
      code: 'unknown_field',
      details: ['plan-view has no field "__proto__"', expect.stringContaining('fields: x y')],
    });
  });

  it('names an element with no shape plainly when it carries a prototype key, offering only the common fields', () => {
    const element = JSON.parse('{"constructor": 1, "type": "sticky"}') as Record<string, unknown>;
    const rejection = refused(run([{ op: 'add', element }]));
    expect(rejection).toMatchObject({ code: 'unknown_field' });
    expect(rejection.details[0]).toBe('element has no field "constructor"');
    expect(rejection.details[1]).not.toContain('planView');
  });

  it('refuses an element on a locked layer', () => {
    const tab: Tab = {
      ...sprintDashboard(),
      layers: [
        { id: 'base', name: 'Base', locked: true },
        { id: 'top', name: 'Top' },
      ],
    };
    expect(
      refused(run([{ op: 'add', element: { ...unnamed, layerId: 'base' } }], tab)),
    ).toMatchObject({
      code: 'element_locked',
      details: ['locked:', '  id-1  plan-view (layer "Base")'],
    });
  });

  it('leaves no trace of an element added and removed again (E2)', () => {
    const outcome = run([
      { op: 'add', element: gantt },
      { op: 'rm', target: 'g1' },
    ]);
    const { elementOps, createdIds, results } = applied(outcome);
    expect(elementOps).toEqual([]);
    expect(createdIds).toEqual([]);
    expect(results).toEqual([]);
  });

  it('adds an id again after removing it, once', () => {
    const { tab, createdIds } = applied(
      run([
        { op: 'add', element: gantt },
        { op: 'rm', target: 'g1' },
        { op: 'add', element: { ...gantt, label: 'Again' } },
      ]),
    );
    expect(tab.elements.filter((el) => el.id === 'g1')).toEqual([
      expect.objectContaining({ label: 'Again' }),
    ]);
    expect(createdIds).toEqual(['g1']);
  });

  it('refuses an element the tab could not hold, naming the field', () => {
    const rejection = refused(
      run([{ op: 'add', element: { id: 'bad', type: 'shape', shape: 'plan-view', x: 0 } }]),
    );
    expect(rejection).toMatchObject({
      code: 'invalid_result',
      hint: 'see the format: liveplanner schema plan-view',
    });
    expect(rejection.details[0]).toMatch(/^bad /);
  });
});
