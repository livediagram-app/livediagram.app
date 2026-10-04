import { describe, expect, it } from 'vitest';
import type { ResultLine } from '@livediagram/api-schema';
import { getBuiltInTheme, type Element } from '@livediagram/document';
import { formatResultFooter, formatResultLines } from './format-results';
import { addedLine, buildResultLines, removedLine } from './results';
import { checkoutFlow } from './fixtures/checkout-flow';

const byId = (id: string) => checkoutFlow().elements.find((el) => el.id === id)!;

describe('formatResultLines', () => {
  it('prints the spec example character for character', () => {
    const results: ResultLine[] = [
      {
        mark: '~',
        ref: 'n3',
        changes: [
          { key: 'label', from: 'Login', to: 'Sign in' },
          { key: 'shape', from: 'square', to: 'stadium' },
          { key: 'widened', from: 140, to: 152 },
        ],
      },
      {
        mark: '+',
        ref: 'verify',
        kind: 'square',
        label: 'Verify email',
        at: [0, 300],
        size: [140, 60],
      },
      { mark: '~', ref: 'a3', changes: [{ key: 'to', from: 'n4', to: 'verify' }] },
      { mark: '+', ref: 'arrow', kind: 'arrow', ends: ['verify', 'n4'], styleOf: 'a3' },
      { mark: '»', refs: ['n4', 'n5', 'n6'], delta: [0, 100], reason: 'make room' },
      { mark: 'container', ref: 'f2', joined: ['verify'], left: [] },
    ];
    const footer = formatResultFooter({
      dryRun: false,
      previousRev: 41,
      rev: 42,
      rebasedOver: 0,
      changesetId: 'cs_8k2m4q7d1x',
      lint: 'lint clean',
    });
    expect([...formatResultLines(results), footer].join('\n')).toBe(
      [
        '~ n3  label "Login"→"Sign in" · shape square→stadium · widened 140→152',
        '+ verify  square "Verify email" @0,300 140×60',
        '~ a3  to n4→verify',
        '+ arrow  verify→n4 (style of a3)',
        '» n4 n5 n6  +0,+100 (make room)',
        'f2  +verify',
        'rev 41→42 · cs_8k2m4q7d1x · lint clean · revert: livediagram changeset revert cs_8k2m4q7d1x',
      ].join('\n'),
    );
  });

  it('prints positions, free ends, absent values, structured values and long text', () => {
    const long = 'A label that runs on well past the sixty characters a result line shows';
    expect(
      formatResultLines([
        {
          mark: '~',
          ref: 'a3',
          changes: [
            { key: 'to', from: 'n7', to: [12, -40] },
            { key: 'fillColor', to: '#ff0000' },
            { key: 'note', from: 'Old' },
            { key: 'cells', from: [['a']], to: [['b']] },
            { key: 'label', to: long },
            { key: 'locked', from: false, to: true },
            { key: 'font', to: 'Comic Sans' },
          ],
        },
      ]),
    ).toEqual([
      '~ a3  to n7→@12,-40 · fillColor →#ff0000 · note "Old"→ · cells (changed) · label →"A label that runs on well past the sixty characters a result"… · locked false→true · font →"Comic Sans"',
    ]);
  });

  it('prints removed lines with their reason, moves without a delta and warnings', () => {
    expect(
      formatResultLines([
        {
          mark: '-',
          ref: 'a4',
          kind: 'arrow',
          ends: ['n3', 'n7'],
          reason: 'pinned',
          pinnedTo: 'n7',
        },
        { mark: '-', ref: 'f2', kind: 'frame', label: 'Payment', reason: 'unwrapped' },
        { mark: '»', refs: ['n5', 'n6'], reason: 'laid out' },
        { mark: '»', refs: ['t1'], delta: [-20, 0], reason: 'carried' },
        { mark: 'container', ref: 'f2', joined: [], left: ['n5'] },
        {
          mark: '!',
          warning: { code: 'label_capped', ref: 'n3', message: 'n3 label kept as "Orders"' },
        },
        { mark: '+', ref: 'e1', kind: 'arrow', ends: ['n1', 'n2'], label: 'yes' },
        { mark: '+', ref: 'bare', kind: 'sticky' },
      ]),
    ).toEqual([
      '- a4  arrow n3→n7 (pinned to n7)',
      '- f2  frame "Payment" (unwrapped)',
      '» n5 n6  laid out',
      '» t1  -20,+0 (carried)',
      'f2  -n5',
      '! label_capped  n3 label kept as "Orders"',
      '+ e1  n1→n2 "yes"',
      '+ bare  sticky',
    ]);
  });
});

