import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { applyEditOperations } from '../apply';
import { checkoutFlow, fixedIds } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import type { EditOperation } from '../types';

const sticky = { type: 'sticky', label: 'Idea', x: 400, y: 0, width: 200, height: 200 };
const run = (operations: EditOperation[], tab: Tab = checkoutFlow()) =>
  applyEditOperations(tab, operations, { makeId: fixedIds() });

describe('add with an element', () => {
  it('takes the element as given, geometry kept, appended last', () => {
    const outcome = run([{ op: 'add', element: { id: 'idea', ...sticky } }]);
    const { tab, createdIds, targets } = applied(outcome);
    expect(tab.elements.at(-1)).toMatchObject({ id: 'idea', x: 400, y: 0, width: 200 });
    expect(createdIds).toEqual(['idea']);
    expect(targets).toEqual([]);
    expect(lines(outcome)).toEqual(['+ idea  sticky "Idea" @400,0 200×200']);
  });

  it('mints an id with makeId when the element has none', () => {
    const { createdIds } = applied(run([{ op: 'add', element: sticky }]));
    expect(createdIds).toEqual(['id-1']);
  });

  it('refuses an id the tab holds as id_taken, suggesting a free one', () => {
    const rejection = refused(run([{ op: 'add', element: { id: 'n3', ...sticky } }]));
    expect(rejection).toMatchObject({
      code: 'id_taken',
      operation: 1,
      details: ['id "n3" is taken by square "Login"'],
      hint: 'use id n3-2',
    });
  });

  it('keeps the id of an element removed earlier in the changeset taken', () => {
    const rejection = refused(
      run([
        { op: 'rm', target: 'n3' },
        { op: 'add', element: { id: 'n3', ...sticky } },
      ]),
    );
    expect(rejection).toMatchObject({ code: 'id_taken', operation: 2 });
  });

  it('refuses a prototype key as unknown_field', () => {
    const element = JSON.parse('{"__proto__": {"x": 1}, "id": "p", "type": "sticky"}');
    expect(refused(run([{ op: 'add', element }]))).toMatchObject({
      code: 'unknown_field',
      details: ['sticky has no field "__proto__"', expect.stringContaining('fields: id type')],
    });
    const untyped = JSON.parse('{"constructor": 1}');
    expect(refused(run([{ op: 'add', element: untyped }])).details[0]).toBe(
      'element has no field "constructor"',
    );
  });

  it('refuses an element on a locked layer', () => {
    const tab: Tab = {
      ...checkoutFlow(),
      layers: [
        { id: 'base', name: 'Base', locked: true },
        { id: 'top', name: 'Top' },
      ],
    };
    expect(
      refused(run([{ op: 'add', element: { ...sticky, layerId: 'base' } }], tab)),
    ).toMatchObject({
      code: 'element_locked',
      details: ['locked:', '  id-1  sticky "Idea" (layer "Base")'],
    });
  });

  it('leaves no trace of an element added and removed again (E2)', () => {
    const outcome = run([
      { op: 'add', element: { id: 'idea', ...sticky } },
      { op: 'rm', target: 'idea' },
    ]);
    const { elementOps, createdIds, results } = applied(outcome);
    expect(elementOps).toEqual([]);
    expect(createdIds).toEqual([]);
    expect(results).toEqual([]);
  });

  it('adds an id again after removing it, once', () => {
    const { tab, createdIds } = applied(
      run([
        { op: 'add', element: { id: 'idea', ...sticky } },
        { op: 'rm', target: 'idea' },
        { op: 'add', element: { id: 'idea', ...sticky, label: 'Again' } },
      ]),
    );
    expect(tab.elements.filter((el) => el.id === 'idea')).toEqual([
      expect.objectContaining({ label: 'Again' }),
    ]);
    expect(createdIds).toEqual(['idea']);
  });

  it('refuses an element the tab could not hold, naming the field', () => {
    const rejection = refused(run([{ op: 'add', element: { id: 'bad', type: 'sticky', x: 0 } }]));
    expect(rejection).toEqual({
      code: 'invalid_result',
      details: ['bad y: a finite number'],
      hint: 'see the format: livediagram schema sticky',
    });
  });
});
