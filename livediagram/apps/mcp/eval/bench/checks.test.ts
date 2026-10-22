import { describe, expect, it } from 'vitest';
import {
  allLinked,
  below,
  elementsFor,
  errorCells,
  flows,
  header,
  inside,
  linked,
  mentionsAll,
  runChecks,
  sketched,
} from './checks.mjs';
import { parseTabHeader } from './snapshot.mjs';

const box = (id: string, label: string, x = 0, y = 0) => ({
  id,
  type: 'shape',
  shape: 'square',
  label,
  x,
  y,
  width: 100,
  height: 40,
});
const arrow = (from: string, to: string) => ({
  id: `${from}-${to}`,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from },
  to: { kind: 'pinned', elementId: to },
});

const diagram = {
  documents: [
    {
      id: 'd1',
      name: 'Flow',
      tabs: [
        {
          id: 't1',
          name: 'Tab',
          outline: 'tab t1 "Tab" · 4 elements · finish=sketch · rev 1',
          elements: [
            {
              id: 'g',
              type: 'shape',
              shape: 'frame',
              label: 'Notifications',
              x: 0,
              y: 200,
              width: 400,
              height: 200,
            },
            box('a', 'Cart'),
            box('b', 'Pay'),
            box('c', 'Email receipt', 20, 220),
            arrow('a', 'b'),
            arrow('b', 'c'),
          ],
        },
      ],
      items: null,
      sheets: [
        {
          title: 'S',
          read: {
            cells: [
              { at: 'A1', input: 'Rep', value: 'Rep' },
              { at: 'A2', input: 'Ana', value: 'Ana' },
              { at: 'A3', input: 'Raj', value: 'Raj' },
              { at: 'B1', input: '=1/0', value: '#DIV/0!' },
            ],
          },
        },
      ],
    },
  ],
};

describe('diagram readers', () => {
  it('finds arrows either way round, or only forwards with flows', () => {
    expect(linked(diagram, /pay/i, /cart/i)).toBe(true);
    expect(flows(diagram, /pay/i, /cart/i)).toBe(false);
    expect(flows(diagram, /cart/i, /pay/i)).toBe(true);
  });

  it('names what is missing', () => {
    expect(elementsFor(diagram, [/cart/i, /refund/i])).toEqual({
      pass: false,
      detail: 'no element for: refund',
    });
    expect(allLinked(diagram, [[/cart/i, /receipt/i]], { directed: true }).detail).toBe(
      'not joined: cart → receipt',
    );
    expect(mentionsAll(diagram, [/flow/i, /ana/i]).pass).toBe(true);
  });

  it('sees a box inside a frame by its bounds', () => {
    expect(inside(diagram, /receipt/i, /notifications/i)).toBe(true);
    expect(inside(diagram, /cart/i, /notifications/i)).toBe(false);
  });

  it('reads a sketch finish from the tab header', () => {
    expect(sketched(diagram.documents[0].tabs[0])).toBe(true);
  });
});

describe('sheet readers', () => {
  it('reads a column under its header and the cells that show errors', () => {
    expect(below(header(diagram, /^rep$/i)).map((c: { input: string }) => c.input)).toEqual([
      'Ana',
      'Raj',
    ]);
    expect(errorCells(diagram).map((c: { at: string }) => c.at)).toEqual(['B1']);
    expect(below(null)).toEqual([]);
  });
});

describe('parseTabHeader', () => {
  it('reads a kind and mode', () => {
    expect(
      parseTabHeader('tab 6cb1 "RSVP" · 0 elements · kind=form (read_form) · mode=plan · rev 1'),
    ).toEqual({ kind: 'form', mode: 'plan' });
  });
});

describe('runChecks', () => {
  it('adds the base checks, keeps a reason and fails a check that throws', () => {
    const task = {
      checks: [
        ['has cart', ({ snap }: { snap: typeof diagram }) => elementsFor(snap, [/cart/i])],
        [
          'throws',
          () => {
            throw new Error('boom');
          },
        ],
      ],
    };
    expect(runChecks(task, { snap: diagram, run: { finalText: 'Done' } })).toEqual([
      { name: 'made something', pass: true, detail: null },
      { name: 'replied', pass: true, detail: null },
      { name: 'has cart', pass: true, detail: null },
      { name: 'throws', pass: false, detail: 'check threw: boom' },
    ]);
    expect(
      runChecks({ checks: [] }, { snap: { documents: [] }, run: { finalText: ' ' } }).map(
        (c: { pass: boolean }) => c.pass,
      ),
    ).toEqual([false, false]);
  });
});
