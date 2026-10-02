import { describe, expect, it } from 'vitest';
import { landBoardScene, type BoardSceneProfile } from './board-scene/land';
import { sceneFromExcalidrawText } from './excalidraw-read';
import { tabToExcalidrawText } from './excalidraw-export';
import { excalidrawBuilder, excalidrawText } from './excalidraw-fixtures';
import {
  isValidElement,
  type ArrowElement,
  type FreehandElement,
  type ShapeElement,
  type TextElement,
} from '@livediagram/document';
import {
  cornerRadiusPx,
  encodeStrokePoints,
  freehandCanvasPoints,
  strokePointCount,
} from '@livediagram/document';

// Excalidraw text through the one parser and the shared landing, as the Import dialog runs it
// (useTabImport, useBoardSceneImport), at the tab's own coordinates.
function build(text: string, profile: BoardSceneProfile) {
  const read = sceneFromExcalidrawText(text);
  if (!read.ok) return { ok: false as const, error: read.error };
  const landed = landBoardScene(read.scene, {
    profile,
    placement: { kind: 'origin' },
    mintId: () => crypto.randomUUID(),
  });
  if (!landed.ok) return { ok: false as const, error: landed.message };
  const pattern = read.scene.background?.pattern;
  return {
    ok: true as const,
    elements: landed.elements,
    images: landed.imageRequests,
    report: landed.report,
    backgroundColor: landed.tabPatch.backgroundColor,
    backgroundPattern: pattern ? landed.tabPatch.backgroundPattern : undefined,
  };
}

// The diagram profile: the mapping this importer has always had (docs/specs/020-import-export/excalidraw-import-export.md).
const importOnDiagram = (text: string) => build(text, 'diagram');

// Minimal scene wrapper — only the fields the importer reads.
const scene = (elements: unknown[], appState?: Record<string, unknown>) =>
  JSON.stringify({ type: 'excalidraw', version: 2, elements, ...(appState ? { appState } : {}) });

const rect = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 120,
  height: 60,
  strokeColor: '#1e1e1e',
  backgroundColor: '#ffec99',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 100,
  angle: 0,
  groupIds: [],
  roundness: { type: 3 },
  isDeleted: false,
  ...over,
});

describe('Excalidraw import envelope', () => {
  it('rejects non-JSON', () => {
    const r = importOnDiagram('nope');
    expect(r.ok).toBe(false);
  });

  it('rejects JSON that is not an excalidraw scene', () => {
    const r = importOnDiagram('{"kind":"livediagram.tab"}');
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/excalidraw/i);
  });

  it('rejects a scene missing its elements array', () => {
    const r = importOnDiagram('{"type":"excalidraw"}');
    expect(r.ok).toBe(false);
  });

  it('skips isDeleted elements and counts unknown types', () => {
    const r = importOnDiagram(
      scene([rect({ isDeleted: true }), { id: 'e1', type: 'embeddable', x: 0, y: 0 }]),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements).toHaveLength(0);
    expect(r.report.skipped).toEqual([{ rule: 'Embeddable elements were skipped', count: 1 }]);
  });

  it('carries the scene background colour', () => {
    const r = importOnDiagram(scene([], { viewBackgroundColor: '#f8f9fa' }));
    if (!r.ok) throw new Error(r.error);
    expect(r.backgroundColor).toBe('#f8f9fa');
  });
});

// docs/specs/020-import-export/excalidraw-import-export.md "Rounded corners": the operator's case,
// a 13.9 x 14.6 px rounded square, stays a rounded square of about 3.5 px corners, not a circle.
describe('rounded corners', () => {
  const small = rect({ width: 13.9, height: 14.6, roundness: { type: 3 } });
  it.each(['whiteboard', 'diagram'] as const)(
    'land Large on a %s, drawn at a quarter of the side',
    (profile) => {
      const r = build(scene([small]), profile);
      if (!r.ok) throw new Error(r.error);
      const [s] = r.elements as ShapeElement[];
      expect(s!.borderRadius).toBe('lg');
      expect(cornerRadiusPx(s!.borderRadius, s!.width, s!.height, 8)).toBeCloseTo(3.475, 6);
    },
  );

  it('treats the proportional and legacy types the same', () => {
    for (const type of [1, 2]) {
      const r = importOnDiagram(scene([rect({ roundness: { type } })]));
      if (!r.ok) throw new Error(r.error);
      expect((r.elements[0] as ShapeElement).borderRadius).toBe('lg');
    }
  });

  it('match Excalidraw exactly up to 96 px, and round less beyond it', () => {
    // Excalidraw type 3: 25% of the shorter side, capped at 32 px.
    const excalidraw = (w: number, h: number) => Math.min(0.25 * Math.min(w, h), 32);
    for (const side of [14, 40, 96]) {
      expect(cornerRadiusPx('lg', side, side * 2, 8)).toBeCloseTo(excalidraw(side, side * 2), 9);
    }
    expect(cornerRadiusPx('lg', 200, 200, 8)).toBe(24);
  });

  it('export a rounded corner back as roundness type 3', () => {
    const r = importOnDiagram(scene([small]));
    if (!r.ok) throw new Error(r.error);
    const back = JSON.parse(tabToExcalidrawText({ id: 't', name: 'T', elements: r.elements }));
    expect(back.elements[0].roundness).toEqual({ type: 3 });
  });
});

