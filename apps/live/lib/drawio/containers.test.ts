// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ENTITY_MAX_FIELDS } from '@livediagram/diagram';
import { ReportTally } from '@/lib/import-report';
import { readGraph } from './cells';
import { laneTitleWidth } from './containers';
import { convertPage } from './convert-page';
import { model, vertex } from './test-support';

function convert(xml: string) {
  const tally = new ReportTally();
  const page = convertPage(readGraph(model(xml)), {
    tally,
    pageIdToTab: new Map(),
    tabId: 't',
    images: [],
    imageKeys: new Map(),
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
          // An uncoloured cell on a light fill of its own takes dark ink.
          [
            { bg: '#ffeedd', textColor: '#1e293b', bold: true, underline: true, alignX: 'left' },
            null,
          ],
          [null, null],
        ],
      }),
    ]);
  });
});

describe('vertical lane titles', () => {
  // A pool of two vertical-title lanes, as draw.io's library draws them: the
  // pool's strip is 20 wide, each lane's strip 20 wide, the first step 40 in.
  const pool =
    vertex(
      'pool',
      'swimlane;horizontal=0;startSize=20;childLayout=stackLayout;',
      'x="100" y="0" width="500" height="200"',
      'parent="1" value="Hiring"',
    ) +
    vertex(
      'l1',
      'swimlane;horizontal=0;startSize=20;',
      'x="20" width="480" height="100"',
      'parent="pool" value="Candidate"',
    ) +
    vertex('a', '', 'x="40" y="20" width="100" height="60"', 'parent="l1" value="Apply"') +
    vertex(
      'l2',
      'swimlane;horizontal=0;startSize=20;',
      'x="20" y="100" width="480" height="100"',
      'parent="pool" value="Recruiter team lead"',
    ) +
    vertex('b', '', 'x="200" y="20" width="100" height="60"', 'parent="l2" value="Screen"');

  it('widens every title strip to hold its title on one line, growing lanes left of their content', () => {
    const { elements, notes } = convert(pool);
    const by = (label: string) =>
      elements.find((e) => 'label' in e && e.label === label) as {
        x: number;
        width: number;
        headerSize: number;
      };
    // Content never moves.
    expect(by('Apply')).toMatchObject({ x: 160 });
    expect(by('Screen')).toMatchObject({ x: 320 });
    for (const title of ['Hiring', 'Candidate', 'Recruiter team lead']) {
      const lane = by(title);
      expect(lane.headerSize).toBeGreaterThanOrEqual(laneTitleWidth(title));
    }
    // A lane's strip ends before its first shape: no content sits over a title.
    expect(by('Candidate').x + by('Candidate').headerSize).toBeLessThanOrEqual(160);
    expect(by('Recruiter team lead').x + by('Recruiter team lead').headerSize).toBeLessThanOrEqual(
      320,
    );
    // The pool's strip ends before its (grown) lanes begin.
    const lanes = Math.min(by('Candidate').x, by('Recruiter team lead').x);
    expect(by('Hiring').x + by('Hiring').headerSize).toBeLessThanOrEqual(lanes);
    // Lanes stacked in the pool keep one left edge and one strip width.
    expect(by('Candidate').x).toBe(by('Recruiter team lead').x);
    expect(by('Candidate').headerSize).toBe(by('Recruiter team lead').headerSize);
    // Right edges stay where draw.io put them.
    expect(by('Hiring').x + by('Hiring').width).toBe(600);
    expect(by('Candidate').x + by('Candidate').width).toBe(600);
    expect(notes).toEqual([{ kind: 'lane-title-turned', count: 3 }]);
  });

  it('does not grow a lane whose content leaves room for its title', () => {
    const { elements } = convert(
      vertex(
        'l',
        'swimlane;horizontal=0;startSize=20;',
        'x="0" width="600" height="100"',
        'parent="1" value="Ops"',
      ) + vertex('c', '', 'x="200" y="20" width="100" height="60"', 'parent="l"'),
    );
    expect(elements[0]).toMatchObject({ x: 0, width: 600, headerSize: laneTitleWidth('Ops') });
  });

  it('leaves horizontal lanes and untitled vertical lanes as draw.io drew them', () => {
    const { elements, notes } = convert(
      vertex(
        'h',
        'swimlane;startSize=30;',
        'x="0" width="300" height="100"',
        'parent="1" value="Column"',
      ) +
        vertex(
          'u',
          'swimlane;horizontal=0;startSize=20;',
          'x="400" width="300" height="100"',
          'parent="1"',
        ),
    );
    expect(elements).toEqual([
      expect.objectContaining({ x: 0, headerSize: 30 }),
      expect.objectContaining({ x: 400, headerSize: 20 }),
    ]);
    expect(notes).toEqual([]);
  });
});
