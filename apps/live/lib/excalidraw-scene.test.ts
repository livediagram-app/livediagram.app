import { describe, expect, it } from 'vitest';
import type { SceneConnector, SceneImage, SceneItem, SceneShape } from './board-scene/scene';
import { readExcalidrawEnvelope } from './excalidraw-envelope';
import {
  excalidrawBuilder,
  excalidrawFile,
  excalidrawText,
  PIXEL_PNG_DATA_URL,
} from './excalidraw-fixtures';
import { EXCALIDRAW_NOTE, skippedTypeRule } from './excalidraw-scene-notes';
import { excalidrawToBoardScene } from './excalidraw-scene';
import { EXCALIDRAW_FREEDRAW_WIDTH_FACTOR } from './excalidraw-scene-style';
import type {
  ExcalidrawElement,
  ExcalidrawEnvelopeType,
  ExcalidrawFiles,
} from './excalidraw-types';

const sceneOf = (
  elements: ExcalidrawElement[],
  options: {
    type?: ExcalidrawEnvelopeType;
    files?: ExcalidrawFiles;
    appState?: Record<string, unknown>;
  } = {},
) => {
  const r = readExcalidrawEnvelope(excalidrawText(elements, options));
  if (!r.ok) throw new Error(r.error);
  return excalidrawToBoardScene(r.envelope);
};

const only = <K extends SceneItem['kind']>(items: SceneItem[], kind: K) =>
  items.filter((i): i is Extract<SceneItem, { kind: K }> => i.kind === kind);

describe('excalidrawToBoardScene envelope', () => {
  it('is an Excalidraw scene of unknown appearance with no assets or notes when plain', () => {
    const b = excalidrawBuilder();
    const scene = sceneOf([b.rectangle()]);
    expect(scene).toMatchObject({
      source: 'excalidraw',
      authoredOn: 'unknown',
      assets: [],
      notes: [],
    });
    expect(scene.background).toBeUndefined();
  });

  it('takes a saved scene background colour and grid', () => {
    const b = excalidrawBuilder();
    const scene = sceneOf([b.rectangle()], {
      type: 'excalidraw',
      appState: { viewBackgroundColor: '#FFF9DB', gridModeEnabled: true },
    });
    expect(scene.background).toEqual({ colour: { hex: '#fff9db' }, pattern: 'grid' });
    const plain = sceneOf([b.rectangle()], {
      type: 'excalidraw',
      appState: { viewBackgroundColor: 'oops', gridModeEnabled: false },
    });
    expect(plain.background).toBeUndefined();
  });
});

describe('z-order', () => {
  it('orders by fractional index, array order breaking ties', () => {
    const b = excalidrawBuilder();
    const r1 = b.rectangle({ index: 'a2' });
    const r2 = b.rectangle({ index: 'a0' });
    const r3 = b.rectangle({ index: 'a1' });
    const r4 = b.rectangle({ index: 'a1' });
    const r5 = b.rectangle({ index: 'Zz' });
    expect(sceneOf([r1, r2, r3, r4, r5]).items.map((i) => i.key)).toEqual([
      r5.id,
      r2.id,
      r3.id,
      r4.id,
      r1.id,
    ]);
  });

  it('keeps array order when any element lacks an index', () => {
    const b = excalidrawBuilder();
    const r1 = b.rectangle({ index: 'a2' });
    const r2 = b.rectangle({ index: null });
    const r3 = b.rectangle({ index: 'a0' });
    expect(sceneOf([r1, r2, r3]).items.map((i) => i.key)).toEqual([r1.id, r2.id, r3.id]);
  });

  it('skips deleted elements and keys an element without id by position', () => {
    const b = excalidrawBuilder();
    const kept = b.rectangle({ id: undefined });
    const scene = sceneOf([b.rectangle({ isDeleted: true }), kept]);
    expect(scene.items.map((i) => i.key)).toEqual(['excalidraw-0']);
  });
});

