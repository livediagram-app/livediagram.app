import { describe, expect, it } from 'vitest';
import type { WbBoard, WbElement, WbInk } from './elements';
import { createColourResolver } from '@/lib/board-scene/colour';
import {
  GALAXY_COLOUR,
  GALAXY_STOPS,
  RAINBOW_COLOUR,
  RAINBOW_STOPS,
  inkToScene,
} from './ink-scene';
import { POLYGON_WIDTH_PX, RULES, boardToScene } from './to-scene';

const unit = 1 / 128;
const stroke = (over: Partial<WbInk['strokes'][number]> = {}): WbInk['strokes'][number] => ({
  preset: 'pen',
  stroke: {
    originPx: { x: 0, y: 0 },
    unitScale: unit,
    width: 512,
    pressureMax: 8192,
    points: [
      { x: 0, y: 0, p: 0.5 },
      { x: 1280, y: 0, p: 1 },
    ],
  },
  colour: { hex: '#e71224' },
  widthFactor: 1,
  dx: 0,
  dy: 0,
  arrowheads: [],
  unreadableArrowheads: 0,
  ...over,
});
const group = (over: Partial<WbInk> = {}): WbInk => ({
  kind: 'ink',
  x: 100,
  y: 50,
  scale: 1,
  rotationDeg: 0,
  strokes: [stroke()],
  unreadable: 0,
  ...over,
});
const scene = (elements: WbElement[], over: Partial<WbBoard> = {}) =>
  boardToScene({
    board: { pattern: 'plain', elements, ...over },
    imageObjects: new Map(),
    images: new Map(),
  });
const ctx = () => ({
  appearance: 'light' as const,
  notes: { invisible: 0, unreadable: 0, rainbow: 0, galaxy: 0 },
});

