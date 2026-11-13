import { describe, expect, it } from 'vitest';
import { type Element, type Tab } from '@livehuddle/document';
import { applyEditOperations } from '../apply';
import { parseEditOperations } from '../parse';
import { checkoutFlow, fixedIds } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import type { EditOperation } from '../types';

const run = (operations: EditOperation[], tab: Tab = checkoutFlow()) =>
  applyEditOperations(tab, operations, { makeId: fixedIds() });
const set = (target: string, fields: Record<string, unknown>): EditOperation =>
  ({ op: 'set', target, fields }) as EditOperation;

describe('set', () => {
  it('changes the named fields and nothing else', () => {
    const outcome = run([set('n3', { label: 'Sign in with your email', shape: 'room-sign' })]);
    const { tab, targets, elementOps } = applied(outcome);
    expect(tab.elements.find((el) => el.id === 'n3')).toMatchObject({
      label: 'Sign in with your email',
      shape: 'room-sign',
      // The new label needs more than the 140 the box has: it grows around its centre.
      x: -36,
      y: 200,
      width: 212,
    });
    expect(targets).toEqual(['n3']);
    expect(elementOps).toHaveLength(1);
    expect(lines(outcome)).toEqual([
      '~ n3  label "Login"→"Sign in with your email" · shape signpost→room-sign · widened 140→212',
    ]);
  });

  it('refuses a value off a closed vocabulary, naming the values the field takes', () => {
    const rejection = refused(run([set('n3', { textSize: 'xl' })]));
    expect(rejection).toMatchObject({ code: 'invalid_value' });
    expect(JSON.stringify(rejection)).toContain('sm, md, lg, scale');
    expect(refused(run([set('n3', { textAlignX: 'middle' })]))).toMatchObject({
      code: 'invalid_value',
    });
    expect(lines(run([set('n3', { textAlignX: 'left' })]))).toEqual(['~ n3  textAlignX →left']);
  });

  it('unsets a field given null', () => {
    const tab = checkoutFlow();
    tab.elements[3] = { ...tab.elements[3]!, note: 'Ask for SSO' };
    const outcome = run([set('n3', { note: null })], tab);
    expect(applied(outcome).tab.elements.find((el) => el.id === 'n3')).not.toHaveProperty('note');
    expect(lines(outcome)).toEqual(['~ n3  note "Ask for SSO"→']);
  });

  it('adds a field the element did not have', () => {
    expect(lines(run([set('n3', { textBold: true })]))).toEqual(['~ n3  textBold →true']);
  });

  // docs/specs/024-agents/edit-operations.md "No element notes" (Work Tracker 737): livehuddle shows no element notes,
  // so an edit writes none; it may only remove one stored from before.
  it('refuses a note or a rich note with a value, and names the way to remove one', () => {
    for (const fields of [{ note: 'Ask for SSO' }, { noteRich: [{ text: 'Ask' }] }, { note: '' }])
      expect(refused(run([set('n3', fields)]))).toMatchObject({
        code: 'invalid_value',
        details: [expect.stringMatching(/: livehuddle keeps no element notes$/)],
        hint: expect.stringContaining('note= removes an old note'),
      });
    expect(refused(run([{ op: 'add', kind: 'signpost', fields: { note: 'x' } }]))).toMatchObject({
      code: 'invalid_value',
    });
  });

  // docs/specs/024-agents/edit-operations.md "Retired elements are left alone" (Work Tracker 639): a stored lane is a
  // retired kind. A set leaves it exactly as stored, kind and every field.
  it('refuses to change a stored lane, which keeps its kind and every field', () => {
    const tab = checkoutFlow();
    const lane = {
      id: 'l1',
      type: 'shape',
      shape: 'lane',
      x: 0,
      y: 900,
      width: 800,
      height: 200,
      headerSize: 96,
    } as unknown as Element;
    tab.elements.push(lane);
    expect(refused(run([set('l1', { label: 'Payments' })], tab))).toEqual({
      code: 'invalid_value',
      operation: 1,
      details: ['l1 is a Lane, which livehuddle no longer has: it stays as stored'],
      hint: 'move it, or remove it with rm',
    });
    expect(lane).not.toHaveProperty('label');
    // A move and an rm still take it.
    expect(lines(run([{ op: 'rm', target: 'l1' }], tab))).toEqual([
      expect.stringMatching(/^- l1 /),
    ]);
  });

  it('passes a retired element by in a set … all that matches live ones too', () => {
    const tab = checkoutFlow();
    const pie = {
      id: 'pie',
      type: 'shape',
      shape: 'pie-chart',
      x: 0,
      y: 900,
      width: 200,
      height: 200,
      textSize: 'lg',
      label: 'Login',
    } as unknown as Element;
    tab.elements.push(pie);
    const outcome = applyEditOperations(tab, [
      // Its label matches n3's, so one selector names both.
      { op: 'set', target: '"Login"', fields: { textSize: 'lg' }, all: true },
    ]);
    expect(applied(outcome).tab.elements.find((el) => el.id === 'pie')).toBe(pie);
    expect(applied(outcome).tab.elements.find((el) => el.id === 'n3')).toMatchObject({
      textSize: 'lg',
    });
    expect(
      refused(
        applyEditOperations(tab, [
          { op: 'set', target: 'pie', fields: { textSize: 'sm' }, all: true },
        ]),
      ).details,
    ).toEqual(['pie is a Pie Chart, which livehuddle no longer has: it stays as stored']);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5 (D30): nothing is coerced.
  it('refuses changing a kind to one livehuddle lacks', () => {
    for (const shape of ['lane', 'square'])
      expect(refused(run([set('n1', { shape })])).code).toBe('invalid_value');
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
        {
          id: 'a',
          type: 'shape',
          shape: 'signpost',
          x: 0,
          y: 0,
          width: 120,
          height: 60,
          label: 'a',
        },
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
      '~ t1  @190,620→@340,620 · width 160→200',
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
    expect(lines(outcome)).toEqual(['+ x  sticky "Later" @440,0 200×200']);
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
      hint: "comments go through the comment commands; assigned actions are people's",
    });
  });

  it('refuses a field the element type does not store, listing its fields', () => {
    const rejection = refused(run([set('n3', { widht: 10 })]));
    expect(rejection.code).toBe('unknown_field');
    expect(rejection.details[0]).toBe('signpost has no field "widht"');
    expect(rejection.details[1]).toMatch(/^fields: label shape fill /);
    // A note is never written, so the list offers none.
    expect(rejection.details[1]).not.toMatch(/\bnote(Rich)?\b/);
  });

  it('refuses prototype keys as unknown_field', () => {
    const fields = JSON.parse('{"__proto__": "x"}') as Extract<
      EditOperation,
      { op: 'set' }
    >['fields'];
    expect(refused(run([{ op: 'set', target: 'n3', fields }])).details[0]).toBe(
      'signpost has no field "__proto__"',
    );
  });

  it('names the nearest elements when the target matches nothing', () => {
    expect(refused(run([set('n33', { label: 'x' })]))).toMatchObject({
      code: 'target_not_found',
      details: expect.arrayContaining(['  n3  signpost "Login"']),
    });
  });
});