describe('shapes', () => {
  it('maps rectangles, ellipses and diamonds with box, stroke and rounding', () => {
    const b = excalidrawBuilder();
    const scene = sceneOf([
      b.rectangle({
        x: 10,
        y: 20,
        width: 120,
        height: 60,
        roundness: { type: 3 },
        strokeColor: '#868e96',
        strokeWidth: 1,
      }),
      b.rectangle({ roundness: null }),
      b.rectangle({ roundness: { type: 1 } }),
      b.ellipse(),
      b.diamond({ roundness: { type: 2 } }),
    ]);
    const shapes = only(scene.items, 'shape');
    expect(shapes[0]).toEqual({
      key: shapes[0]!.key,
      kind: 'shape',
      shape: 'rectangle',
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      rounded: true,
      stroke: { colour: { hex: '#868e96' }, widthPx: 1 },
    });
    expect(shapes.map((s) => [s.shape, s.rounded])).toEqual([
      ['rectangle', true],
      ['rectangle', undefined],
      ['rectangle', true],
      ['ellipse', true],
      ['diamond', true],
    ]);
  });

  it('keeps fill, rotation, lock and link; floors a box at 1 px', () => {
    const b = excalidrawBuilder();
    const [shape] = only(
      sceneOf([
        b.rectangle({
          backgroundColor: '#ffec99',
          angle: Math.PI / 4,
          locked: true,
          link: 'https://example.com',
          width: 0,
          height: -3,
        }),
      ]).items,
      'shape',
    );
    expect(shape).toMatchObject({
      fill: { hex: '#ffec99' },
      locked: true,
      link: 'https://example.com',
      width: 1,
      height: 1,
    });
    expect(shape!.rotationDeg).toBeCloseTo(45);
  });

  it('has no stroke for a transparent outline', () => {
    const b = excalidrawBuilder();
    const [shape] = only(sceneOf([b.rectangle({ strokeColor: 'transparent' })]).items, 'shape');
    expect(shape!.stroke).toBeNull();
  });

  it('takes bound text as its label and consumes the text', () => {
    const b = excalidrawBuilder();
    const rect = b.rectangle();
    const label = b.label(rect, 'Read file', { fontSize: 16, strokeColor: '#1971c2' });
    const scene = sceneOf([rect, label]);
    expect(scene.items).toHaveLength(1);
    expect((scene.items[0] as SceneShape).label).toEqual({
      text: 'Read file',
      fontPx: 16,
      family: 'hand',
      colour: { hex: '#1971c2' },
      alignX: 'center',
      alignY: 'middle',
    });
  });

  it('leaves text standalone when its container is missing or cannot hold it', () => {
    const b = excalidrawBuilder();
    const line = b.line([
      [0, 0],
      [5, 5],
    ]);
    const orphan = b.text('orphan', { containerId: 'gone' });
    const onLine = b.text('on line', { containerId: line.id });
    const scene = sceneOf([line, orphan, onLine]);
    expect(only(scene.items, 'text').map((t) => t.text.text)).toEqual(['orphan', 'on line']);
  });
});

describe('standalone text', () => {
  it('lands with its box, continuous size and hand-drawn family', () => {
    const b = excalidrawBuilder();
    const [t] = only(
      sceneOf([b.text('Tools', { x: 5, y: 6, width: 90, height: 79, fontSize: 63.36 })]).items,
      'text',
    );
    expect(t).toEqual({
      key: t!.key,
      kind: 'text',
      x: 5,
      y: 6,
      width: 90,
      height: 79,
      sizing: 'fit',
      text: {
        text: 'Tools',
        fontPx: 63.36,
        family: 'hand',
        colour: { hex: '#1e1e1e' },
        alignX: 'left',
        alignY: 'top',
      },
    });
  });

  it('wraps to its width when it does not auto-resize, keeping the unwrapped text', () => {
    const b = excalidrawBuilder();
    const [t] = only(
      sceneOf([b.text('a long\nline', { originalText: 'a long line', autoResize: false })]).items,
      'text',
    );
    expect(t!.sizing).toBe('wrap');
    expect(t!.text.text).toBe('a long line');
  });

  it('keeps line breaks and reads an absent autoResize as auto', () => {
    const b = excalidrawBuilder();
    const [t] = only(sceneOf([b.text('one\ntwo\nthree', { autoResize: undefined })]).items, 'text');
    expect(t!.text.text).toBe('one\ntwo\nthree');
    expect(t!.sizing).toBe('fit');
  });

  it('maps code families to mono and the rest to sans', () => {
    const b = excalidrawBuilder();
    const items = only(
      sceneOf([b.text('c', { fontFamily: 3 }), b.text('n', { fontFamily: 6 })]).items,
      'text',
    );
    expect(items.map((t) => t.text.family)).toEqual(['mono', 'sans']);
  });
});

