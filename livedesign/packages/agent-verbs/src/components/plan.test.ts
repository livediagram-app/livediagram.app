import { describe, expect, it } from 'vitest';
import type { DesignComponent, Element } from '@livedesign/design';
import { applyEditOperations, validateEditOperations } from '@livedesign/edit-operations';
import { box, plainTab } from '../testing/tabs';
import { elementChangeOperations, planMakeComponent, safeRef } from './plan';

const arrow = (id: string, from: string, to: string): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 'e' },
  to: { kind: 'pinned', elementId: to, anchor: 'w' },
});

const nav: DesignComponent = {
  id: 'nav',
  name: 'Nav bar',
  width: 120,
  height: 60,
  updatedAt: 1,
  elements: [box('bar', 'Bar')],
};

// The operations applied to the tab as read: what the editor's Make Component left.
function applied(tab: ReturnType<typeof plainTab>, operations: Record<string, unknown>[]) {
  const parsed = validateEditOperations(operations);
  if ('errors' in parsed) throw new Error(JSON.stringify(parsed.errors));
  const outcome = applyEditOperations(tab, parsed.operations);
  if (!('tab' in outcome)) throw new Error(JSON.stringify(outcome));
  return outcome.tab.elements;
}

describe('elementChangeOperations', () => {
  it('adds in place, sets what changed, and removes arrows before the rest', () => {
    const a = box('a', 'A');
    const before = [a, box('b', 'B'), arrow('ab', 'a', 'b'), box('c', 'C')];
    const after: Element[] = [
      { ...a },
      box('n1', 'New'),
      { ...box('b', 'B'), label: 'Bee' },
      { id: 'c', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60 },
      box('n2', 'Last'),
    ];
    const ops = elementChangeOperations(before, after);
    expect(ops).toEqual([
      { op: 'add', element: after[1] },
      { op: 'order', target: safeRef('n1'), below: safeRef('b') },
      { op: 'add', element: after[4] },
      { op: 'set', target: safeRef('b'), fields: { label: 'Bee' } },
      { op: 'set', target: safeRef('c'), fields: { label: null } },
      { op: 'rm', target: safeRef('ab') },
    ]);
    expect(safeRef('n1')).toBe('id:"n1"');
  });

  it('removes the elements that are gone with their arrows kept', () => {
    expect(elementChangeOperations([box('a', 'A')], [])).toEqual([
      { op: 'rm', target: 'id:"a"', keepArrows: true },
    ]);
  });
});

describe('planMakeComponent', () => {
  const tab = {
    ...plainTab([
      box('a', 'A', 0),
      box('b', 'B', 200),
      arrow('ab', 'a', 'b'),
      box('c', 'C', 400),
      arrow('bc', 'b', 'c'),
    ]),
    rev: 7,
  };

  it('makes the main and the changeset that puts one instance in its place', () => {
    const plan = planMakeComponent(tab, ['a', 'b', 'ab'], [], { name: '  Nav   bar ', now: 9 });
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.component).toMatchObject({
      id: 'nav-bar',
      name: 'Nav bar',
      width: 320,
      height: 60,
      updatedAt: 9,
    });
    expect(plan.component.elements.map((e) => e.id)).toEqual(['a', 'b', 'ab']);
    expect(plan.instanceId).toBe('nav-bar');
    expect(plan.base.rev).toBe(7);
    expect(Object.keys(plan.base.elements).sort()).toEqual(['a', 'ab', 'b', 'bc']);
    const after = applied(tab, plan.operations);
    expect(after.map((e) => e.id)).toEqual(['nav-bar', 'c', 'bc']);
    expect(after[0]).toMatchObject({ shape: 'instance', componentId: 'nav-bar', x: 0, width: 320 });
    expect(after[2]).toMatchObject({ from: { kind: 'pinned', elementId: 'nav-bar' } });
  });

  it('names it Component <n> when no name is given, unique in the library', () => {
    const plan = planMakeComponent(tab, ['c'], [nav], { now: 1 });
    expect(plan).toMatchObject({ ok: true, component: { name: 'Component 2', id: 'component-2' } });
  });

  it('detaches an instance among the elements into the main, with ids of its own', () => {
    const withInstance = {
      ...plainTab([
        box('a', 'A'),
        {
          id: 'i1',
          type: 'shape',
          shape: 'instance',
          componentId: 'nav',
          x: 200,
          y: 0,
          width: 120,
          height: 60,
        },
      ]),
      rev: 1,
    };
    const plan = planMakeComponent(withInstance, ['a', 'i1'], [nav], { name: 'Pair', now: 1 });
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.component.elements.map((e) => e.id)).toEqual(['a', 'element']);
    expect(applied(withInstance, plan.operations).map((e) => e.id)).toEqual(['pair']);
  });

  it('refuses a ref that names nothing or several, and what Make Component refuses', () => {
    const many = {
      ...plainTab([
        box('node-1', 'A'),
        box('node-2', 'B', 200),
        { ...box('l', 'L'), locked: true },
      ]),
      rev: 1,
    };
    expect(planMakeComponent(many, ['zzz'], [], { now: 1 })).toMatchObject({
      ok: false,
      code: 'target_not_found',
      message: '"zzz" names no element',
    });
    expect(planMakeComponent(many, ['node'], [], { now: 1 })).toMatchObject({
      code: 'target_ambiguous',
      message: expect.stringMatching(/^"node" matches several elements: /),
    });
    expect(planMakeComponent(many, ['node-3'], [], { now: 1 })).toMatchObject({
      code: 'target_not_found',
      message: expect.stringMatching(/^"node-3" names no element: /),
    });
    expect(planMakeComponent(many, ['l'], [], { now: 1 })).toMatchObject({
      code: 'locked',
      message: 'a locked element cannot go in a component; unlock it first',
    });
  });
});