describe('set with aliases', () => {
  const tall = {
    id: 'wide',
    type: 'shape',
    shape: 'signpost',
    x: 0,
    y: 900,
    width: 400,
    height: 60,
    label: 'x',
  } as Element;

  it('prints a fill once under its alias, as the slot name or the hex', () => {
    const toGreen = run([set('n3', { fill: 'green' })]);
    expect(lines(toGreen)).toEqual(['~ n3  fill →green']);
    const green = applied(toGreen).tab;
    expect(lines(run([set('n3', { fill: '#ff0000' })], green))).toEqual([
      '~ n3  fill green→#ff0000',
      '! colour_overrides_theme  n3 fill #ff0000 overrides the theme; a theme colour follows a theme change',
    ]);
    expect(lines(run([set('n3', { fill: 'green', label: 'Sign in' })], green))).toEqual([
      '~ n3  label "Login"→"Sign in"',
    ]);
  });

  it('prints text under its alias', () => {
    expect(lines(run([set('n3', { text: 'lg' })]))).toEqual(['~ n3  text sm→lg']);
  });

  it('prints a box growing to fit a new shape, and logs what it did', () => {
    const calls: string[] = [];
    const long = 'Orders service which creates and tracks every order';
    const outcome = applyEditOperations(
      withTall(tall),
      [set('wide', { label: long, shape: 'plant' })],
      {
        makeId: fixedIds(),
        log: (fingerprint) => void calls.push(fingerprint),
      },
    );
    expect(lines(outcome)[0]).toBe(
      '~ wide  label "x"→"Orders service" · shape signpost→plant · textSize →md',
    );
    expect(lines(outcome)[1]).toMatch(
      /^! label_capped {2}wide label kept as "Orders service"; the rest was cut/,
    );
    expect(applied(outcome).tab.elements.find((el) => el.id === 'wide')).not.toHaveProperty('note');
    expect(calls).toEqual(['[edit-ops] label-capped', '[edit-ops] applied']);
    const directory = applyEditOperations(
      checkoutFlow(),
      [set('n6', { label: 'Payment provider callback and receipt' })],
      { makeId: fixedIds() },
    );
    expect(lines(directory)[0]).toMatch(
      /^~ n6 {2}label "3-D Secure\?"→"Payment provider callback and receipt" · widened 140→240$/,
    );
    // A label of many short lines needs more height and no more width: only the height grows.
    const stacked = applyEditOperations(
      checkoutFlow(),
      [set('n3', { label: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n') })],
      { makeId: fixedIds() },
    );
    expect(lines(stacked)[0]).toMatch(/^~ n3 {2}label "Login"→"a\\nb.*" · taller 60→\d+$/);
    // A signpost stands taller than a plant: the 60 box grows by the difference.
    const taller = applyEditOperations(checkoutFlow(), [set('n3', { shape: 'plant' })], {
      makeId: fixedIds(),
    });
    expect(lines(taller)).toEqual(['~ n3  shape signpost→plant']);
  });

  it('paints an unknown theme as the default, and logs it (E11)', () => {
    const calls: string[] = [];
    const tab = { ...checkoutFlow(), theme: 'unknown-theme' };
    applyEditOperations(tab, [set('n3', { fill: 'green' })], {
      log: (fingerprint) => void calls.push(fingerprint),
    });
    expect(calls[0]).toBe('[edit-ops] theme-fallback');
    expect(calls).toHaveLength(2);
    applyEditOperations({ ...checkoutFlow(), theme: 'brand' }, [], {
      log: (f) => void calls.push(f),
    });
    applyEditOperations({ ...checkoutFlow(), theme: 'forest' }, [], {
      log: (f) => void calls.push(f),
    });
    expect(calls.filter((f) => f === '[edit-ops] theme-fallback')).toHaveLength(1);
  });
});

function withTall(el: Element): Tab {
  const tab = checkoutFlow();
  return { ...tab, elements: [...tab.elements, el] };
}

// A stored arrow is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part
// 4): a set is refused and nothing reroutes it (Work Tracker 639).
describe('set: a stored arrow given new ends', () => {
  it('keeps its stored route as it was', () => {
    const tab = checkoutFlow();
    const bent: Tab = {
      ...tab,
      elements: tab.elements.map((el) =>
        el.id === 'a1' ? ({ ...el, curvePoints: [{ dx: 40, dy: 0 }] } as unknown as Element) : el,
      ),
    };
    const from = { kind: 'pinned', elementId: 'n1', anchor: 'e' };
    expect(refused(run([set('a1', { from })], bent)).details).toEqual([
      'a1 is an Arrow, which livehuddle no longer has: it stays as stored',
    ]);
  });
});

describe('set: a label over lines', () => {
  it('keeps the line break written with \\n', () => {
    const parsed = parseEditOperations('set n3 label="App tasks\\nECS Fargate"');
    if ('errors' in parsed) throw new Error('parse');
    const n3 = applied(run(parsed.operations)).tab.elements.find(
      (e) => e.id === 'n3',
    ) as Element & {
      label?: string;
    };
    expect(n3.label).toBe('App tasks\nECS Fargate');
  });
});
