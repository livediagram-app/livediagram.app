import { describe, expect, it } from 'vitest';
import { MSWB_TYPE } from './format';
import { readBoard, type WbElement } from './elements';
import {
  CANVAS_ID,
  argb,
  command,
  history,
  imageNode,
  inkGroup,
  lineNode,
  node,
  polygonNode,
  shapeNode,
  stickyNode,
  tableNode,
  textBoxNode,
  treeInit,
  type RawNode,
} from './ms-whiteboard-fixtures';
import { MSWB_TRAIT } from './format';
import { replayBoard } from './replay';

function board(elements: RawNode[], extra?: (h: ReturnType<typeof history>) => void) {
  const h = history();
  let last: string | undefined;
  for (const el of elements) {
    h.insert(CANVAS_ID, MSWB_TRAIT.children, [el], last ? { after: last } : {});
    last = el.fuid;
  }
  extra?.(h);
  return readBoard(replayBoard(treeInit(), h.changes)!);
}
const only = (el: RawNode): WbElement => board([el]).elements[0]!;

const pts = [
  { x: 256, y: 256, p: 0.5 },
  { x: 512, y: 300, p: 1 },
];

// docs/specs/020-import-export/blueprints/ms-whiteboard-import.md "Elements".
describe('readBoard', () => {
  it('reads an ink group: placement, every stroke preset, colour, factor, translation, arrowhead', () => {
    const el = only(
      inkGroup({
        x: 10,
        y: 20,
        scale: 2,
        rotation: 15,
        strokes: [
          { colour: '#e71224', stroke: { width: 512, points: pts }, arrowhead: true },
          {
            preset: 'highlighter',
            colour: '#fcfc00',
            alpha: 0.4,
            stroke: { width: 2048, points: pts },
          },
          { preset: 'rainbow', stroke: { width: 512, points: pts } },
          { preset: 'galaxy', stroke: { width: 512, points: pts } },
          {
            colour: '#000000',
            stroke: { layout: 'older', width: 105, points: pts },
            widthFactor: 0.5,
            translate: [3, 4],
          },
        ],
      }),
    );
    expect(el).toMatchObject({
      kind: 'ink',
      x: 10,
      y: 20,
      scale: 2,
      rotationDeg: 15,
      unreadable: 0,
    });
    if (el.kind !== 'ink') throw new Error('not ink');
    expect(el.strokes.map((s) => s.preset)).toEqual([
      'pen',
      'highlighter',
      'rainbow',
      'galaxy',
      'pen',
    ]);
    expect(el.strokes[0]).toMatchObject({
      colour: { hex: '#e71224' },
      arrowhead: true,
      widthFactor: 1,
    });
    expect(el.strokes[1]!.colour).toEqual({ hex: '#fcfc00', alpha: 102 / 255 });
    expect(el.strokes[2]!.colour).toBeUndefined();
    expect(el.strokes[4]).toMatchObject({ widthFactor: 0.5, dx: 3, dy: 4, arrowhead: false });
  });

  it('counts strokes it cannot read', () => {
    const group = inkGroup({ x: 0, y: 0, strokes: [{ stroke: { width: 512, points: pts } }] });
    group.traits
      .find((t) => t.trait === MSWB_TRAIT.strokes)!
      .children.push(node(MSWB_TYPE.pen, {}, Uint8Array.from([1])));
    expect(only(group)).toMatchObject({ kind: 'ink', unreadable: 1 });
  });

  it('reads a shape with its border, fill and bold text', () => {
    expect(
      only(
        shapeNode({
          x: 1,
          y: 2,
          w: 160,
          h: 120,
          border: '#1f1f1f',
          fill: '#99c9ef',
          borderWidth: 4,
          dashed: true,
          text: ['Plan', 'it'],
          fontSize: 20,
          bold: true,
        }),
      ),
    ).toEqual({
      kind: 'shape',
      x: 1,
      y: 2,
      scale: 1,
      rotationDeg: 0,
      width: 160,
      height: 120,
      borderWidth: 4,
      dashed: true,
      border: { hex: '#1f1f1f' },
      fill: { hex: '#99c9ef' },
      text: { text: 'Plan\nit', fontPx: 20, bold: true, colour: { hex: '#000000' } },
    });
  });

  it('reads a sticky note as yellow; an empty one without text', () => {
    expect(
      only(stickyNode({ x: 0, y: 0, w: 304, h: 304, scale: 0.5, text: ['Hi'] })),
    ).toMatchObject({
      kind: 'sticky',
      scale: 0.5,
      fill: { hex: '#f6dc67' },
      text: { text: 'Hi', bold: false },
    });
    expect(only(stickyNode({ x: 0, y: 0, w: 304, h: 304, text: [''] }))).not.toHaveProperty('text');
  });

  it('reads text boxes: auto width without a size, their colour, black by default', () => {
    expect(
      only(
        textBoxNode({
          x: 5,
          y: 6,
          text: ['Fire'],
          colour: '11a3662a-83e7-558a-be1b-e3a38e9f8b95',
          fontSize: 34,
        }),
      ),
    ).toEqual({
      kind: 'text',
      x: 5,
      y: 6,
      scale: 1,
      rotationDeg: 0,
      text: { text: 'Fire', fontPx: 34, bold: false, colour: { hex: '#f6630c' } },
    });
    expect(only(textBoxNode({ x: 0, y: 0, w: 300, h: 80, text: ['Wrapped'] }))).toMatchObject({
      width: 300,
      height: 80,
      text: { colour: { hex: '#000000' } },
    });
  });

  it('reads an image and its data node id', () => {
    expect(
      only(imageNode({ x: 0, y: 0, w: 614, h: 631, scale: 0.5, dataId: 'data-7' })),
    ).toMatchObject({
      kind: 'image',
      width: 614,
      height: 631,
      scale: 0.5,
      imageNodeId: 'data-7',
    });
  });

  it('reads a polygon, a line and a table', () => {
    const els = board([
      polygonNode({
        cx: 100,
        cy: 50,
        corners: [
          [-10, -5],
          [10, -5],
          [10, 5],
        ],
        colour: '#0069bf',
      }),
      lineNode({
        x: 7,
        y: 8,
        from: [0, 0],
        to: [100, 0],
        width: 2,
        dashed: true,
        colour: '#1f1f1f',
        endHead: 1,
      }),
      tableNode({
        x: 0,
        y: 0,
        columns: [192],
        rows: [
          {
            height: 94,
            cells: [[inkGroup({ x: 1, y: 1, strokes: [{ stroke: { width: 512, points: pts } }] })]],
          },
          { height: 94, cells: [[]] },
        ],
        colour: '#0069bf',
      }),
    ]).elements;
    expect(els[0]).toEqual({
      kind: 'polygon',
      cx: 100,
      cy: 50,
      corners: [
        { x: -10, y: -5 },
        { x: 10, y: -5 },
        { x: 10, y: 5 },
      ],
      colour: { hex: '#0069bf' },
    });
    expect(els[1]).toMatchObject({
      kind: 'line',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      dashed: true,
      heads: { start: false, end: true },
    });
    expect(els[2]).toMatchObject({
      kind: 'table',
      columns: [192],
      rows: [{ height: 94 }, { height: 94, cells: [[]] }],
    });
  });

  it('reads unknown kinds and placeless elements as unknown', () => {
    expect(only(node('mystery-type'))).toEqual({ kind: 'unknown', type: 'mystery-type' });
    expect(only(node(MSWB_TYPE.shape))).toMatchObject({ kind: 'unknown' });
  });

  it('reads the background colour and pattern', () => {
    const b = board([], (h) =>
      h.group([
        command.insert(CANVAS_ID, MSWB_TRAIT.background, [argb('#1f1f1f')]),
        command.insert(CANVAS_ID, MSWB_TRAIT.pattern, [node(MSWB_TYPE.patternDots)]),
      ]),
    );
    expect(b).toEqual({ background: { hex: '#1f1f1f' }, pattern: 'dots', elements: [] });
  });
});