describe('freedraw', () => {
  it('becomes ink with absolute points, painted width and streamline', () => {
    const b = excalidrawBuilder();
    const [ink] = only(
      sceneOf([
        b.freedraw(
          [
            [0, 0],
            [3, 4],
            [8, 1],
          ],
          { x: 100, y: 50, strokeWidth: 2, strokeColor: '#e03131' },
        ),
      ]).items,
      'ink',
    );
    expect(ink).toEqual({
      key: ink!.key,
      kind: 'ink',
      points: [
        { x: 100, y: 50 },
        { x: 103, y: 54 },
        { x: 108, y: 51 },
      ],
      stroke: {
        colour: { hex: '#e03131' },
        widthPx: 2 * EXCALIDRAW_FREEDRAW_WIDTH_FACTOR.constant,
      },
      streamline: 0.5,
    });
  });

  it('keeps recorded pressures, one per point', () => {
    const b = excalidrawBuilder();
    const [ink] = only(
      sceneOf([
        b.freedraw(
          [
            [0, 0],
            [1, 1],
            [2, 2],
          ],
          {
            simulatePressure: false,
            pressures: [0.2, 0.6, 0.9],
            strokeOptions: { variability: 'variable', streamline: 0.3 },
          },
        ),
      ]).items,
      'ink',
    );
    expect(ink!.points.map((p) => p.p)).toEqual([0.2, 0.6, 0.9]);
    expect(ink!.streamline).toBe(0.3);
  });

  it('ignores pressures that do not match the points', () => {
    const b = excalidrawBuilder();
    const [ink] = only(
      sceneOf([
        b.freedraw(
          [
            [0, 0],
            [1, 1],
          ],
          { simulatePressure: false, pressures: [0.5] },
        ),
      ]).items,
      'ink',
    );
    expect(ink!.points.every((p) => p.p === undefined)).toBe(true);
  });

  it('notes tapered strokes drawn with simulated pressure, not constant ones', () => {
    const b = excalidrawBuilder();
    const scene = sceneOf([
      b.freedraw(
        [
          [0, 0],
          [1, 1],
        ],
        { strokeOptions: { variability: 'variable', streamline: 0.5 } },
      ),
      b.freedraw(
        [
          [0, 0],
          [1, 1],
        ],
        { strokeOptions: undefined },
      ),
      b.freedraw([
        [0, 0],
        [1, 1],
      ]),
    ]);
    expect(scene.notes).toEqual([{ rule: EXCALIDRAW_NOTE.taperedStrokes, count: 2 }]);
  });

  it('closes a loop and keeps its fill; an out-of-range streamline is the default', () => {
    const b = excalidrawBuilder();
    const [ink] = only(
      sceneOf([
        b.freedraw(
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 0],
          ],
          {
            backgroundColor: '#a5d8ff',
            strokeOptions: { variability: 'constant', streamline: 7 },
          },
        ),
      ]).items,
      'ink',
    );
    expect(ink!.closed).toBe(true);
    expect(ink!.points).toHaveLength(3);
    expect(ink!.fill).toEqual({ hex: '#a5d8ff' });
    expect(ink!.streamline).toBe(0.5);
  });

  it('bakes rotation into the points', () => {
    const b = excalidrawBuilder();
    const [ink] = only(
      sceneOf([
        b.freedraw(
          [
            [0, 0],
            [10, 0],
          ],
          { x: 0, y: 0, width: 10, height: 0, angle: Math.PI },
        ),
      ]).items,
      'ink',
    );
    expect(ink!.rotationDeg).toBeUndefined();
    expect(ink!.points[0]!.x).toBeCloseTo(10);
    expect(ink!.points[1]!.x).toBeCloseTo(0);
  });
});

