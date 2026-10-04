import { describe, expect, it } from 'vitest';
import { encodeStrokePoints, type Tab } from '@livediagram/document';
import { applyEditOperations } from '../apply';
import { checkoutFlow, fixedIds } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import type { EditOperation } from '../types';

const run = (operations: EditOperation[], tab: Tab = checkoutFlow()) =>
  applyEditOperations(tab, operations, { makeId: fixedIds() });
const set = (target: string, fields: Record<string, unknown>): EditOperation =>
  ({ op: 'set', target, fields }) as EditOperation;

describe('set', () => {
  it('changes the named fields and nothing else', () => {
    const outcome = run([set('n3', { label: 'Sign in', shape: 'stadium' })]);
    const { tab, targets, elementOps } = applied(outcome);
    expect(tab.elements.find((el) => el.id === 'n3')).toMatchObject({
      label: 'Sign in',
      shape: 'stadium',
      x: 0,
      y: 200,
    });
    expect(targets).toEqual(['n3']);
    expect(elementOps).toHaveLength(1);
    expect(lines(outcome)).toEqual(['~ n3  label "Login"→"Sign in" · shape square→stadium']);
  });

  it('unsets a field given null', () => {
    const tab = checkoutFlow();
    tab.elements[3] = { ...tab.elements[3]!, note: 'Ask for SSO' } as (typeof tab.elements)[number];
    const outcome = run([set('n3', { note: null })], tab);
    expect(applied(outcome).tab.elements.find((el) => el.id === 'n3')).not.toHaveProperty('note');
    expect(lines(outcome)).toEqual(['~ n3  note "Ask for SSO"→']);
  });

  it('adds a field the element did not have', () => {
    expect(lines(run([set('n3', { note: 'Ask for SSO' })]))).toEqual(['~ n3  note →"Ask for SSO"']);
  });

  it('prints the fields it wrote first, then what normalising added', () => {
    const tab = checkoutFlow();
    tab.elements.push({
      id: 'lane',
      type: 'shape',
      shape: 'lane',
      x: 0,
      y: 900,
      width: 800,
      height: 200,
    });
    const [line] = lines(run([set('lane', { label: 'Payments' })], tab));
    expect(line).toMatch(/^~ lane {2}label →"Payments" · textSize →\w+ · textAlignX →\w+/);
  });

  it('prints nothing for a value the element already holds (E1)', () => {
    const { results, elementOps } = applied(run([set('n3', { label: 'Login' })]));
    expect(results).toEqual([]);
    expect(elementOps).toEqual([]);
  });

  it('leaves an element it does not change unnormalised, so it never changes (E1, I2)', () => {
    const bare: Tab = {
      id: 't',
      name: 'T',
      elements: [
        { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60, label: 'a' },
      ],
    };
    const { results, elementOps } = applied(run([set('a', { label: 'a' })], bare));
    expect(results).toEqual([]);
    expect(elementOps).toEqual([]);
  });

  it('prints nothing for an element changed and changed back in one changeset (E1, I2)', () => {
    const start = checkoutFlow();
    const { results, elementOps, tab } = applied(
      run([set('n3', { label: 'Sign in' }), set('n3', { label: 'Login' })], start),
    );
    expect(results).toEqual([]);
    expect(elementOps).toEqual([]);
    // The very element it began as, so nothing downstream sees a change.
    expect(tab.elements.find((e) => e.id === 'n3')).toBe(start.elements.find((e) => e.id === 'n3'));
  });

  it('writes named geometry as stored coordinates', () => {
    expect(lines(run([set('t1', { x: 300, width: 200 })]))).toEqual([
      '~ t1  @150,620→@300,620 · width 160→200',
    ]);
  });

  it('accepts all with an exact id', () => {
    expect(
      applied(run([{ op: 'set', target: 'n2', fields: { label: 'Basket' }, all: true }])).targets,
    ).toEqual(['n2']);
  });

  it('changes an element the changeset added, which stays a + line', () => {
    const outcome = run([
      { op: 'add', element: { id: 'x', type: 'sticky', x: 400, y: 0, width: 200, height: 200 } },
      set('x', { label: 'Later' }),
    ]);
    expect(lines(outcome)).toEqual(['+ x  sticky "Later" @400,0 200×200']);
    expect(applied(outcome).targets).toEqual([]);
  });

  it('refuses id and type as invalid_value', () => {
    expect(refused(run([set('n3', { id: 'n9' })]))).toEqual({
      code: 'invalid_value',
      operation: 1,
      details: ['id="n9": cannot be changed'],
    });
    expect(refused(run([set('n3', { type: 'text' })])).details).toEqual([
      'type="text": cannot be changed',
    ]);
  });

  it('refuses live fields with the way to change them', () => {
    expect(refused(run([set('n3', { commentThread: [] })]))).toEqual({
      code: 'invalid_value',
      operation: 1,
      details: ['commentThread=[]: people change it, not edit operations'],
      hint: "comments go through the comment commands; responses and ideas are people's",
    });
  });

  it('refuses a field the element type does not store, listing its fields', () => {
    const rejection = refused(run([set('a1', { widht: 10 })]));
    expect(rejection.code).toBe('unknown_field');
    expect(rejection.details[0]).toBe('arrow has no field "widht"');
    expect(rejection.details[1]).toMatch(/^fields: id type layerId from to /);
  });

  it('refuses prototype keys as unknown_field', () => {
    const fields = JSON.parse('{"__proto__": "x"}');
    expect(refused(run([{ op: 'set', target: 'n3', fields }])).details[0]).toBe(
      'square has no field "__proto__"',
    );
  });

  it('takes a stroke in its former points, packed as the MCP packs them', () => {
    const tab = checkoutFlow();
    tab.elements.push({
      id: 's1',
      type: 'freehand',
      closed: false,
      packedPoints: encodeStrokePoints([{ nx: 0, ny: 0 }]),
      x: 400,
      y: 0,
      width: 100,
      height: 100,
    });
    const points = [
      { nx: 0, ny: 0 },
      { nx: 1, ny: 1 },
    ];
    const stroke = applied(run([set('s1', { points })], tab)).tab.elements.find(
      (el) => el.id === 's1',
    )!;
    expect(stroke).not.toHaveProperty('points');
    expect(stroke).toHaveProperty('packedPoints');
  });

  it('names the nearest elements when the target matches nothing', () => {
    expect(refused(run([set('n33', { label: 'x' })]))).toMatchObject({
      code: 'target_not_found',
      details: expect.arrayContaining(['  n3  square "Login"']),
    });
  });

  it('refuses moving an element onto a locked layer', () => {
    const tab: Tab = {
      ...checkoutFlow(),
      layers: [
        { id: 'top', name: 'Top' },
        { id: 'base', name: 'Base', locked: true },
      ],
    };
    expect(refused(run([set('n3', { layerId: 'base' })], tab))).toMatchObject({
      code: 'element_locked',
      details: ['locked:', '  n3  square "Login" (layer "Base")'],
    });
  });
});
