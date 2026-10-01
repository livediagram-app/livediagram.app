import { describe, expect, it } from 'vitest';
import { STICKY_PRESETS, isValidElement } from '@livediagram/document';
import { createLandContext } from './context';
import { landFrame, landImage, landShape, landSticky, landText } from './land-boxes';
import type { SceneAsset, SceneShape, SceneText } from './scene';

// docs/specs/020-import-export/board-scene.md "Kinds": the boxed kinds on a whiteboard.
const box = { x: 10, y: 20, width: 100, height: 60 };
const label = (over: Partial<SceneText> = {}): SceneText => ({
  text: 'Label',
  fontPx: 20,
  family: 'hand',
  colour: 'ink',
  alignX: 'center',
  alignY: 'middle',
  ...over,
});
const shape = (over: Partial<SceneShape> = {}): SceneShape => ({
  key: 's',
  kind: 'shape',
  shape: 'rectangle',
  ...box,
  stroke: { colour: { hex: '#1e1e1e' }, widthPx: 2 },
  ...over,
});

describe('landShape', () => {
  it.each([
    ['rectangle', 'square'],
    ['ellipse', 'circle'],
    ['diamond', 'diamond'],
    ['triangle', 'triangle'],
  ] as const)('lands a %s as a %s', (kind, ours) => {
    const el = landShape(shape({ shape: kind }), 'id', createLandContext());
    expect(el.shape).toBe(ours);
    expect(isValidElement(el)).toBe(true);
  });

  it('draws in the ink, unfilled, at the default border', () => {
    const el = landShape(shape(), 'id', createLandContext());
    expect(el.strokeColor).toBeUndefined();
    expect(el.penColour).toBeUndefined();
    expect(el.fillColor).toBeUndefined();
    expect(el.strokeWidth).toBeUndefined();
    expect({ x: el.x, y: el.y, width: el.width, height: el.height }).toEqual(box);
  });

  it('keeps rounding, dash, width, colours, fill and its label', () => {
    const el = landShape(
      shape({
        rounded: true,
        stroke: { colour: { hex: '#2f9e44' }, widthPx: 4, dash: 'dashed' },
        fill: { hex: '#ffc9c9' },
        label: label({ colour: { hex: '#e03131' } }),
      }),
      'id',
      createLandContext(),
    );
    expect(el).toMatchObject({
      borderRadius: 'md',
      strokeWidth: 'thick',
      strokeStyle: 'dashed',
      penColour: 'green',
      fillColor: '#ffc9c9',
      label: 'Label',
      font: 'caveat',
      textAlignX: 'center',
      textAlignY: 'middle',
      penTextColour: 'red',
    });
  });

  it('has no border without a stroke', () => {
    expect(
      landShape(shape({ stroke: null, fill: { hex: '#ffc9c9' } }), 'id', createLandContext())
        .strokeWidth,
    ).toBe('none');
  });
});

describe('landText', () => {
  it('lands a hugging text box at its size', () => {
    const el = landText(
      {
        key: 't',
        kind: 'text',
        ...box,
        autoWidth: true,
        text: label({ fontPx: 28, alignX: 'left', alignY: 'top' }),
      },
      'id',
      createLandContext(),
    )!;
    expect(isValidElement(el)).toBe(true);
    expect(el).toMatchObject({ type: 'text', autoWidth: true, label: 'Label', textSize: 'lg' });
    expect(32 * el.textScale!).toBeCloseTo(28, 6);
  });

  it('skips empty text', () => {
    expect(
      landText(
        { key: 't', kind: 'text', ...box, autoWidth: false, text: label({ text: '  ' }) },
        'id',
        createLandContext(),
      ),
    ).toBeNull();
  });
});

describe('landSticky', () => {
  it('lands on the nearest preset paper with its ink', () => {
    const lemon = STICKY_PRESETS.find((p) => p.id === 'sticky-lemon')!;
    const el = landSticky(
      { key: 'n', kind: 'sticky', ...box, fill: { hex: lemon.fill }, text: label() },
      'id',
      createLandContext(),
    );
    expect(isValidElement(el)).toBe(true);
    expect(el).toMatchObject({ fillColor: lemon.fill, textColor: lemon.text, label: 'Label' });
  });

  it('keeps a text colour of its own', () => {
    const el = landSticky(
      {
        key: 'n',
        kind: 'sticky',
        ...box,
        fill: { hex: '#ffdf6b' },
        text: label({ colour: { hex: '#1971c2' } }),
      },
      'id',
      createLandContext(),
    );
    expect(el.penTextColour).toBe('blue');
    expect(el.textColor).toBeUndefined();
  });
});

describe('landImage', () => {
  const assets = new Map<string, SceneAsset>([
    ['a', { key: 'a', source: { kind: 'data-url', dataUrl: 'data:image/png;base64,AAAA' } }],
    [
      'b',
      {
        key: 'b',
        source: { kind: 'bytes', bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' },
      },
    ],
  ]);

  it('lands a placeholder and asks the pipeline for its bytes', () => {
    const { element, request } = landImage(
      { key: 'i', kind: 'image', ...box, asset: 'a', crop: true },
      'id',
      createLandContext(),
      assets,
    );
    expect(isValidElement(element)).toBe(true);
    expect(element).toMatchObject({ type: 'image', imageId: null, objectFit: 'cover' });
    expect(request).toEqual({
      elementId: 'id',
      key: 'a',
      source: { kind: 'data-url', dataUrl: 'data:image/png;base64,AAAA' },
      hint: { width: 100, height: 60 },
    });
  });

  it('hands raw bytes over as a typed blob', async () => {
    const { request } = landImage(
      { key: 'i', kind: 'image', ...box, asset: 'b' },
      'id',
      createLandContext(),
      assets,
    );
    expect(request.source?.kind).toBe('blob');
    const blob = (request.source as { blob: Blob }).blob;
    expect(blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('asks with no source when the asset is missing', () => {
    const { request } = landImage(
      { key: 'i', kind: 'image', ...box, asset: 'zz' },
      'id',
      createLandContext(),
      assets,
    );
    expect(request.source).toBeNull();
  });
});

describe('landFrame', () => {
  it('lands a frame named by its label', () => {
    const el = landFrame(
      { key: 'f', kind: 'frame', ...box, name: ' Testing ' },
      'id',
      createLandContext(),
    );
    expect(isValidElement(el)).toBe(true);
    expect(el).toMatchObject({ shape: 'frame', label: 'Testing' });
    expect(
      landFrame({ key: 'f', kind: 'frame', ...box }, 'id', createLandContext()).label,
    ).toBeUndefined();
  });
});
