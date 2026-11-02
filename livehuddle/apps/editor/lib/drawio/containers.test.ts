// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ReportTally } from './notes';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { model, vertex } from './test-support';

function convert(xml: string) {
  const tally = new ReportTally();
  const page = convertPage(readGraph(model(xml)), {
    tally,
    pageIdToTab: new Map(),
    // Geometry rules read in draw.io units; the page scale has its own tests (scale.test.ts).
    scale: 1,
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

// An ER table or class box (a stack of text rows in a swimlane) imports as a lane holding its rows: the entity
// element is gone with Diagram mode (docs/specs/007-editor/editor-modes.md).
describe('a stacked swimlane', () => {
  it('lands as a lane with its rows as text', () => {
    const { elements } = convert(
      vertex(
        'c',
        'swimlane;childLayout=stackLayout;',
        'width="160" height="60"',
        'parent="1" value="E"',
      ) + // draw.io escapes an HTML label's text, then the file escapes the HTML.
        row('r', 'c', '&amp;lt;&amp;lt;interface&amp;gt;&amp;gt;', 26),
    );
    expect(elements[0]).toMatchObject({ shape: 'lane' });
    expect(elements).toContainEqual(
      expect.objectContaining({ type: 'text', label: '<<interface>>' }),
    );
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

describe('upright lane titles', () => {
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

  it('keeps every title upright in its thin strip, nothing moved', () => {
    const { elements, notes } = convert(pool);
    const by = (label: string) => elements.find((e) => 'label' in e && e.label === label);
    for (const [title, x, width] of [
      ['Hiring', 100, 500],
      ['Candidate', 120, 480],
      ['Recruiter team lead', 120, 480],
    ] as const) {
      expect(by(title)).toMatchObject({
        shape: 'lane',
        titleOrientation: 'upright',
        textAlignX: 'left',
        textAlignY: 'middle',
        headerSize: 20,
        borderRadius: 'none',
        x,
        width,
      });
    }
    expect(by('Apply')).toMatchObject({ x: 160 });
    expect(by('Screen')).toMatchObject({ x: 320 });
    expect(notes).toEqual([]);
  });

  it('reads a horizontal lane across its top band', () => {
    const { elements, notes } = convert(
      vertex(
        'h',
        'swimlane;startSize=30;',
        'x="0" width="300" height="100"',
        'parent="1" value="Column"',
      ),
    );
    expect(elements[0]).toMatchObject({
      x: 0,
      headerSize: 30,
      textAlignY: 'top',
      borderRadius: 'none',
    });
    expect(elements[0]).not.toHaveProperty('titleOrientation');
    expect(notes).toEqual([]);
  });
});
