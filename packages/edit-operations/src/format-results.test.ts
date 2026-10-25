import { describe, expect, it } from 'vitest';
import {
  createFormatResultFooter,
  formatResultLines,
  formatValue,
  type PrintedFooter,
} from './format-results';

describe('formatValue', () => {
  it('prints tokens and numbers bare, prose quoted, absence as nothing', () => {
    expect(formatValue('fill', '#ff0000')).toBe('#ff0000');
    expect(formatValue('width', 120)).toBe('120');
    expect(formatValue('locked', true)).toBe('true');
    expect(formatValue('label', 'Pay')).toBe('"Pay"');
    expect(formatValue('note', 'short')).toBe('"short"');
    expect(formatValue('kind', 'two words')).toBe('"two words"');
    expect(formatValue('kind', undefined)).toBe('');
  });

  it('cuts a label at 60 and other text at 48', () => {
    const long = 'word '.repeat(20).trim();
    expect(formatValue('label', long)).toBe(`${JSON.stringify(long.slice(0, 59))}…`);
    expect(formatValue('note', long)).toBe(`${JSON.stringify(long.slice(0, 44))}…`);
  });
});

describe('formatResultLines', () => {
  it('prints each mark', () => {
    expect(
      formatResultLines([
        { mark: '+', ref: 'n1', kind: 'square', label: 'Pay', at: [10, 20], size: [120, 60] },
        { mark: '+', ref: 'n2', kind: 'text' },
        { mark: '+', ref: 'a1', kind: 'arrow', ends: ['n1', 'n2'], label: 'yes', styleOf: 'a0' },
        { mark: '+', ref: 'a2', kind: 'arrow', ends: ['n1', 'n2'] },
        {
          mark: '~',
          ref: 'n1',
          changes: [
            { key: 'label', from: 'Pay', to: 'Charge' },
            { key: 'at', from: [0, 0], to: [10, -5] },
            { key: 'from', from: 'n1', to: [3, 4] },
            { key: 'to', from: [1, 2], to: { x: 1 } },
            { key: 'order', to: 'front' },
            { key: 'order', to: 3 },
            { key: 'style', from: { a: 1 }, to: { a: 2 } },
            { key: 'fill', to: '#fff' },
          ],
        },
        { mark: '-', ref: 'n3', kind: 'square', label: 'Old' },
        {
          mark: '-',
          ref: 'a3',
          kind: 'arrow',
          ends: ['n1', 'n3'],
          reason: 'pinned',
          pinnedTo: 'n3',
        },
        { mark: '-', ref: 'f1', kind: 'frame', reason: 'unwrapped' },
        { mark: '»', refs: ['n4', 'n5'], delta: [40, -8], reason: 'make room' },
        {
          mark: '»',
          refs: ['n6'],
          reason: 'laid out',
          layout: { style: 'flow', direction: 'down' },
        },
        { mark: '»', refs: ['n7'], reason: 'carried' },
        { mark: 'container', ref: 'f2', joined: ['n1'], left: ['n2'] },
        { mark: '!', warning: { code: 'no_base', message: 'sent without a base' } },
      ]),
    ).toEqual([
      '+ n1  square "Pay" @10,20 120×60',
      '+ n2  text',
      '+ a1  n1→n2 "yes" (style of a0)',
      '+ a2  n1→n2',
      '~ n1  label "Pay"→"Charge" · @0,0→@10,-5 · from n1→@3,4 · to @1,2→(changed) · order front · order (changed) · style (changed) · fill →#fff',
      '- n3  square "Old"',
      '- a3  arrow n1→n3 (pinned to n3)',
      '- f1  frame (unwrapped)',
      '» n4 n5  +40,-8 (make room)',
      '» n6  laid out (flow, down)',
      '» n7  carried',
      'f2  +n1 -n2',
      '! no_base  sent without a base',
    ]);
  });
});

describe('createFormatResultFooter', () => {
  type Footer = PrintedFooter & ({ dryRun: true } | { dryRun: false; documentId: string });
  const footer = createFormatResultFooter<Footer>(
    (f) => `tool changeset revert ${f.documentId} ${f.changesetId}`,
  );

  it('says a dry run wrote nothing', () => {
    expect(footer({ dryRun: true, rev: 4, lint: 'lint clean' })).toBe(
      'dry run · rev 4 · lint clean · nothing written',
    );
  });

  it('names the revisions, rebases and the revert command', () => {
    const write = {
      dryRun: false as const,
      previousRev: 4,
      rev: 5,
      changesetId: 'cs1',
      documentId: 'd1',
      lint: 'lint clean',
    };
    expect(footer({ ...write, rebasedOver: 0 })).toBe(
      'rev 4→5 · cs1 · lint clean · revert: tool changeset revert d1 cs1',
    );
    expect(footer({ ...write, rebasedOver: 1 })).toContain('rev 4→5 · rebased over 1 write ·');
    expect(footer({ ...write, rebasedOver: 2 })).toContain('rebased over 2 writes');
  });
});