describe('boxed element mapping', () => {
  it('maps rectangle/ellipse/diamond to the matching shapes', () => {
    const r = importOnDiagram(
      scene([
        rect(),
        rect({ id: 'e1', type: 'ellipse', roundness: null }),
        rect({ id: 'd1', type: 'diamond', roundness: null }),
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const shapes = r.elements as ShapeElement[];
    expect(shapes.map((s) => s.shape)).toEqual(['square', 'circle', 'diamond']);
    // Rounded lands Large: through the quarter cap it matches Excalidraw's own rounding
    // (docs/specs/008-canvas/corner-radius.md).
    expect(shapes[0]!.borderRadius).toBe('lg');
    expect(shapes[1]!.borderRadius).toBeUndefined();
    expect(shapes[0]!).toMatchObject({
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      fillColor: '#ffec99',
      strokeWidth: 'medium',
    });
    // Excalidraw's near-black ink takes the theme's ink; other colours stay exact.
    expect(shapes[0]!.strokeColor).toBeUndefined();
  });

  it('keeps a colour that is not ink exactly', () => {
    const r = importOnDiagram(scene([rect({ strokeColor: '#1971c2' })]));
    if (!r.ok) throw new Error(r.error);
    expect((r.elements[0] as ShapeElement).strokeColor).toBe('#1971c2');
  });

  it('re-mints ids to fresh UUIDs', () => {
    const r = importOnDiagram(scene([rect()]));
    if (!r.ok) throw new Error(r.error);
    expect(r.elements[0]!.id).not.toBe('r1');
  });

  it('consumes a bound text element as the container label', () => {
    const r = importOnDiagram(
      scene([
        rect(),
        {
          id: 't1',
          type: 'text',
          containerId: 'r1',
          text: 'Hello',
          originalText: 'Hello',
          fontSize: 28,
          strokeColor: '#e03131',
          x: 20,
          y: 40,
          width: 60,
          height: 25,
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements).toHaveLength(1);
    const shape = r.elements[0] as ShapeElement;
    expect(shape.label).toBe('Hello');
    expect(shape.textColor).toBe('#e03131');
    expect(shape.textSize).toBe('lg');
  });

  it('imports standalone text as a text element with strokeColor as ink', () => {
    const r = importOnDiagram(
      scene([
        {
          id: 't1',
          type: 'text',
          x: 0,
          y: 0,
          width: 100,
          height: 25,
          text: 'Note',
          fontSize: 16,
          fontFamily: 3,
          strokeColor: '#2f9e44',
          textAlign: 'center',
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const text = r.elements[0] as TextElement;
    expect(text.type).toBe('text');
    expect(text.label).toBe('Note');
    expect(text.textColor).toBe('#2f9e44');
    expect(text.textSize).toBe('sm');
    expect(text.font).toBe('roboto-mono');
    expect(text.textAlignX).toBe('center');
  });

  it('maps common properties: opacity, angle, lock, link, dash; groups are dropped', () => {
    const r = importOnDiagram(
      scene([
        rect({
          opacity: 50,
          angle: Math.PI / 2,
          groupIds: ['inner', 'outer'],
          locked: true,
          link: 'https://example.com',
          strokeStyle: 'dashed',
          strokeWidth: 4,
        }),
        rect({ id: 'r2', groupIds: ['inner', 'outer'] }),
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const [a, b] = r.elements as ShapeElement[];
    expect(a!).toMatchObject({
      opacity: 0.5,
      rotation: 90,
      locked: true,
      link: { kind: 'url', url: 'https://example.com' },
      strokeStyle: 'dashed',
      strokeWidth: 'thick',
    });
    // livediagram has no groups (docs/specs/009-elements/web-components-and-no-groups.md): grouped Excalidraw elements
    // arrive as separate elements.
    expect('groupId' in a!).toBe(false);
    expect('groupId' in b!).toBe(false);
  });

  it('imports frames as frame shapes with their name', () => {
    const r = importOnDiagram(
      scene([rect({ id: 'f1', type: 'frame', name: 'Flow A', roundness: null })]),
    );
    if (!r.ok) throw new Error(r.error);
    const frame = r.elements[0] as ShapeElement;
    expect(frame.shape).toBe('frame');
    expect(frame.label).toBe('Flow A');
  });

  it('returns no image requests for a scene without images', () => {
    const r = importOnDiagram(scene([rect()]));
    if (!r.ok) throw new Error(r.error);
    expect(r.images).toEqual([]);
  });
});

describe('image migration requests', () => {
  const PNG_URL = 'data:image/png;base64,iVBORw0KGgo=';
  const withFiles = (elements: unknown[], files: unknown) =>
    JSON.stringify({ type: 'excalidraw', version: 2, elements, files });
  const image = (over: Record<string, unknown> = {}) =>
    rect({ id: 'i1', type: 'image', fileId: 'abc', roundness: null, ...over });

  it('lands each image as a placeholder plus a request carrying its bytes', () => {
    const r = importOnDiagram(
      withFiles([image()], { abc: { id: 'abc', mimeType: 'image/png', dataURL: PNG_URL } }),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements[0]).toMatchObject({ type: 'image', imageId: null });
    expect(r.images).toEqual([
      {
        elementId: r.elements[0]!.id,
        key: 'abc',
        source: { kind: 'data-url', dataUrl: PNG_URL },
        hint: { width: 120, height: 60 },
      },
    ]);
  });

  it('keys two elements showing the same file together', () => {
    const r = importOnDiagram(
      withFiles([image({ id: 'i1' }), image({ id: 'i2', x: 400 })], {
        abc: { mimeType: 'image/png', dataURL: PNG_URL },
      }),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.images.map((i) => i.key)).toEqual(['abc', 'abc']);
    expect(new Set(r.images.map((i) => i.elementId)).size).toBe(2);
  });

  it('gives a file the scene lacks a null source (missing bytes)', () => {
    const r = importOnDiagram(withFiles([image()], {}));
    if (!r.ok) throw new Error(r.error);
    expect(r.images[0]!.source).toBeNull();
  });

  it('reads a missing or malformed files map as empty', () => {
    for (const files of [undefined, null, 'nope', [1, 2]]) {
      const r = importOnDiagram(withFiles([image()], files));
      if (!r.ok) throw new Error(r.error);
      expect(r.images[0]!.source).toBeNull();
    }
  });

  it('ignores a file entry without a data URL', () => {
    const r = importOnDiagram(withFiles([image()], { abc: { mimeType: 'image/png' } }));
    if (!r.ok) throw new Error(r.error);
    expect(r.images[0]!.source).toBeNull();
  });

  it('keys an image without a fileId by its own element', () => {
    const r = importOnDiagram(withFiles([image({ fileId: null })], {}));
    if (!r.ok) throw new Error(r.error);
    expect(r.images[0]).toMatchObject({ elementId: r.elements[0]!.id, key: 'i1', source: null });
  });

  it('fills the box when Excalidraw had cropped the image', () => {
    const r = importOnDiagram(
      withFiles([image({ crop: { x: 0, y: 0, width: 10, height: 10 } })], {}),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements[0]).toMatchObject({ objectFit: 'cover' });
  });

  it('leaves an uncropped image at the default fit', () => {
    const r = importOnDiagram(withFiles([image({ crop: null })], {}));
    if (!r.ok) throw new Error(r.error);
    expect(r.elements[0]).not.toHaveProperty('objectFit');
  });
});

describe('arrow + line mapping', () => {
  it('binds arrow endpoints to the nearest anchor of the bound elements', () => {
    const r = importOnDiagram(
      scene([
        rect({ id: 'a', x: 0, y: 0, width: 100, height: 100 }),
        rect({ id: 'b', x: 300, y: 0, width: 100, height: 100 }),
        {
          id: 'ar',
          type: 'arrow',
          x: 100,
          y: 50,
          width: 200,
          height: 0,
          points: [
            [0, 0],
            [200, 0],
          ],
          startBinding: { elementId: 'a', focus: 0, gap: 4 },
          endBinding: { elementId: 'b', focus: 0, gap: 4 },
          startArrowhead: null,
          endArrowhead: 'arrow',
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const arrow = r.elements.find((e) => e.type === 'arrow') as ArrowElement;
    const [a, b] = r.elements.filter((e) => e.type !== 'arrow');
    expect(arrow.from).toEqual({ kind: 'pinned', elementId: a!.id, anchor: 'e' });
    expect(arrow.to).toEqual({ kind: 'pinned', elementId: b!.id, anchor: 'w' });
    expect(arrow.arrowEnds).toBeUndefined(); // 'to' is the default
    expect(arrow.arrowheadShape).toBe('line'); // excalidraw 'arrow' head = open V
  });

  it('maps unbound multi-point arrows to curved arrows with curvePoints', () => {
    const r = importOnDiagram(
      scene([
        {
          id: 'ar',
          type: 'arrow',
          x: 0,
          y: 0,
          points: [
            [0, 0],
            [50, 80],
            [100, 0],
          ],
          startArrowhead: 'triangle',
          endArrowhead: 'triangle',
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const arrow = r.elements[0] as ArrowElement;
    expect(arrow.from).toEqual({ kind: 'free', x: 0, y: 0 });
    expect(arrow.to).toEqual({ kind: 'free', x: 100, y: 0 });
    expect(arrow.arrowStyle).toBe('curved');
    expect(arrow.curvePoints).toEqual([{ dx: 0, dy: 80 }]);
    expect(arrow.arrowEnds).toBe('both');
    // 'triangle' is our default head shape, so the field is omitted.
    expect(arrow.arrowheadShape).toBeUndefined();
  });

  it('maps a 2-point line to a headless arrow', () => {
    const r = importOnDiagram(
      scene([
        {
          id: 'l1',
          type: 'line',
          x: 10,
          y: 10,
          points: [
            [0, 0],
            [90, 40],
          ],
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const arrow = r.elements[0] as ArrowElement;
    expect(arrow.type).toBe('arrow');
    expect(arrow.arrowEnds).toBe('none');
    expect(arrow.to).toEqual({ kind: 'free', x: 100, y: 50 });
  });

  it('maps a closed multi-point line to a closed straight-edged freehand', () => {
    const r = importOnDiagram(
      scene([
        {
          id: 'p1',
          type: 'line',
          x: 0,
          y: 0,
          backgroundColor: '#b2f2bb',
          points: [
            [0, 0],
            [100, 0],
            [50, 80],
            [0, 0],
          ],
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const poly = r.elements[0] as FreehandElement;
    expect(poly.type).toBe('freehand');
    expect(poly.straightEdges).toBe(true);
    expect(poly.closed).toBe(true);
    expect(strokePointCount(poly.packedPoints)).toBe(3); // closing duplicate dropped
    expect(poly.fillColor).toBe('#b2f2bb');
  });

  it('maps freedraw to a normalised freehand stroke', () => {
    const r = importOnDiagram(
      scene([
        {
          id: 'fd',
          type: 'freedraw',
          x: 10,
          y: 10,
          strokeColor: '#1971c2',
          points: [
            [0, 0],
            [40, 20],
            [80, 0],
          ],
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const fh = r.elements[0] as FreehandElement;
    expect(fh.type).toBe('freehand');
    expect(fh.closed).toBe(false);
    expect(fh.straightEdges).toBeUndefined();
    // The points land where Excalidraw had them; the box is the points codec's (a 1 px margin on
    // whole pixels, as a drawn stroke's).
    const onCanvas = freehandCanvasPoints(fh);
    expect(onCanvas).toHaveLength(3);
    for (const [i, [x, y]] of [
      [10, 10],
      [50, 30],
      [90, 10],
    ].entries()) {
      expect(onCanvas[i]!.x).toBeCloseTo(x!, 2);
      expect(onCanvas[i]!.y).toBeCloseTo(y!, 2);
    }
  });

  it('closes a freedraw stroke whose ends coincide', () => {
    // A pencil stroke released near where it started is closed and fills
    // (docs/specs/008-canvas/canvas-and-palette.md), and our exporter writes that the same way it writes a closed
    // polygon: the first point repeated at the end. Closure was gated on
    // `straightEdges`, which only a `line` sets, so this came back open — the
    // sketch rendered hollow and kept the duplicate point as an extra sample.
    const r = importOnDiagram(
      scene([
        {
          id: 'blob',
          type: 'freedraw',
          x: 0,
          y: 0,
          strokeColor: '#1971c2',
          backgroundColor: '#ffd43b',
          points: [
            [0, 0],
            [40, 30],
            [80, 0],
            [0, 0],
          ],
        },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    const fh = r.elements[0] as FreehandElement;
    expect(fh.closed).toBe(true);
    // Still a pencil stroke, not a polygon: corners stay smoothed.
    expect(fh.straightEdges).toBeUndefined();
    // The repeated closing point is dropped rather than kept as a sample.
    expect(strokePointCount(fh.packedPoints)).toBe(3);
  });

  it('round-trips a closed pencil sketch through export and back', () => {
    // The user-facing shape of the bug: export a filled sketch, re-import it,
    // and it came back a hollow outline. Exercised end to end rather than only
    // against a hand-written scene, because the two halves disagreeing about
    // what `closed` means is exactly the defect.
    const sketch: FreehandElement = {
      id: 'sketch',
      type: 'freehand',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      closed: true,
      fillColor: '#ffd43b',
      packedPoints: encodeStrokePoints([
        { nx: 0, ny: 0 },
        { nx: 1, ny: 0.5 },
        { nx: 0.4, ny: 1 },
      ]),
    } as FreehandElement;

    const r = importOnDiagram(tabToExcalidrawText({ id: 't', name: 'T', elements: [sketch] }));
    if (!r.ok) throw new Error(r.error);
    const back = r.elements[0] as FreehandElement;
    expect(back.closed).toBe(true);
    // A pencil sketch, not a polygon — the round trip must not promote it.
    expect(back.straightEdges).toBeUndefined();
    // Sample count preserved: the closing point the exporter appends is
    // dropped again on the way in, not kept as a fourth sample.
    expect(strokePointCount(back.packedPoints)).toBe(3);
  });

  it('attaches a bound label to an arrow', () => {
    const r = importOnDiagram(
      scene([
        {
          id: 'ar',
          type: 'arrow',
          x: 0,
          y: 0,
          points: [
            [0, 0],
            [100, 0],
          ],
        },
        { id: 't1', type: 'text', containerId: 'ar', text: 'yes', x: 40, y: -10 },
      ]),
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.elements).toHaveLength(1);
    expect((r.elements[0] as ArrowElement).label).toBe('yes');
  });
});

describe('Excalidraw import on a whiteboard', () => {
  // A clipboard copy shaped like a real one: a labelled box, an arrow bound to it, a stroke, a
  // sticky note and standalone text, two of them grouped.
  const copy = () => {
    const b = excalidrawBuilder();
    const box = b.rectangle({ x: 0, y: 0, width: 120, height: 60, groupIds: ['g'] });
    const label = b.label(box, 'Read file', { fontSize: 16 });
    const target = b.diamond({ x: 300, y: 0, width: 80, height: 80, strokeColor: '#f08c00' });
    const arrow = b.arrow(
      [
        [0, 0],
        [175, 0],
      ],
      { x: 122, y: 30, strokeColor: '#1971c2' },
      { from: box, to: target },
    );
    const ink = b.freedraw(
      [
        [0, 0],
        [10, 5],
        [20, 0],
      ],
      { x: 0, y: 200 },
    );
    const sticky = b.stickynote({ x: 400, y: 200 });
    const text = b.text('Tools', { x: 0, y: 300, fontSize: 40, groupIds: ['g'] });
    return excalidrawText([box, label, target, arrow, ink, sticky, text]);
  };

  it('lands whiteboard-native elements with fresh ids, arrows pinned to their shapes', () => {
    const r = build(copy(), 'whiteboard');
    if (!r.ok) throw new Error(r.error);
    expect(r.elements.every(isValidElement)).toBe(true);
    expect(r.elements.map((e) => e.type)).toEqual([
      'shape',
      'shape',
      'arrow',
      'freehand',
      'sticky',
      'text',
    ]);
    const [box, diamond, arrow] = r.elements as [ShapeElement, ShapeElement, ArrowElement];
    expect(arrow.from).toMatchObject({ kind: 'pinned', elementId: box.id });
    expect(arrow.to).toMatchObject({ kind: 'pinned', elementId: diamond.id });
    expect(box.label).toBe('Read file');
    expect(r.elements.every((e) => !e.id.startsWith('el-'))).toBe(true);
  });

  it('makes Excalidraw ink adaptive and its stock colours named', () => {
    const r = build(copy(), 'whiteboard');
    if (!r.ok) throw new Error(r.error);
    const [box, diamond, arrow, ink] = r.elements as [
      ShapeElement,
      ShapeElement,
      ArrowElement,
      FreehandElement,
    ];
    expect(box.strokeColor).toBeUndefined();
    expect(box.penColour).toBeUndefined();
    expect(diamond.penColour).toBe('orange');
    expect(arrow.penColour).toBe('blue');
    expect(ink.penColour).toBeUndefined();
    expect(ink.strokeColor).toBeUndefined();
  });

  it('lands the text in the hand-drawn font, reports the dropped group, sets the board pattern', () => {
    const r = build(copy(), 'whiteboard');
    if (!r.ok) throw new Error(r.error);
    const text = r.elements[5] as TextElement;
    expect(text).toMatchObject({ type: 'text', label: 'Tools', font: 'caveat', sizing: 'fit' });
    expect(r.report.degraded).toContainEqual({ rule: 'Groups were dropped', count: 1 });
    expect(r.report.landed).toEqual({ shape: 2, connector: 1, ink: 1, sticky: 1, text: 1 });
    expect(r.backgroundPattern).toBeUndefined();
    expect(r.backgroundColor).toBeUndefined();
  });

  it('refuses what it cannot read with the envelope message', () => {
    expect(build('{"type":"excalidraw/clipboard"}', 'whiteboard')).toEqual({
      ok: false,
      error: 'Scene is missing its elements array.',
    });
  });
});

describe('Excalidraw import background', () => {
  it('takes a saved scene grid as the whiteboard pattern', () => {
    const b = excalidrawBuilder();
    const text = excalidrawText([b.rectangle()], {
      type: 'excalidraw',
      appState: { viewBackgroundColor: '#ffffff', gridModeEnabled: true },
    });
    const r = build(text, 'whiteboard');
    expect(r.ok && r.backgroundPattern).toBe('graph');
    expect(r.ok && r.backgroundColor).toBeUndefined();
  });
});

describe('Excalidraw file and clipboard envelopes', () => {
  // A saved file and a clipboard copy of the same board carry identical elements; only the
  // envelope differs (docs/specs/020-import-export/excalidraw-import-export.md "Envelopes").
  const board = () => {
    const b = excalidrawBuilder();
    const box = b.rectangle({ x: 0, y: 0, width: 120, height: 60 });
    const target = b.diamond({ x: 300, y: 0, strokeColor: '#1971c2' });
    return [
      box,
      b.label(box, 'Box'),
      target,
      b.arrow(
        [
          [0, 0],
          [175, 0],
        ],
        { x: 122, y: 30 },
        { from: box, to: target },
      ),
      b.freedraw(
        [
          [0, 0],
          [10, 5],
          [20, 0],
        ],
        { x: 0, y: 200, strokeColor: '#e03131' },
      ),
      b.text('Title', { x: 0, y: -80, fontSize: 36 }),
      b.stickynote({ x: 400, y: 200 }),
    ];
  };
  const counting = () => {
    let n = 0;
    return () => `id-${++n}`;
  };
  const land = (text: string, profile: 'whiteboard' | 'diagram') => {
    const read = sceneFromExcalidrawText(text);
    if (!read.ok) throw new Error(read.error);
    const landed = landBoardScene(read.scene, {
      profile,
      placement: { kind: 'origin' },
      mintId: counting(),
    });
    if (!landed.ok) throw new Error(landed.message);
    return landed;
  };
  const clipboard = () => excalidrawText(board());
  const file = () =>
    excalidrawText(board(), {
      type: 'excalidraw',
      appState: { viewBackgroundColor: '#ffffff', gridSize: 20, gridModeEnabled: false },
    });

  it.each(['whiteboard', 'diagram'] as const)('land the same elements (%s)', (profile) => {
    const a = land(clipboard(), profile);
    const b = land(file(), profile);
    expect(b.elements).toEqual(a.elements);
    expect(b.report).toEqual(a.report);
  });

  it("leaves a whiteboard's background to the board: a file's canvas colour is not taken", () => {
    expect(land(file(), 'whiteboard').tabPatch.backgroundColor).toBeUndefined();
  });

  it("keeps a file's canvas colour as the diagram tab's background", () => {
    expect(land(file(), 'diagram').tabPatch.backgroundColor).toBe('#ffffff');
    expect(land(clipboard(), 'diagram').tabPatch.backgroundColor).toBeUndefined();
  });
});
