import { describe, it, expect } from 'vitest';
import {
  coerceShapeKind,
  isValidElement,
  isValidTab,
  MAX_ELEMENTS_PER_TAB,
  MAX_PATH_NODES,
  PATH_COORD_MAX,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
} from './validate';
import { SELECTION_MODES } from './selection-mode';
import { IMAGE_CREDIT_TEXT_MAX, IMAGE_CREDIT_URL_MAX } from './image-credit';
import { MAX_FREEHAND_POINTS, encodeStrokePoints } from './stroke-points';

const box = { x: 0, y: 0, width: 100, height: 60 };

describe('isValidElement', () => {
  it('accepts a well-formed shape', () => {
    expect(isValidElement({ id: 'a', type: 'shape', shape: 'square', ...box })).toBe(true);
  });

  it('accepts a pinned arrow', () => {
    expect(
      isValidElement({
        id: 'a',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'b', anchor: 'e' },
        to: { kind: 'free', x: 10, y: 20 },
      }),
    ).toBe(true);
  });

  it('reads the orientation of a lane title as upright or nothing', () => {
    const lane = { id: 'l', type: 'shape', shape: 'lane', ...box };
    expect(isValidElement({ ...lane, titleOrientation: 'upright' })).toBe(true);
    expect(isValidElement({ ...lane, titleOrientation: 'sideways' })).toBe(false);
  });

  it('bounds the exact end of an arrow and its own label width', () => {
    const arrow = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 20 },
    };
    expect(isValidElement({ ...arrow, exactEnd: true, labelMaxWidth: 180 })).toBe(true);
    expect(isValidElement({ ...arrow, exactEnd: 'yes' })).toBe(false);
    expect(isValidElement({ ...arrow, labelMaxWidth: 0 })).toBe(false);
    expect(isValidElement({ ...arrow, labelMaxWidth: Number.NaN })).toBe(false);
  });

  it('accepts table / image / freehand / text', () => {
    expect(isValidElement({ id: 't', type: 'table', cells: [['a', 'b']], ...box })).toBe(true);
    expect(isValidElement({ id: 'i', type: 'image', imageId: null, ...box })).toBe(true);
    expect(
      isValidElement({
        id: 'f',
        type: 'freehand',
        closed: false,
        packedPoints: encodeStrokePoints([{ nx: 0, ny: 0 }]),
        ...box,
      }),
    ).toBe(true);
    expect(isValidElement({ id: 'x', type: 'text', ...box })).toBe(true);
  });

  it('bounds the code block + checklist fields (docs/specs/009-elements/code-block.md, docs/specs/009-elements/checklist.md)', () => {
    const shape = (o: object) => ({ id: 's', type: 'shape', shape: 'code-block', ...box, ...o });
    expect(isValidElement(shape({ code: 'const x = 1;', codeLanguage: 'ts' }))).toBe(true);
    expect(isValidElement(shape({ code: 'x'.repeat(4001) }))).toBe(false);
    expect(isValidElement(shape({ codeLanguage: 'brainfuck' }))).toBe(false);
    const list = (items: unknown) =>
      isValidElement({ id: 'c', type: 'shape', shape: 'checklist', ...box, checklistItems: items });
    expect(list([{ text: 'Task', done: false }])).toBe(true);
    expect(list([{ text: 'Task', done: 'yes' }])).toBe(false);
    expect(list([{ text: 42, done: true }])).toBe(false);
    expect(list(Array.from({ length: 31 }, () => ({ text: 't', done: false })))).toBe(false);
  });

  it('accepts the freehand pen + straightEdges flags, rejects junk values', () => {
    const freehand = { id: 'f', type: 'freehand', closed: false, packedPoints: 'AQA=', ...box };
    // Highlighter recipe (docs/specs/008-canvas/highlighter.md) + polygon straight edges (docs/specs/008-canvas/polygon-tool.md).
    expect(isValidElement({ ...freehand, pen: 'highlighter' })).toBe(true);
    expect(isValidElement({ ...freehand, straightEdges: true })).toBe(true);
    expect(isValidElement({ ...freehand, pen: 'marker' })).toBe(false);
    expect(isValidElement({ ...freehand, straightEdges: 'yes' })).toBe(false);
    expect(isValidElement({ ...freehand, pen: 'highlighter', penWidth: 22 })).toBe(true);
    expect(isValidElement({ ...freehand, penWidth: 0 })).toBe(false);
    expect(isValidElement({ ...freehand, penWidth: 101 })).toBe(false);
  });

  it('accepts a whiteboard pen stroke\u2019s packed pressures and streamline, rejects junk', () => {
    // docs/specs/023-whiteboard/whiteboard.md "Pens": a pressure per point, 0 to 1, packed.
    const points = [
      { nx: 0, ny: 0 },
      { nx: 1, ny: 1 },
    ];
    const packedPoints = encodeStrokePoints(points, [0, 1]);
    const pen = { id: 'f', type: 'freehand', closed: false, packedPoints, penWidth: 1.5, ...box };
    expect(isValidElement({ ...pen, streamline: 0.2 })).toBe(true);
    expect(isValidElement({ ...pen, streamline: -0.1 })).toBe(false);
    expect(isValidElement({ ...pen, streamline: 2 })).toBe(false);
  });

  it('accepts a marker\u2019s named colour on a stroke, a shape or a line, rejects any other', () => {
    // docs/specs/023-whiteboard/whiteboard.md "The colour picker": stored by name.
    const packedPoints = encodeStrokePoints([
      { nx: 0, ny: 0 },
      { nx: 1, ny: 1 },
    ]);
    const pen = { id: 'f', type: 'freehand', closed: false, packedPoints, penWidth: 1.5, ...box };
    const shape = { id: 's', type: 'shape', shape: 'circle', ...box };
    const line = {
      id: 'l',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 9, y: 9 },
    };
    const path = {
      id: 'p',
      type: 'path',
      closed: false,
      nodes: [
        { nx: 0, ny: 0, mode: 'corner' },
        { nx: 1, ny: 1, mode: 'corner' },
      ],
      ...box,
    };
    for (const el of [pen, shape, line, path]) {
      expect(isValidElement({ ...el, penColour: 'blue' })).toBe(true);
      expect(isValidElement({ ...el, penColour: 'blue-3' })).toBe(false);
      expect(isValidElement({ ...el, penColour: '#1d7afc' })).toBe(false);
    }
  });

  // docs/specs/023-whiteboard/whiteboard.md "Imported and pasted content": a text box's and a
  // shape label's stock colour, stored by name.
  it('accepts a named text colour and rejects anything else in its place', () => {
    const text = { id: 't', type: 'text', label: 'Hi', ...box };
    const shape = { id: 's', type: 'shape', shape: 'square', label: 'Hi', ...box };
    for (const el of [text, shape]) {
      expect(isValidElement({ ...el, penTextColour: 'green' })).toBe(true);
      // Ink is a stock colour by name (docs/specs/007-editor/editor-modes.md "One look").
      expect(isValidElement({ ...el, penTextColour: 'ink' })).toBe(true);
      expect(isValidElement({ ...el, penTextColour: 'chalk' })).toBe(false);
      expect(isValidElement({ ...el, penTextColour: '#2f9e44' })).toBe(false);
      expect(isValidElement({ ...el, penTextColour: 3 })).toBe(false);
    }
  });

  it('rejects a non-object / missing id / unknown type', () => {
    expect(isValidElement(null)).toBe(false);
    expect(isValidElement({ type: 'shape', shape: 'square', ...box })).toBe(false);
    expect(isValidElement({ id: 'a', type: 'wormhole', ...box })).toBe(false);
  });

  it('rejects a boxed element with a non-numeric / missing box', () => {
    expect(isValidElement({ id: 'a', type: 'shape', shape: 'square', x: 0, y: 0 })).toBe(false);
    expect(
      isValidElement({
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: '0',
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toBe(false);
    expect(
      isValidElement({
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: NaN,
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toBe(false);
  });

  it('rejects a shape with no kind and an arrow with a bad endpoint', () => {
    expect(isValidElement({ id: 'a', type: 'shape', ...box })).toBe(false);
    expect(
      isValidElement({
        id: 'a',
        type: 'arrow',
        from: { kind: 'pinned', anchor: 'zz' },
        to: { kind: 'free', x: 0, y: 0 },
      }),
    ).toBe(false);
    expect(isValidElement({ id: 'a', type: 'arrow', from: { kind: 'free', x: 0, y: 0 } })).toBe(
      false,
    );
  });

  it('accepts all sixteen anchors and rejects any other id (docs/specs/008-canvas/arrow-anchors.md)', () => {
    const arrowTo = (anchor: string) => ({
      id: 'a',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'b', anchor },
      to: { kind: 'free', x: 0, y: 0 },
    });
    for (const anchor of ['nne', 'ene', 'ese', 'sse', 'ssw', 'wsw', 'wnw', 'nnw', 'ne', 'n']) {
      expect(isValidElement(arrowTo(anchor))).toBe(true);
    }
    expect(isValidElement(arrowTo('nnn'))).toBe(false);
  });

  it('rejects over-cap arrays (freehand points, table cells)', () => {
    const bytes = new Uint8Array(2 + (MAX_FREEHAND_POINTS + 1) * 4);
    bytes[0] = 1;
    const packedPoints = Buffer.from(bytes).toString('base64');
    expect(isValidElement({ id: 'f', type: 'freehand', closed: false, packedPoints, ...box })).toBe(
      false,
    );
  });

  it('accepts packed stroke points and rejects the former shape or a corrupt block', () => {
    // docs/specs/006-document/stroke-points.md "Validation".
    const stroke = { id: 'f', type: 'freehand', closed: false, ...box };
    const packedPoints = encodeStrokePoints([{ nx: 0.5, ny: 0.5 }], [0.5]);
    expect(isValidElement({ ...stroke, packedPoints })).toBe(true);
    expect(isValidElement({ ...stroke, packedPoints: 'AQA=' })).toBe(true);
    expect(isValidElement(stroke)).toBe(false);
    expect(isValidElement({ ...stroke, points: [{ nx: 0, ny: 0 }] })).toBe(false);
    expect(isValidElement({ ...stroke, packedPoints, points: [] })).toBe(false);
    expect(isValidElement({ ...stroke, packedPoints, pressures: [0.5] })).toBe(false);
    expect(isValidElement({ ...stroke, packedPoints: 'AQ*=' })).toBe(false);
    expect(isValidElement({ ...stroke, packedPoints: 'AgA=' })).toBe(false);
  });
});

describe('image credit (docs/specs/009-elements/image-search.md)', () => {
  const image = (credit: unknown) => ({ id: 'i', type: 'image', imageId: 'abc', ...box, credit });
  const good = {
    text: '"Cat" by admiller, CC BY 2.0',
    sourceUrl: 'https://www.flickr.com/photos/1/2',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  };

  it('accepts a credit, with or without a licence link', () => {
    expect(isValidElement(image(good))).toBe(true);
    expect(isValidElement(image({ text: good.text, sourceUrl: 'http://example.org/' }))).toBe(true);
  });

  it('rejects empty or over-long text', () => {
    expect(isValidElement(image({ ...good, text: '' }))).toBe(false);
    expect(isValidElement(image({ ...good, text: 'x'.repeat(IMAGE_CREDIT_TEXT_MAX + 1) }))).toBe(
      false,
    );
  });

  it('rejects non-http links and over-long links', () => {
    expect(isValidElement(image({ ...good, sourceUrl: 'javascript:alert(1)' }))).toBe(false);
    expect(isValidElement(image({ ...good, licenseUrl: 'data:text/html,x' }))).toBe(false);
    const long = `https://e.org/${'a'.repeat(IMAGE_CREDIT_URL_MAX)}`;
    expect(isValidElement(image({ ...good, sourceUrl: long }))).toBe(false);
  });

  it('rejects a credit that is not an object', () => {
    expect(isValidElement(image('by admiller'))).toBe(false);
    expect(isValidElement(image(null))).toBe(false);
  });
});

describe('path validation (docs/specs/023-whiteboard/path-tool.md)', () => {
  const node = (nx: number, ny: number) => ({ nx, ny, mode: 'corner' });
  const path = (extra: Record<string, unknown> = {}) => ({
    id: 'p',
    type: 'path',
    closed: false,
    nodes: [node(0, 0), node(1, 1)],
    ...box,
    ...extra,
  });

  it('accepts an open path, a closed one, and handles in every mode', () => {
    expect(isValidElement(path())).toBe(true);
    expect(
      isValidElement(path({ closed: true, nodes: [node(0, 0), node(1, 0), node(0, 1)] })),
    ).toBe(true);
    const smooth = {
      nx: 0.5,
      ny: 0.5,
      mode: 'mirrored',
      handleIn: { nx: -0.2, ny: 0.5 },
      handleOut: { nx: 1.2, ny: 0.5 },
    };
    expect(
      isValidElement(path({ nodes: [node(0, 0), smooth, { ...smooth, mode: 'aligned' }] })),
    ).toBe(true);
    expect(
      isValidElement(path({ strokeWidth: 'thick', strokeStyle: 'dashed', strokeSwatch: 2 })),
    ).toBe(true);
  });

  it('rejects too few nodes, and a closed pair with no handle', () => {
    expect(isValidElement(path({ nodes: [node(0, 0)] }))).toBe(false);
    expect(isValidElement(path({ closed: true }))).toBe(false);
    const bent = { ...node(0, 0), handleOut: { nx: 0.5, ny: -1 } };
    expect(isValidElement(path({ closed: true, nodes: [bent, node(1, 1)] }))).toBe(true);
  });

  it('rejects malformed nodes, modes, handles and flags', () => {
    expect(isValidElement(path({ closed: 'no' }))).toBe(false);
    expect(isValidElement(path({ nodes: 'nope' }))).toBe(false);
    expect(isValidElement(path({ nodes: [node(0, 0), { nx: 1, ny: 1, mode: 'smooth' }] }))).toBe(
      false,
    );
    expect(isValidElement(path({ nodes: [node(0, 0), { nx: 1, mode: 'corner' }] }))).toBe(false);
    expect(
      isValidElement(path({ nodes: [node(0, 0), { ...node(1, 1), handleIn: { nx: 1 } }] })),
    ).toBe(false);
    expect(isValidElement(path({ nodes: [node(0, 0), { ...node(1, 1), handleOut: 3 }] }))).toBe(
      false,
    );
    expect(isValidElement(path({ nodes: [node(0, 0), node(PATH_COORD_MAX * 2, 0)] }))).toBe(false);
  });

  it('rejects more than MAX_PATH_NODES nodes', () => {
    const nodes = Array.from({ length: MAX_PATH_NODES + 1 }, () => node(0, 0));
    expect(isValidElement(path({ nodes }))).toBe(false);
  });
});

describe('isValidTab', () => {
  it('accepts a tab of valid elements', () => {
    expect(
      isValidTab({
        id: 't',
        name: 'Tab',
        elements: [{ id: 'a', type: 'shape', shape: 'square', ...box }],
      }),
    ).toBe(true);
  });

  it('accepts an empty tab', () => {
    expect(isValidTab({ id: 't', name: '', elements: [] })).toBe(true);
  });

  it('rejects a missing id/name or non-array elements', () => {
    expect(isValidTab({ name: 'x', elements: [] })).toBe(false);
    expect(isValidTab({ id: 't', elements: [] })).toBe(false);
    expect(isValidTab({ id: 't', name: 'x', elements: {} })).toBe(false);
  });

  it('rejects a tab containing an invalid element', () => {
    expect(isValidTab({ id: 't', name: 'x', elements: [{ id: 'a', type: 'shape', ...box }] })).toBe(
      false,
    );
  });

  it('rejects duplicate element ids', () => {
    const el = { id: 'dup', type: 'shape', shape: 'square', ...box };
    expect(isValidTab({ id: 't', name: 'x', elements: [el, { ...el }] })).toBe(false);
  });

  it('rejects an over-cap element count', () => {
    const els = Array.from({ length: MAX_ELEMENTS_PER_TAB + 1 }, (_, i) => ({
      id: `e${i}`,
      type: 'shape',
      shape: 'square',
      ...box,
    }));
    expect(isValidTab({ id: 't', name: 'x', elements: els })).toBe(false);
  });
});

describe('coerceShapeKind', () => {
  it('keeps a real kind', () => {
    expect(coerceShapeKind('square')).toBe('square');
    expect(coerceShapeKind('diamond')).toBe('diamond');
    expect(coerceShapeKind('cylinder')).toBe('cylinder');
  });
  it('coerces an off-vocabulary or junk kind to square', () => {
    expect(coerceShapeKind('rectangle')).toBe('square'); // the bug: not a real kind
    expect(coerceShapeKind('box')).toBe('square');
    expect(coerceShapeKind('oval')).toBe('square');
    expect(coerceShapeKind(undefined)).toBe('square');
    expect(coerceShapeKind(42)).toBe('square');
  });
});

describe('mode button validation (docs/specs/009-elements/mode-button.md)', () => {
  const button = {
    id: 'b1',
    type: 'shape',
    shape: 'mode-button',
    x: 0,
    y: 0,
    width: 180,
    height: 44,
  };

  it('accepts a button with no mode (it falls back to the Avatar default)', () => {
    expect(isValidElement(button)).toBe(true);
  });

  it('accepts every selection mode the editor can switch to', () => {
    for (const mode of SELECTION_MODES) {
      expect(isValidElement({ ...button, mode })).toBe(true);
    }
  });

  it('rejects a mode outside the vocabulary rather than silently rewriting it', () => {
    expect(isValidElement({ ...button, mode: 'teleport' })).toBe(false);
    expect(isValidElement({ ...button, mode: 42 })).toBe(false);
  });
});

describe('quick-swatch bindings (docs/specs/008-canvas/quick-style-panel.md)', () => {
  const shape = { id: 's', type: 'shape', shape: 'square', ...box };
  const arrow = {
    id: 'a',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 10, y: 0 },
  };

  it('accepts a slot from 1 to 6 on a shape and an arrow', () => {
    expect(isValidElement({ ...shape, strokeSwatch: 1, fillSwatch: 6 })).toBe(true);
    expect(isValidElement({ ...arrow, strokeSwatch: 3 })).toBe(true);
  });

  it('rejects anything else, rather than coercing it', () => {
    expect(isValidElement({ ...shape, fillSwatch: 0 })).toBe(false);
    expect(isValidElement({ ...shape, strokeSwatch: '2' })).toBe(false);
    expect(isValidElement({ ...arrow, strokeSwatch: 7 })).toBe(false);
  });
});

// docs/specs/023-whiteboard/whiteboard.md "Text boxes": a text box's hug fields.
describe('text box validation', () => {
  const text = { id: 't', type: 'text', x: 0, y: 0, width: 40, height: 22, label: 'Hi' };

  it('takes an auto width and a Shift scale in range', () => {
    expect(isValidElement({ ...text, autoWidth: true, textScale: 2.5 })).toBe(true);
    expect(isValidElement({ ...text, textScale: TEXT_SCALE_MIN })).toBe(true);
    expect(isValidElement({ ...text, textScale: TEXT_SCALE_MAX })).toBe(true);
  });

  it('refuses a scale out of range and a non-boolean auto width', () => {
    expect(isValidElement({ ...text, textScale: 0 })).toBe(false);
    expect(isValidElement({ ...text, textScale: TEXT_SCALE_MAX + 1 })).toBe(false);
    expect(isValidElement({ ...text, textScale: Number.NaN })).toBe(false);
    expect(isValidElement({ ...text, autoWidth: 'yes' })).toBe(false);
  });
});