describe('lines', () => {
  it('maps a two-point line to a straight polyline', () => {
    const b = excalidrawBuilder();
    const [line] = only(
      sceneOf([
        b.line(
          [
            [0, 0],
            [50, 10],
          ],
          { x: 1, y: 2 },
        ),
      ]).items,
      'polyline',
    );
    expect(line).toEqual({
      key: line!.key,
      kind: 'polyline',
      points: [
        { x: 1, y: 2 },
        { x: 51, y: 12 },
      ],
      stroke: { colour: { hex: '#1e1e1e' }, widthPx: 2 },
    });
  });

  it('curves a multi-point rounded line; a sharp one stays straight', () => {
    const b = excalidrawBuilder();
    const pts: [number, number][] = [
      [0, 0],
      [26, 12],
      [84, 13],
      [119, -6],
    ];
    const lines = only(sceneOf([b.line(pts), b.line(pts, { roundness: null })]).items, 'polyline');
    expect(lines.map((l) => [l.points.length, l.curved])).toEqual([
      [4, true],
      [4, undefined],
    ]);
  });

  it('closes a polygon with its fill, and a loop by geometry', () => {
    const b = excalidrawBuilder();
    const tri: [number, number][] = [
      [0, 0],
      [10, 0],
      [5, 8],
    ];
    const [poly, loop, openFilled] = only(
      sceneOf([
        b.line(tri, { polygon: true, backgroundColor: '#b2f2bb' }),
        b.line([...tri, [0, 0]], { roundness: null }),
        b.line(tri, { backgroundColor: '#b2f2bb' }),
      ]).items,
      'polyline',
    );
    expect(poly).toMatchObject({ closed: true, fill: { hex: '#b2f2bb' } });
    expect(loop).toMatchObject({ closed: true });
    expect(loop!.points).toHaveLength(3);
    expect(openFilled!.closed).toBeUndefined();
    expect(openFilled!.fill).toBeUndefined();
  });

  it('keeps arrowheads a line carries', () => {
    const b = excalidrawBuilder();
    const [line] = only(
      sceneOf([
        b.line(
          [
            [0, 0],
            [5, 0],
          ],
          { startArrowhead: 'dot', endArrowhead: 'triangle' },
        ),
      ]).items,
      'polyline',
    );
    expect(line!.heads).toEqual({ start: 'circle', end: 'triangle' });
  });
});

describe('arrows', () => {
  it('binds both ends by key and keeps the default end head', () => {
    const b = excalidrawBuilder();
    const from = b.rectangle({ x: 0, y: 0 });
    const to = b.diamond({ x: 300, y: 0 });
    const arrow = b.arrow(
      [
        [0, 0],
        [190, 0],
      ],
      { x: 105, y: 25, strokeColor: '#2f9e44' },
      { from, to },
    );
    const [c] = only(sceneOf([from, to, arrow]).items, 'connector');
    expect(c).toEqual({
      key: arrow.id,
      kind: 'connector',
      points: [
        { x: 105, y: 25 },
        { x: 295, y: 25 },
      ],
      stroke: { colour: { hex: '#2f9e44' }, widthPx: 2 },
      heads: { end: 'arrow' },
      from: from.id,
      to: to.id,
    });
  });

  it('binds to an element that comes later in the order', () => {
    const b = excalidrawBuilder();
    const target = b.rectangle({ index: 'b0' });
    const arrow = b.arrow(
      [
        [0, 0],
        [5, 0],
      ],
      { index: 'a0' },
      { to: target },
    );
    const [c] = only(sceneOf([target, arrow]).items, 'connector');
    expect(c!.to).toBe(target.id);
  });

  it('leaves an end free when its target is not in the scene or did not land', () => {
    const b = excalidrawBuilder();
    const embed = b.rectangle({ type: 'embeddable' });
    const arrow = b.arrow(
      [
        [0, 0],
        [5, 0],
      ],
      {
        startBinding: { elementId: 'missing', mode: 'orbit', fixedPoint: [0, 0] },
        endBinding: { elementId: embed.id, mode: 'inside', fixedPoint: [0.5, 0.5] },
      },
    );
    const [c] = only(sceneOf([embed, arrow]).items, 'connector');
    expect(c!.from).toBeUndefined();
    expect(c!.to).toBeUndefined();
  });

  it('reads heads: absent end is an arrow, null is none, start kept', () => {
    const b = excalidrawBuilder();
    const absent = b.arrow([
      [0, 0],
      [5, 0],
    ]);
    delete absent.endArrowhead;
    const none = b.arrow(
      [
        [0, 0],
        [5, 0],
      ],
      { endArrowhead: null, startArrowhead: 'triangle_outline' },
    );
    const [a, n] = only(sceneOf([absent, none]).items, 'connector');
    expect(a!.heads).toEqual({ end: 'arrow' });
    expect(n!.heads).toEqual({ start: 'triangle-hollow' });
  });

  it('curves a rounded bent arrow; an elbowed or sharp one is not curved', () => {
    const b = excalidrawBuilder();
    const bent: [number, number][] = [
      [0, 0],
      [8, 18],
      [53, 34],
    ];
    const [round, elbow, sharp, straight] = only(
      sceneOf([
        b.arrow(bent),
        b.arrow(bent, { elbowed: true }),
        b.arrow(bent, { roundness: null }),
        b.arrow([
          [0, 0],
          [5, 0],
        ]),
      ]).items,
      'connector',
    );
    expect(round!.curved).toBe(true);
    expect(round!.points).toHaveLength(3);
    expect(elbow!.curved).toBeUndefined();
    expect(sharp!.curved).toBeUndefined();
    expect(straight!.curved).toBeUndefined();
  });

  it('takes bound text as its label; an off-centre label is noted', () => {
    const b = excalidrawBuilder();
    const mid = b.arrow([
      [0, 0],
      [100, 0],
    ]);
    const midLabel = b.label(mid, 'Request to model', { fontSize: 16 });
    const off = b.arrow([
      [0, 0],
      [100, 0],
    ]);
    const offLabel = b.label(off, 'Tools', { labelPosition: 0.2 });
    const scene = sceneOf([mid, midLabel, off, offLabel]);
    const connectors = only(scene.items, 'connector');
    expect(scene.items).toHaveLength(2);
    expect(connectors.map((c) => c.label?.text)).toEqual(['Request to model', 'Tools']);
    expect(scene.notes).toEqual([{ rule: EXCALIDRAW_NOTE.labelPosition, count: 1 }]);
  });

  it('notes heads with no counterpart', () => {
    const b = excalidrawBuilder();
    const scene = sceneOf([
      b.arrow(
        [
          [0, 0],
          [5, 0],
        ],
        { endArrowhead: 'crowfoot_many' },
      ),
    ]);
    expect((scene.items[0] as SceneConnector).heads).toEqual({ end: 'arrow' });
    expect(scene.notes).toEqual([{ rule: EXCALIDRAW_NOTE.unmatchedHeads, count: 1 }]);
  });
});