describe('formatResultFooter', () => {
  it('prints a dry run', () => {
    expect(formatResultFooter({ dryRun: true, rev: 41, lint: 'lint unavailable' })).toBe(
      'dry run · rev 41 · lint unavailable · nothing written',
    );
  });

  it('counts the writes a changeset was rebased over', () => {
    const write = { dryRun: false as const, previousRev: 41, changesetId: 'cs_1', lint: 'x' };
    expect(formatResultFooter({ ...write, rev: 44, rebasedOver: 3 })).toBe(
      'rev 41→44 · rebased over 3 writes · cs_1 · x · revert: livediagram changeset revert cs_1',
    );
    expect(formatResultFooter({ ...write, rev: 43, rebasedOver: 1 })).toContain(
      'rebased over 1 write ·',
    );
  });
});

describe('result line builders', () => {
  const naming = { refOf: (id: string) => id, origin: { x: -40, y: 0 } };
  it('builds a + line for a box and an arrow', () => {
    expect(addedLine(byId('n3'), naming)).toEqual({
      mark: '+',
      ref: 'n3',
      kind: 'square',
      label: 'Login',
      at: [40, 200],
      size: [140, 60],
    });
    expect(addedLine(byId('a6'), naming)).toEqual({
      mark: '+',
      ref: 'a6',
      kind: 'arrow',
      label: 'yes',
      ends: ['n6', 'n7'],
    });
  });

  it('prints a free end as a point from the origin', () => {
    const loose = {
      id: 'l',
      type: 'arrow',
      from: { kind: 'free', x: -40, y: 5 },
      to: { kind: 'pinned', elementId: 'n1', anchor: 'n' },
    } as Element;
    expect(addedLine(loose, naming)).toMatchObject({ ends: ['@0,5', 'n1'] });
  });

  it('groups what moved without a shift by its reason alone', () => {
    const tab = checkoutFlow();
    const moved = tab.elements.map((el) =>
      el.id === 'n1' || el.id === 'n2' ? { ...el, x: 300 } : el,
    ) as Element[];
    const lines = buildResultLines(
      {
        before: new Map(tab.elements.map((el) => [el.id, el])),
        beforeElements: tab.elements,
        touched: new Map([
          ['n2', { written: [], moved: 'laid out' as const }],
          ['n1', { written: [], moved: 'laid out' as const }],
        ]),
        removed: new Map(),
        warnings: [],
        theme: getBuiltInTheme(undefined),
        origin: { x: -40, y: 0 },
      },
      moved,
    );
    expect(lines).toEqual([{ mark: '»', refs: ['n1', 'n2'], reason: 'laid out' }]);
  });

  it('builds a - line, with the element an arrow went with', () => {
    expect(removedLine(byId('a1'), naming, { pinnedTo: 'n1' })).toEqual({
      mark: '-',
      ref: 'a1',
      kind: 'arrow',
      ends: ['n1', 'n2'],
      reason: 'pinned',
      pinnedTo: 'n1',
    });
    expect(removedLine(byId('n1'), naming)).toEqual({
      mark: '-',
      ref: 'n1',
      kind: 'stadium',
      label: 'Start',
    });
  });
});