// docs/specs/020-import-export/whiteboard-import.md "Mapping".
describe('inkToScene', () => {
  it('places points by group position, scale and unit, keeps pressure and width', () => {
    const [ink] = inkToScene(
      group({ scale: 2, strokes: [stroke({ widthFactor: 0.5, dx: 3, dy: 4 })] }),
      'k',
      ctx(),
    );
    expect(ink).toEqual({
      key: 'k-0',
      kind: 'ink',
      points: [
        { x: 106, y: 58, p: 0.5 },
        { x: 126, y: 58, p: 1 },
      ],
      stroke: { colour: { hex: '#e71224' }, widthPx: 4 },
    });
  });

  it('thins a dense straight stroke to its ends, points and pressure exact', () => {
    const s = stroke();
    s.stroke.points = Array.from({ length: 30 }, (_, i) => ({ x: i * 13, y: 0, p: 0.123456 }));
    const [ink] = inkToScene(group({ strokes: [s] }), 'k', ctx());
    expect(ink!.points).toEqual([
      { x: 100, y: 50, p: 0.123456 },
      { x: 100 + 29 * 13 * unit, y: 50, p: 0.123456 },
    ]);
  });

  it('drops pressure when a point lacks it', () => {
    const s = stroke();
    s.stroke.points = [
      { x: 0, y: 0 },
      { x: 10, y: 0, p: 1 },
    ];
    expect(inkToScene(group({ strokes: [s] }), 'k', ctx())[0]!.points).toEqual([
      { x: 100, y: 50 },
      { x: 100 + 10 * unit, y: 50 },
    ]);
  });

  it('rotates about the group position, clockwise', () => {
    const [ink] = inkToScene(group({ rotationDeg: 90 }), 'k', ctx());
    expect(ink!.points.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([
      [100, 50],
      [100, 60],
    ]);
  });

  it('lands highlighters, and preset inks in their stock colour with their stops, counted', () => {
    const c = ctx();
    const items = inkToScene(
      group({
        strokes: [
          stroke({ preset: 'highlighter', colour: { hex: '#fcfc00', alpha: 0.4 } }),
          stroke({ preset: 'rainbow' }),
          stroke({ preset: 'galaxy' }),
        ],
      }),
      'k',
      c,
    );
    expect(items[0]).toMatchObject({
      highlighter: true,
      stroke: { colour: { hex: '#fcfc00', alpha: 0.4 } },
    });
    expect(items[1]!.stroke).toEqual({
      colour: RAINBOW_COLOUR,
      widthPx: 4,
      stops: [...RAINBOW_STOPS],
    });
    expect(items[2]!.stroke).toMatchObject({ colour: GALAXY_COLOUR, stops: [...GALAXY_STOPS] });
    expect(c.notes).toMatchObject({ rainbow: 1, galaxy: 1 });
    // Their light-board versions resolve to the stock names on landing.
    expect(createColourResolver()(RAINBOW_COLOUR)).toEqual({ kind: 'stock', name: 'pink' });
    expect(createColourResolver()(GALAXY_COLOUR)).toEqual({ kind: 'stock', name: 'violet' });
  });

  it('draws an arrowhead as its own stroke from its origin, in the stroke colour', () => {
    const head = {
      originPx: { x: 10, y: -2 },
      unitScale: 0.5,
      width: 8,
      pressureMax: 2,
      points: [
        { x: 0, y: 0, p: 0.5 },
        { x: 4, y: 4, p: 0.5 },
      ],
    };
    const c = ctx();
    const items = inkToScene(group({ strokes: [stroke({ arrowheads: [head], dx: 1 })] }), 'k', c);
    expect(items.map((i) => i.key)).toEqual(['k-0', 'k-1-head']);
    expect(items[1]).toMatchObject({
      points: [
        { x: 111, y: 48, p: 0.5 },
        { x: 113, y: 50, p: 0.5 },
      ],
      stroke: { colour: { hex: '#e71224' }, widthPx: 4 },
    });
  });

  it('counts arrowheads it cannot read', () => {
    const c = ctx();
    inkToScene(group({ strokes: [stroke({ unreadableArrowheads: 2 })] }), 'k', c);
    expect(c.notes.unreadable).toBe(2);
  });

  it("on a dark board: near-white is ink, the board's own colour is left out and counted", () => {
    const c = {
      appearance: 'dark' as const,
      background: { hex: '#1f1f1f' },
      notes: { invisible: 0, unreadable: 2, rainbow: 0, galaxy: 0 },
    };
    const items = inkToScene(
      group({
        strokes: [stroke({ colour: { hex: '#ebebeb' } }), stroke({ colour: { hex: '#1f1f1f' } })],
      }),
      'k',
      c,
    );
    expect(items.map((i) => i.stroke.colour)).toEqual(['ink']);
    expect(c.notes.invisible).toBe(1);
  });
});

describe('boardToScene', () => {
  it('carries title, id, appearance, background and pattern', () => {
    expect(
      boardToScene({
        board: { background: { hex: '#1f1f1f' }, pattern: 'grid', elements: [] },
        title: 'Plans',
        sourceId: 'b',
        imageObjects: new Map(),
        images: new Map(),
      }),
    ).toEqual({
      source: 'microsoft-whiteboard',
      title: 'Plans',
      sourceId: 'b',
      authoredOn: 'dark',
      background: { appearance: 'dark', pattern: 'grid', colour: { hex: '#1f1f1f' } },
      items: [],
      assets: [],
      notes: [],
    });
  });

  it('maps shapes, stickies and text boxes with scaled sizes and fonts', () => {
    const placed = { x: 10, y: 20, scale: 0.5, rotationDeg: 0 };
    const t = { text: 'Hi', fontPx: 24, bold: true, colour: { hex: '#000000' } };
    const { items } = scene([
      {
        kind: 'shape',
        ...placed,
        width: 160,
        height: 100,
        borderWidth: 2,
        dashed: true,
        border: { hex: '#1f1f1f' },
        fill: { hex: '#99c9ef' },
        text: t,
      },
      {
        kind: 'sticky',
        ...placed,
        rotationDeg: 5,
        width: 304,
        height: 304,
        fill: { hex: '#f6dc67' },
      },
      { kind: 'text', ...placed, text: { ...t, text: 'Two\nlines' } },
    ]);
    expect(items[0]).toEqual({
      key: 'e0',
      kind: 'shape',
      shape: 'rectangle',
      x: 10,
      y: 20,
      width: 80,
      height: 50,
      stroke: { colour: { hex: '#1f1f1f' }, widthPx: 1, dash: 'dashed' },
      fill: { hex: '#99c9ef' },
      label: {
        text: 'Hi',
        fontPx: 12,
        family: 'sans',
        colour: { hex: '#000000' },
        alignX: 'center',
        alignY: 'middle',
        bold: true,
      },
    });
    expect(items[1]).toMatchObject({
      kind: 'sticky',
      width: 152,
      rotationDeg: 5,
      fill: { hex: '#f6dc67' },
    });
    expect(items[2]).toMatchObject({
      kind: 'text',
      autoWidth: true,
      height: 30,
      text: { fontPx: 12, family: 'sans' },
    });
  });

  it('turns black text on a dark board into ink, so it can be seen', () => {
    const { items } = scene(
      [
        {
          kind: 'text',
          x: 0,
          y: 0,
          scale: 1,
          rotationDeg: 0,
          width: 200,
          height: 40,
          text: { text: 'a', fontPx: 20, bold: false, colour: { hex: '#000000' } },
        },
      ],
      { background: { hex: '#1f1f1f' } },
    );
    expect(items[0]).toMatchObject({ autoWidth: false, width: 200, text: { colour: 'ink' } });
  });

  it('maps images to assets once per file, and notes missing ones', () => {
    const bytes = new Uint8Array([1]);
    const img = {
      kind: 'image' as const,
      x: 0,
      y: 0,
      scale: 0.5,
      rotationDeg: 0,
      width: 600,
      height: 400,
    };
    const s = boardToScene({
      board: {
        pattern: 'plain',
        elements: [
          { ...img, imageNodeId: 'd1' },
          { ...img, imageNodeId: 'd2' },
          { ...img, imageNodeId: 'd3' },
          img,
        ],
      },
      imageObjects: new Map([
        ['d1', 'o1'],
        ['d2', 'o1'],
        ['d3', 'o-missing'],
      ]),
      images: new Map([['o1', { bytes, mimeType: 'image/png' }]]),
    });
    expect(s.items).toEqual([
      { key: 'e0', kind: 'image', x: 0, y: 0, width: 300, height: 200, asset: 'o1' },
      { key: 'e1', kind: 'image', x: 0, y: 0, width: 300, height: 200, asset: 'o1' },
    ]);
    expect(s.assets).toEqual([
      { key: 'o1', source: { kind: 'bytes', bytes, mimeType: 'image/png' } },
    ]);
    expect(s.notes).toEqual([{ rule: RULES.missingImages, count: 2, kind: 'skipped' }]);
  });

  it('maps polygons and lines to polylines', () => {
    const { items } = scene([
      {
        kind: 'polygon',
        cx: 100,
        cy: 100,
        corners: [
          { x: -10, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
        ],
        colour: { hex: '#0069bf' },
      },
      {
        kind: 'line',
        x: 5,
        y: 5,
        scale: 1,
        rotationDeg: 0,
        from: { x: 0, y: 0 },
        to: { x: 50, y: 0 },
        width: 2,
        dashed: false,
        colour: { hex: '#0069bf' },
        heads: { start: false, end: true },
      },
    ]);
    expect(items[0]).toEqual({
      key: 'e0',
      kind: 'polyline',
      points: [
        { x: 90, y: 100 },
        { x: 110, y: 100 },
        { x: 100, y: 110 },
      ],
      closed: true,
      stroke: { colour: { hex: '#0069bf' }, widthPx: POLYGON_WIDTH_PX },
    });
    expect(items[1]).toEqual({
      key: 'e1',
      kind: 'polyline',
      points: [
        { x: 5, y: 5 },
        { x: 55, y: 5 },
      ],
      stroke: { colour: { hex: '#0069bf' }, widthPx: 2 },
      heads: { end: 'arrow' },
    });
  });

  it('turns a table into cell rectangles with their ink, and notes it', () => {
    const s = scene([
      {
        kind: 'table',
        x: 0,
        y: 0,
        scale: 1,
        rotationDeg: 0,
        columns: [100, 50],
        colour: { hex: '#0069bf' },
        rows: [{ height: 40, cells: [[], [group({ x: 1, y: 2 })]] }],
      },
    ]);
    expect(s.items.map((i) => [i.kind, i.key])).toEqual([
      ['shape', 'e0-0-0'],
      ['shape', 'e0-0-1'],
      ['ink', 'e0-0-1-0-0'],
    ]);
    expect(s.items[1]).toMatchObject({ x: 100, y: 0, width: 50, height: 40 });
    expect(s.items[2]!.kind === 'ink' && s.items[2]!.points[0]).toEqual({ x: 101, y: 2, p: 0.5 });
    expect(s.notes).toEqual([{ rule: RULES.tables, count: 1, kind: 'degraded' }]);
  });

  it('notes every skip and degradation, never silently', () => {
    const s = scene(
      [
        { kind: 'unknown', type: 'x' },
        { kind: 'polygon', cx: 0, cy: 0, corners: [] },
        group({
          unreadable: 2,
          strokes: [
            stroke(),
            stroke({ colour: { hex: '#000000' } }),
            stroke({ preset: 'rainbow' }),
            stroke({ preset: 'galaxy' }),
            stroke({ preset: 'galaxy' }),
          ],
        }),
      ],
      { background: { hex: '#1f1f1f' } },
    );
    expect(s.notes).toEqual([
      { rule: RULES.rainbow, count: 1, kind: 'degraded' },
      { rule: RULES.galaxy, count: 2, kind: 'degraded' },
      { rule: RULES.invisible, count: 1, kind: 'skipped' },
      { rule: RULES.unreadable, count: 2, kind: 'skipped' },
      { rule: RULES.unsupported, count: 2, kind: 'skipped' },
    ]);
  });
});