describe('sticky notes, frames and groups', () => {
  it('maps a sticky note with its fill and bound text', () => {
    const b = excalidrawBuilder();
    const empty = b.stickynote({ x: 960, y: -500 });
    const written = b.stickynote();
    const text = b.label(written, 'Idea', { fontSize: 24 });
    const stickies = only(sceneOf([empty, written, text]).items, 'sticky');
    expect(stickies[0]).toEqual({
      key: empty.id,
      kind: 'sticky',
      x: 960,
      y: -500,
      width: 250,
      height: 250,
      fill: { hex: '#ffdf6b' },
    });
    expect(stickies[1]!.text?.text).toBe('Idea');
  });

  it('gives a sticky without a readable fill the Excalidraw yellow', () => {
    const b = excalidrawBuilder();
    const [s] = only(sceneOf([b.stickynote({ backgroundColor: 'transparent' })]).items, 'sticky');
    expect(s!.fill).toEqual({ hex: '#ffdf6b' });
  });

  it('maps a frame with its name; its children stay ordinary items', () => {
    const b = excalidrawBuilder();
    const frame = b.frame('Testing', { x: -10, y: -20 });
    const child = b.ellipse({ frameId: frame.id, index: 'a000' }); // children sit below their frame
    const magic = b.frame('', { type: 'magicframe', name: null });
    const scene = sceneOf([child, frame, magic]);
    expect(scene.items.map((i) => i.kind)).toEqual(['shape', 'frame', 'frame']);
    expect(only(scene.items, 'frame')[0]).toEqual({
      key: frame.id,
      kind: 'frame',
      x: -10,
      y: -20,
      width: 400,
      height: 300,
      name: 'Testing',
    });
    expect(only(scene.items, 'frame')[1]!.name).toBeUndefined();
  });

  it('drops groups, counting each distinct group once', () => {
    const b = excalidrawBuilder();
    const scene = sceneOf([
      b.rectangle({ groupIds: ['g1'] }),
      b.text('a', { groupIds: ['g1'] }),
      b.text('b', { groupIds: ['g2', 'g1'] }),
      b.rectangle(),
    ]);
    expect(scene.items).toHaveLength(4);
    expect(scene.notes).toEqual([{ rule: EXCALIDRAW_NOTE.groups, count: 2 }]);
  });
});

