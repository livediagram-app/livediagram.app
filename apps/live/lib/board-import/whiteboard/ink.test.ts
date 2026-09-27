// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  anchor,
  boardHtml,
  inkGroup,
  inkStroke,
  type StrokeSpec,
} from './__fixtures__/board-markup';
import { readBoard } from './canvas';
import { inkStrokeElements, readInkStrokes } from './ink';

const line = (length: number, y = 0) =>
  Array.from({ length: length / 5 + 1 }, (_, i) => ({ x: i * 5, y }));

function strokesOf(
  specs: StrokeSpec[],
  place = { left: 0, top: 0 } as { left: number; top: number; transform?: string },
) {
  const html = boardHtml([
    anchor({
      apikey: 'ink',
      ...place,
      content: inkGroup(specs.map((s, i) => inkStroke(`s${i}`, s))),
    }),
  ]);
  const board = readBoard(new DOMParser().parseFromString(html, 'text/html'));
  if (!board.ok) throw new Error(board.refusal);
  return readInkStrokes(board.items[0]!);
}

describe('readInkStrokes', () => {
  it('reads one stroke per ink group, with its centreline, colour and pen', () => {
    const { strokes } = strokesOf([{ points: line(100), width: 4, rgba: [200, 10, 20, 1] }]);
    expect(strokes).toHaveLength(1);
    const [s] = strokes;
    expect(s!.pen).toBe('pen');
    expect(s!.colour).toEqual({ hex: '#c80a14', alpha: 1 });
    expect(s!.centreline!.at(0)).toEqual({ x: 0, y: 0 });
    expect(s!.centreline!.at(-1)).toEqual({ x: 100, y: 0 });
  });

  it('estimates the width from the outline area over the centreline length', () => {
    for (const width of [1.5, 4, 12]) {
      const { strokes } = strokesOf([{ points: line(200), width, rgba: [0, 0, 0, 1] }]);
      expect(strokes[0]!.widthPx).toBeCloseTo(width, 0);
    }
  });

  it('estimates the width from the outline alone when there is no centreline', () => {
    const { strokes } = strokesOf([
      { points: line(200), width: 20, rgba: [0, 0, 0, 1], noCentreline: true },
    ]);
    expect(strokes[0]!.centreline).toBeNull();
    expect(strokes[0]!.widthPx).toBeCloseTo(20, 0);
  });

  it('recognises a highlighter by its darken blend', () => {
    const { strokes } = strokesOf([
      { points: line(50), width: 14, rgba: [255, 230, 0, 0.5], highlighter: true },
    ]);
    expect(strokes[0]!.pen).toBe('highlighter');
    expect(strokes[0]!.colour!.alpha).toBe(0.5);
  });

  it('places strokes by the anchor and the stroke group transforms', () => {
    const { strokes } = strokesOf(
      [{ points: line(10), width: 2, rgba: [0, 0, 0, 1], transform: 'scale(2)' }],
      { left: 100, top: 50 },
    );
    expect(strokes[0]!.centreline!.at(-1)).toEqual({ x: 120, y: 50 });
  });

  it('marks a pattern-filled effect pen', () => {
    const html = boardHtml([
      anchor({
        apikey: 'ink',
        left: 0,
        top: 0,
        content: inkGroup([
          '<g class="inkStroke"><path d="M0 0L10 0L10 2L0 2Z" fill="url(#galaxy)" opacity="0.8"></path></g>',
        ]),
      }),
    ]);
    const board = readBoard(new DOMParser().parseFromString(html, 'text/html'));
    if (!board.ok) throw new Error(board.refusal);
    const { strokes } = readInkStrokes(board.items[0]!);
    expect(strokes[0]!.effect).toBe(true);
    expect(strokes[0]!.colour).toEqual({ hex: '#000000', alpha: 0.8 });
  });
});

describe('inkStrokeElements', () => {
  const read = (spec: StrokeSpec) => strokesOf([spec]).strokes[0]!;

  it('makes a pen stroke an open freehand with its colour and nearest width', () => {
    const { elements, degraded } = inkStrokeElements(
      read({ points: line(100), width: 4, rgba: [200, 10, 20, 1] }),
    );
    expect(degraded).toEqual([]);
    expect(elements).toHaveLength(1);
    const [el] = elements;
    expect(el).toMatchObject({
      type: 'freehand',
      closed: false,
      strokeColor: '#c80a14',
      strokeWidth: 'thick',
    });
    expect(el!.opacity).toBeUndefined();
    expect(el!.x).toBeCloseTo(-1, 5);
    expect(el!.width).toBeCloseTo(102, 5);
  });

  it('keeps translucency as opacity', () => {
    const { elements } = inkStrokeElements(
      read({ points: line(100), width: 2, rgba: [0, 0, 0, 0.4] }),
    );
    expect(elements[0]!.opacity).toBe(0.4);
  });

  it('counts a width beyond the thickest preset', () => {
    const { elements, degraded } = inkStrokeElements(
      read({ points: line(100), width: 16, rgba: [0, 0, 0, 1] }),
    );
    expect(elements[0]!.strokeWidth).toBe('extra-thick');
    expect(degraded).toEqual(['width-clamped']);
  });

  it('makes a highlighter stroke a marker with its pixel width', () => {
    const { elements } = inkStrokeElements(
      read({ points: line(100), width: 14, rgba: [255, 230, 0, 0.5], highlighter: true }),
    );
    expect(elements[0]).toMatchObject({ pen: 'highlighter', penWidth: 14, strokeColor: '#ffe600' });
  });

  it('keeps a stroke without a centreline as its filled outline', () => {
    const { elements, degraded } = inkStrokeElements(
      read({ points: line(100), width: 20, rgba: [0, 0, 255, 1], noCentreline: true }),
    );
    expect(degraded).toEqual(['ink-outline']);
    expect(elements[0]).toMatchObject({
      type: 'freehand',
      closed: true,
      straightEdges: true,
      fillColor: '#0000ff',
      strokeColor: '#0000ff',
      strokeWidth: 'thin',
    });
  });

  it('turns a single-point stroke into a dot', () => {
    const { elements } = inkStrokeElements(
      read({
        points: [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        width: 4,
        rgba: [0, 0, 0, 1],
      }),
    );
    expect(elements).toHaveLength(1);
    expect(elements[0]!.points.length).toBe(2);
  });

  it('counts an effect pen', () => {
    const stroke = { ...read({ points: line(50), width: 2, rgba: [0, 0, 0, 1] }), effect: true };
    expect(inkStrokeElements(stroke).degraded).toEqual(['effect-pen']);
  });
});
