import { describe, expect, it } from 'vitest';
import type { ResultLine } from '@livehuddle/api-schema';
import { getBuiltInTheme, type Element } from '@livehuddle/document';
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
          { key: 'shape', from: 'signpost', to: 'room-sign' },
          { key: 'widened', from: 140, to: 160 },
        ],
      },
      {
        mark: '+',
        ref: 'verify',
        kind: 'signpost',
        label: 'Verify email',
        at: [45, 300],
        size: [131, 120],
      },
      { mark: '~', ref: 'f2', changes: [{ key: 'taller', from: 200, to: 360 }] },
      { mark: '~', ref: 'a3', changes: [{ key: 'to', from: 'n4', to: 'verify' }] },
      { mark: '+', ref: 'arrow', kind: 'arrow', ends: ['verify', 'n4'], styleOf: 'a3' },
      {
        mark: '»',
        refs: ['n4', 'n5', 'n6', 'n7', 'n8'],
        delta: [0, 160],
        reason: 'make room',
      },
    ];
    const footer = formatResultFooter({
      dryRun: false,
      previousRev: 41,
      rev: 42,
      rebasedOver: 0,
      changesetId: 'cs_8k2m4q7d1x',
      documentId: 'd-auth',
    });
    expect([...formatResultLines(results), footer].join('\n')).toBe(
      [
        '~ n3  label "Login"→"Sign in" · shape signpost→room-sign · widened 140→160',
        '+ verify  signpost "Verify email" @45,300 131×120',
        '~ f2  taller 200→360',
        '~ a3  to n4→verify',
        '+ arrow  verify→n4 (style of a3)',
        '» n4 n5 n6 n7 n8  +0,+160 (make room)',
        'rev 41→42 · cs_8k2m4q7d1x · revert: livehuddle changeset revert d-auth cs_8k2m4q7d1x',
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
            { key: 'textBold', from: false, to: true },
            { key: 'font', to: 'Comic Sans' },
          ],
        },
      ]),
    ).toEqual([
      '~ a3  to n7→@12,-40 · fillColor →#ff0000 · note "Old"→ · cells (changed) · label →"A label that runs on well past the sixty characters a result"… · textBold false→true · font →"Comic Sans"',
    ]);
  });

  it('prints a structured value where a point or an order is expected as changed', () => {
    expect(
      formatResultLines([
        {
          mark: '~',
          ref: 'a3',
          changes: [
            { key: 'from', from: { id: 'n7', side: 'left' }, to: [12, -40] },
            { key: 'order', to: { above: 'n5' } },
          ],
        },
      ]),
    ).toEqual(['~ a3  from (changed)→@12,-40 · order (changed)']);
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
        { mark: '»', refs: ['n5', 'n6'], reason: 'laid out' },
        { mark: '»', refs: ['t1'], delta: [-20, 0], reason: 'make room' },
        {
          mark: '!',
          warning: { code: 'label_capped', ref: 'n3', message: 'n3 label kept as "Orders"' },
        },
        { mark: '+', ref: 'e1', kind: 'arrow', ends: ['n1', 'n2'], label: 'yes' },
        { mark: '+', ref: 'bare', kind: 'sticky' },
      ]),
    ).toEqual([
      '- a4  arrow n3→n7 (pinned to n7)',
      '» n5 n6  laid out',
      '» t1  -20,+0 (make room)',
      '! label_capped  n3 label kept as "Orders"',
      '+ e1  n1→n2 "yes"',
      '+ bare  sticky',
    ]);
  });
});

describe('formatResultFooter', () => {
  it('prints a dry run', () => {
    expect(formatResultFooter({ dryRun: true, rev: 41 })).toBe(
      'dry run · rev 41 · nothing written',
    );
  });

  it('counts the writes a changeset was rebased over', () => {
    const write = {
      dryRun: false as const,
      previousRev: 41,
      changesetId: 'cs_1',
      documentId: 'd1',
    };
    expect(formatResultFooter({ ...write, rev: 44, rebasedOver: 3 })).toBe(
      'rev 41→44 · rebased over 3 writes · cs_1 · revert: livehuddle changeset revert d1 cs_1',
    );
    expect(formatResultFooter({ ...write, rev: 43, rebasedOver: 1 })).toContain(
      'rebased over 1 write ·',
    );
  });
});

describe('result line builders', () => {
  const naming = { refOf: (id: string) => id, origin: { x: -40, y: 0 } };
  it('builds a + line for a box, and for a stored arrow with no place', () => {
    expect(addedLine(byId('n3'), naming)).toEqual({
      mark: '+',
      ref: 'n3',
      kind: 'signpost',
      label: 'Login',
      at: [40, 200],
      size: [140, 60],
    });
    expect(addedLine(byId('a6'), naming)).toEqual({
      mark: '+',
      ref: 'a6',
      // A retired element since part 4 of the element engine: no ends, no place.
      kind: '? arrow',
      label: 'yes',
    });
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
        removed: new Set(),
        warnings: [],
        theme: getBuiltInTheme(undefined),
        origin: { x: -40, y: 0 },
      },
      moved,
    );
    expect(lines).toEqual([{ mark: '»', refs: ['n1', 'n2'], reason: 'laid out' }]);
  });

  // A stored arrow is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
  // part 4): it prints as `?`, with no ends, and nothing goes with another element.
  it('builds a - line, a stored arrow as any retired element', () => {
    expect(removedLine(byId('a1'), naming)).toEqual({ mark: '-', ref: 'a1', kind: '? arrow' });
    expect(removedLine(byId('n1'), naming)).toEqual({
      mark: '-',
      ref: 'n1',
      kind: 'room-sign',
      label: 'Start',
    });
  });
});
