// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ENTITY_MAX_FIELDS } from '@livediagram/diagram';
import { ReportTally } from '@/lib/import-report';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { model, vertex } from './test-support';

function convert(xml: string) {
  const tally = new ReportTally();
  const page = convertPage(readGraph(model(xml)), {
    tally,
    pageIdToTab: new Map(),
    tabId: 't',
    images: [],
  });
  return { elements: page.elements, notes: tally.notes() };
}

const row = (id: string, parent: string, value: string, y: number) =>
  vertex(
    id,
    'text;html=1;',
    `y="${y}" width="160" height="26"`,
    `parent="${parent}" value="${value}"`,
  );

describe('entities', () => {
  it('cuts rows and text beyond the entity limits, and counts them', () => {
    const rows = Array.from({ length: ENTITY_MAX_FIELDS + 2 }, (_, i) =>
      row(`r${i}`, 'c', i === 0 ? `${'n'.repeat(90)}: T` : `f${i}`, 26 + i * 26),
    ).join('');
    const { elements, notes } = convert(
      vertex(
        'c',
        'swimlane;childLayout=stackLayout;',
        'width="160" height="2000"',
        'parent="1" value="Big"',
      ) + rows,
    );
    expect(elements).toHaveLength(1);
    const entity = elements[0] as { entityFields: { name: string }[] };
    expect(entity.entityFields).toHaveLength(ENTITY_MAX_FIELDS);
    expect(entity.entityFields[0]!.name).toHaveLength(80);
    expect(notes).toEqual([{ kind: 'text-truncated', count: 3 }]);
  });

  it('keeps a row with no colon as a name', () => {
    const { elements } = convert(
      vertex(
        'c',
        'swimlane;childLayout=stackLayout;',
        'width="160" height="60"',
        'parent="1" value="E"',
      ) + // draw.io escapes an HTML label's text, then the file escapes the HTML.
        row('r', 'c', '&amp;lt;&amp;lt;interface&amp;gt;&amp;gt;', 26),
    );
    expect(elements[0]).toMatchObject({ entityFields: [{ name: '<<interface>>' }] });
  });
});

describe('tables', () => {
  it('turns a table without rows into a labelled box', () => {
    const { elements, notes } = convert(
      vertex(
        't',
        'shape=table;startSize=30;',
        'width="100" height="60"',
        'parent="1" value="Empty"',
      ),
    );
    expect(elements).toEqual([expect.objectContaining({ shape: 'square', label: 'Empty' })]);
    expect(notes).toEqual([{ kind: 'shape-approximated', count: 1 }]);
  });

  it('carries cell fills and emphasis, and pads short rows', () => {
    const r = (id: string, y: number) =>
      vertex(id, 'shape=tableRow;', `y="${y}" width="200" height="30"`, 'parent="t"');
    const c = (id: string, parent: string, x: number, value: string, style = '') =>
      vertex(
        id,
        `shape=partialRectangle;${style}`,
        `x="${x}" width="100" height="30"`,
        `parent="${parent}" value="${value}"`,
      );
    const { elements } = convert(
      vertex('t', 'shape=table;startSize=0;', 'x="5" y="5" width="200" height="60"', 'parent="1"') +
        r('r1', 0) +
        c('a', 'r1', 0, 'A', 'fillColor=#FFEEDD;fontStyle=5;align=left;') +
        c('b', 'r1', 100, 'B') +
        r('r2', 30) +
        c('d', 'r2', 0, 'D'),
    );
    expect(elements).toEqual([
      expect.objectContaining({
        type: 'table',
        x: 5,
        y: 5,
        cells: [
          ['A', 'B'],
          ['D', ''],
        ],
        cellStyles: [
          [{ bg: '#ffeedd', bold: true, underline: true, alignX: 'left' }, null],
          [null, null],
        ],
      }),
    ]);
  });
});
