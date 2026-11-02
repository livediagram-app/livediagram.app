import { describe, expect, it } from 'vitest';
import type { DesignComponent, Element, Tab } from '@livedesign/design';
import { applied, lines, refused } from '../fixtures/outcomes';
import { elementOf, run } from '../fixtures/run';
import { formatOperation } from '../format-operation';
import { operationsNeedComponents } from '../instances';
import { parseEditOperations } from '../parse';

const nav: DesignComponent = {
  id: 'nav',
  name: 'Nav bar',
  width: 200,
  height: 40,
  updatedAt: 1,
  elements: [
    { id: 'bar', type: 'shape', shape: 'square', x: 0, y: 0, width: 200, height: 40 },
    { id: 'brand', type: 'text', x: 10, y: 10, width: 60, height: 20, label: 'Acme' },
  ],
};
const components = [nav];

const instance = (extra: Record<string, unknown> = {}): Element => ({
  id: 'top',
  type: 'shape',
  shape: 'instance',
  componentId: 'nav',
  x: 100,
  y: 100,
  width: 400,
  height: 80,
  ...extra,
});
const box = (id: string, x: number): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 100,
  width: 60,
  height: 40,
  label: 'Box',
});
const tabOf = (elements: Element[]): Tab => ({ id: 't', name: 'T', elements });

describe('detach', () => {
  it('replaces the instance, in its place, with its main as it draws there, fresh slug ids', () => {
    const tab = tabOf([
      box('under', 0),
      instance({ componentOverrides: { brand: { label: 'Shop' } } }),
      box('over', 600),
    ]);
    const outcome = run('detach top', tab, { components });
    const next = applied(outcome).tab;
    expect(next.elements.map((e) => e.id)).toEqual(['under', 'square', 'shop', 'over']);
    // Twice the main's size, at the instance's place, the override applied.
    expect(elementOf(next, 'square')).toMatchObject({ x: 100, y: 100, width: 400, height: 80 });
    expect(elementOf(next, 'shop')).toMatchObject({ label: 'Shop', x: 120, y: 120 });
    expect(lines(outcome)).toEqual([
      '+ square  square @100,0 400×80',
      '+ shop  text "Shop" @120,20 120×40',
      '- top  instance',
    ]);
    expect(applied(outcome).createdIds).toEqual(['square', 'shop']);
  });

  it('frees the ends of arrows pinned to the instance where they were drawn', () => {
    const tab = tabOf([
      instance(),
      box('b', 700),
      {
        id: 'a1',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'top', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
      },
    ]);
    const outcome = run('detach top', tab, { components });
    const arrow = elementOf(applied(outcome).tab, 'a1');
    expect(arrow).toMatchObject({ from: { kind: 'free' }, to: { kind: 'pinned', elementId: 'b' } });
    expect(applied(outcome).warnings).toEqual([
      expect.objectContaining({ code: 'arrows_freed', ref: 'a1' }),
    ]);
  });

  it('refuses what is not an instance, a missing main, and a lock', () => {
    const tab = tabOf([instance(), box('b', 700)]);
    expect(refused(run('detach b', tab, { components }))).toMatchObject({
      code: 'invalid_value',
      details: ['b: b is not a component instance'],
    });
    expect(refused(run('detach top', tab, { components: [] }))).toMatchObject({
      code: 'invalid_value',
      details: ['top: its main nav is not in the design'],
    });
    expect(refused(run('detach top', tab)).code).toBe('invalid_value');
    expect(refused(run('detach nowhere', tab, { components })).code).toBe('target_not_found');
    expect(
      refused(run('detach top', tabOf([instance({ locked: true })]), { components })).code,
    ).toBe('element_locked');
    const lockedArrow = tabOf([
      instance(),
      box('b', 700),
      {
        id: 'a1',
        type: 'arrow',
        locked: true,
        from: { kind: 'pinned', elementId: 'b', anchor: 'w' },
        to: { kind: 'on-arrow', arrowId: 'top', t: 0.5 },
      } as unknown as Element,
    ]);
    expect(refused(run('detach top', lockedArrow, { components })).code).toBe('element_locked');
  });

  it('reads and writes back in both forms', () => {
    const parsed = parseEditOperations('detach top');
    expect(parsed).toEqual({ operations: [{ op: 'detach', target: 'top' }] });
    expect(formatOperation({ op: 'detach', target: 'top' })).toBe('detach top');
    expect(parseEditOperations('{"op":"detach","target":"top"}')).toEqual(parsed);
    expect(parseEditOperations('{"op":"detach"}')).toHaveProperty('errors');
  });
});

