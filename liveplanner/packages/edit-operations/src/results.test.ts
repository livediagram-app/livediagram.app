import { describe, expect, it } from 'vitest';
import type { ResultLine } from '@liveplanner/api-schema';
import { formatResultFooter, formatResultLines } from './format-results';
import type { Element } from '@liveplanner/project';
import { addedLine, buildResultLines, removedLine } from './results';
import { sprintDashboard } from './fixtures/sprint-dashboard';

const byId = (id: string) => sprintDashboard().elements.find((el) => el.id === id)!;

describe('formatResultLines', () => {
  it('prints the spec example character for character', () => {
    const results: ResultLine[] = [
      {
        mark: '~',
        ref: '0a78',
        changes: [{ key: 'planView', from: { view: 'calendar' }, to: { view: 'workload' } }],
      },
      { mark: '-', ref: '82d4', kind: 'plan-view' },
    ];
    const footer = formatResultFooter({
      dryRun: false,
      previousRev: 1,
      rev: 2,
      rebasedOver: 0,
      changesetId: 'cs_tbrfqcvm1w',
      projectId: '4cd7082b',
    });
    expect([...formatResultLines(results), footer].join('\n')).toBe(
      [
        '~ 0a78  planView (changed)',
        '- 82d4  plan-view',
        'rev 1→2 · cs_tbrfqcvm1w · revert: liveplanner changeset revert 4cd7082b cs_tbrfqcvm1w',
      ].join('\n'),
    );
  });

  it('prints positions, absent values, structured values and long text', () => {
    expect(
      formatResultLines([
        {
          mark: '~',
          ref: 'w1',
          changes: [
            { key: 'at', from: [0, 140], to: [20, 160] },
            { key: 'label', to: 'A'.repeat(80) },
            { key: 'textSize', from: 'md' },
            { key: 'note', to: `${'word '.repeat(12)}end` },
            { key: 'chartSource', from: { sheetId: 'a' }, to: { sheetId: 'b' } },
          ],
        },
      ]),
    ).toEqual([
      `~ w1  @0,140→@20,160 · label →"${'A'.repeat(60)}"… · textSize md→ · note →"${'word '.repeat(9).trim()}"… · chartSource (changed)`,
    ]);
  });

  it('prints added, removed and warning lines', () => {
    expect(
      formatResultLines([
        { mark: '+', ref: 'g1', kind: 'plan-view', label: 'Plan', at: [0, 840], size: [500, 360] },
        { mark: '-', ref: 'w1', kind: 'plan-view', label: 'Workload' },
        { mark: '+', ref: 'a1', kind: 'arrow' },
        { mark: '!', warning: { code: 'no_base', message: 'sent without the revision you read' } },
      ]),
    ).toEqual([
      '+ g1  plan-view "Plan" @0,840 500×360',
      '- w1  plan-view "Workload"',
      '+ a1  arrow',
      '! no_base  sent without the revision you read',
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
      projectId: 'd1',
    };
    expect(formatResultFooter({ ...write, rev: 44, rebasedOver: 3 })).toBe(
      'rev 41→44 · rebased over 3 writes · cs_1 · revert: liveplanner changeset revert d1 cs_1',
    );
    expect(formatResultFooter({ ...write, rev: 43, rebasedOver: 1 })).toContain(
      'rebased over 1 write ·',
    );
  });
});

describe('result line builders', () => {
  const naming = { refOf: (id: string) => id, origin: { x: -40, y: 0 } };

  it('builds a + line from the origin', () => {
    expect(addedLine(byId('w1'), naming)).toEqual({
      mark: '+',
      ref: 'w1',
      kind: 'plan-view',
      label: 'Workload',
      at: [40, 140],
      size: [500, 360],
    });
  });

  it('builds a - line', () => {
    expect(removedLine(byId('m3'), naming)).toEqual({ mark: '-', ref: 'm3', kind: 'plan-view' });
  });
});

describe('buildResultLines', () => {
  const origin = { x: 0, y: 0 };
  const source = (before: Element[], written: string[]) => ({
    before: new Map(before.map((el) => [el.id, el])),
    beforeElements: before,
    touched: new Map(before.map((el) => [el.id, { written }])),
    warnings: [],
    origin,
  });

  it('lists the fields no operation wrote after those it did, each in the element’s own order', () => {
    const was = byId('w1');
    const now = { ...was, label: 'Load', textSize: 'lg', fillColor: '#fff' } as Element;
    const warning = { code: 'no_base' as const, message: 'sent without the revision you read' };
    const [line, last] = buildResultLines(
      { ...source([was], ['fillColor']), warnings: [warning] },
      [now],
    );
    // Warnings follow the element lines.
    expect(last).toEqual({ mark: '!', warning });
    expect(line).toMatchObject({ mark: '~', ref: 'w1' });
    expect((line as { changes: { key: string }[] }).changes.map((c) => c.key)).toEqual([
      'fillColor',
      'textSize',
      'label',
    ]);
  });

  it('gives an element with no box (an arrow) neither a place nor a size', () => {
    const arrow = { id: 'a1', type: 'arrow', points: [0, 0, 10, 10] } as unknown as Element;
    expect(addedLine(arrow, { refOf: (id) => id, origin })).toEqual({
      mark: '+',
      ref: 'a1',
      kind: 'arrow',
    });
  });
});