describe('images', () => {
  it('maps image elements to items and their files to assets, once per file', () => {
    const b = excalidrawBuilder();
    const one = b.image('f1', { x: 1, y: 2, width: 30, height: 40 });
    const twice = b.image('f1');
    const cropped = b.image('f2', { crop: { x: 0, y: 0, width: 5, height: 5 } });
    const scene = sceneOf([one, twice, cropped], {
      files: { ...excalidrawFile('f1'), ...excalidrawFile('f2'), ...excalidrawFile('unused') },
    });
    const images = only(scene.items, 'image');
    expect(images[0]).toEqual({
      key: one.id,
      kind: 'image',
      x: 1,
      y: 2,
      width: 30,
      height: 40,
      asset: 'f1',
    });
    expect(images.map((i: SceneImage) => [i.asset, i.crop])).toEqual([
      ['f1', undefined],
      ['f1', undefined],
      ['f2', true],
    ]);
    expect(scene.assets).toEqual([
      { key: 'f1', source: { kind: 'data-url', dataUrl: PIXEL_PNG_DATA_URL } },
      { key: 'f2', source: { kind: 'data-url', dataUrl: PIXEL_PNG_DATA_URL } },
    ]);
    expect(scene.notes).toEqual([]);
  });

  it('keeps an image whose bytes are missing as an item without an asset', () => {
    const b = excalidrawBuilder();
    const gone = b.image('gone');
    const noFile = b.image(null);
    const scene = sceneOf([gone, noFile], {
      files: { gone: { mimeType: 'image/png' } },
    });
    expect(only(scene.items, 'image').map((i) => i.asset)).toEqual(['gone', noFile.id]);
    expect(scene.assets).toEqual([]);
  });
});

describe('colours and unknown types', () => {
  it('survives malformed fields without throwing', () => {
    const b = excalidrawBuilder();
    const typeless = b.rectangle({ type: undefined });
    const scene = sceneOf([
      b.rectangle({ x: 'a' as unknown as number, groupIds: null as unknown as string[] }),
      b.rectangle({ groupIds: [3 as unknown as string] }),
      b.freedraw([[0, 0]], { points: undefined }),
      b.arrow(
        [
          [0, 0],
          [5, 0],
        ],
        { id: undefined },
      ),
      typeless,
      b.text('t', { containerId: typeless.id }),
      b.line(
        [
          [0, 0],
          [5, 0],
        ],
        { strokeColor: 'transparent', strokeWidth: 4 },
      ),
    ]);
    expect(scene.items.map((i) => i.kind)).toEqual([
      'shape',
      'shape',
      'ink',
      'connector',
      'text',
      'polyline',
    ]);
    expect((scene.items[0] as SceneShape).x).toBe(0);
    expect(scene.notes).toEqual([{ rule: skippedTypeRule('unknown'), count: 1, kind: 'skipped' }]);
    const line = scene.items[5] as Extract<SceneItem, { kind: 'polyline' }>;
    expect(line.stroke).toEqual({ colour: 'ink', widthPx: 4 });
  });

  it('passes light-reference colours through; the landing decides ink', () => {
    const b = excalidrawBuilder();
    const scene = sceneOf([b.rectangle({ strokeColor: '#1e1e1e' })]);
    expect(scene.authoredOn).toBe('unknown');
    expect((scene.items[0] as SceneShape).stroke?.colour).toEqual({ hex: '#1e1e1e' });
  });

  it('counts unknown and unmapped types by type, never throwing', () => {
    const b = excalidrawBuilder();
    const scene = sceneOf([
      b.rectangle({ type: 'embeddable' }),
      b.rectangle({ type: 'embeddable' }),
      b.rectangle({ type: 'iframe' }),
      b.rectangle({ type: undefined }),
      b.rectangle(),
    ]);
    expect(scene.items).toHaveLength(1);
    expect(scene.notes).toEqual([
      { rule: skippedTypeRule('embeddable'), count: 2, kind: 'skipped' },
      { rule: skippedTypeRule('iframe'), count: 1, kind: 'skipped' },
      { rule: skippedTypeRule('unknown'), count: 1, kind: 'skipped' },
    ]);
  });
});