describe('operationsNeedComponents', () => {
  it('is true only for a detach or an instance added', () => {
    const ops = (text: string) => {
      const parsed = parseEditOperations(text);
      if ('errors' in parsed) throw new Error('unparsed');
      return parsed.operations;
    };
    expect(operationsNeedComponents(ops('detach top'))).toBe(true);
    expect(operationsNeedComponents(ops('add instance componentId=nav'))).toBe(true);
    expect(
      operationsNeedComponents([
        { op: 'add', element: { id: 'x', type: 'shape', shape: 'instance' } },
      ]),
    ).toBe(true);
    expect(
      operationsNeedComponents([
        { op: 'add', element: { id: 'x', type: 'shape', shape: 'square' } },
      ]),
    ).toBe(false);
    expect(operationsNeedComponents(ops('add square label=A\nset n1 label=B'))).toBe(false);
  });
});

describe('placing an instance', () => {
  const empty = tabOf([box('b', 0)]);

  it('takes the main’s frame when no size is given, and keeps a size that is', () => {
    const made = applied(
      run('add instance id=hdr componentId=nav at:0,300', empty, { components }),
    );
    expect(elementOf(made.tab, 'hdr')).toMatchObject({
      width: 200,
      height: 40,
      componentId: 'nav',
    });
    const sized = applied(
      run('add instance id=hdr componentId=nav width=400 at:0,300', empty, { components }),
    );
    expect(elementOf(sized.tab, 'hdr')).toMatchObject({ width: 400, height: 40 });
    const tall = applied(
      run('add instance id=hdr componentId=nav height=80', empty, { components }),
    );
    expect(elementOf(tall.tab, 'hdr')).toMatchObject({ width: 200, height: 80 });
  });

  it('refuses an instance without a main, or naming one the design does not hold', () => {
    expect(refused(run('add instance id=hdr', empty, { components }))).toMatchObject({
      code: 'invalid_value',
      details: ['componentId=null: an instance names its main'],
    });
    expect(refused(run('add instance componentId=gone', empty, { components }))).toMatchObject({
      details: ['componentId="gone": is not a main of this design'],
      hint: 'mains: nav "Nav bar"',
    });
    expect(refused(run('add instance componentId=gone', empty, { components: [] })).hint).toBe(
      'the design has no components yet',
    );
    const many = Array.from({ length: 12 }, (_, i) => ({ ...nav, id: `m${i}`, name: `M${i}` }));
    expect(refused(run('add instance componentId=gone', empty, { components: many })).hint).toMatch(
      / and 2 more$/,
    );
  });

  it('without a library, keeps the factory box and names no main', () => {
    const made = applied(run('add instance id=hdr componentId=nav', empty));
    expect(elementOf(made.tab, 'hdr')).toMatchObject({ width: 320, height: 80 });
  });

  it('a whole raw element takes the frame too, and is checked alike', () => {
    const raw = {
      op: 'add',
      element: { id: 'hdr', type: 'shape', shape: 'instance', componentId: 'nav', x: 0, y: 300 },
    };
    const made = applied(run(JSON.stringify(raw), empty, { components }));
    expect(elementOf(made.tab, 'hdr')).toMatchObject({ width: 200, height: 40 });
    const gone = {
      ...raw,
      element: { ...raw.element, componentId: 'gone', width: 10, height: 10 },
    };
    expect(refused(run(JSON.stringify(gone), empty, { components })).code).toBe('invalid_value');
  });

  it('changes overrides as an ordinary field, and refuses an edit session’s marks', () => {
    const tab = tabOf([instance()]);
    const set = applied(
      run('set top componentOverrides={"brand":{"label":"Shop"}}', tab, { components }),
    );
    expect(elementOf(set.tab, 'top')).toMatchObject({
      componentOverrides: { brand: { label: 'Shop' } },
    });
    const cleared = applied(
      run(
        'set top componentOverrides=',
        tabOf([instance({ componentOverrides: { brand: { label: 'x' } } })]),
      ),
    );
    expect(elementOf(cleared.tab, 'top')).not.toHaveProperty('componentOverrides');
    expect(refused(run('set top componentEditBy=me', tab))).toMatchObject({
      code: 'invalid_value',
      details: ['componentEditBy="me": an edit session is a person\'s'],
    });
  });
});
