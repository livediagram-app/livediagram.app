import { describe, expect, it, vi } from 'vitest';
import { createShape, isValidElement, isValidTab } from './index';
import { mergeElementUpdate, normaliseElement, normaliseElements } from './element-normalise';

// livediagram/docs/specs/015-api/mcp-server.md §4.7a: the content-carrying kinds are made safe before validation.

const box = { x: 0, y: 0, width: 200, height: 100 };
const valid = (elements: unknown[]) => isValidTab({ id: 't', name: 'T', elements });

describe('content kinds', () => {
  it('leaves a stored table exactly as it came', () => {
    const table = { id: 't', type: 'table', ...box, cells: [['a', 'b', 'c'], ['d'], [1, 2]] };
    expect(normaliseElements([structuredClone(table)])).toEqual([table]);
  });

  it('keeps an alignment the model chose', () => {
    const square = normaliseElement({
      id: 'l',
      type: 'shape',
      shape: 'square',
      ...box,
      textAlignX: 'right',
    });
    expect(square).toMatchObject({ textAlignX: 'right' });
  });

  it('gives a coloured sticky the borderless palette look', () => {
    expect(
      normaliseElement({ id: 's', type: 'sticky', ...box, fillColor: '#bae6fd' }),
    ).toMatchObject({
      strokeColor: 'transparent',
    });
    expect(normaliseElement({ id: 's', type: 'sticky', ...box })).not.toHaveProperty('strokeColor');
  });

  it("gives an element without a text size the editor's size for its kind", () => {
    const [shape, text, sticky, sized] = normaliseElements([
      { id: 'a', type: 'shape', shape: 'square', ...box },
      { id: 'b', type: 'text', ...box },
      { id: 'c', type: 'sticky', ...box },
      { id: 'd', type: 'shape', shape: 'square', ...box, textSize: 'scale' },
    ]);
    expect(shape).toMatchObject({ textSize: 'md' });
    expect(text).toMatchObject({ textSize: 'sm' });
    expect(sticky).toMatchObject({ textSize: 'md' });
    expect(sized).toMatchObject({ textSize: 'scale' });
  });

  it('leaves anything that is not an element list for validation to reject', () => {
    expect(normaliseElements('nope')).toBe('nope');
    expect(normaliseElements([null, 3])).toEqual([null, 3]);
  });
});

describe('freehand strokes (docs/specs/006-document/stroke-points.md)', () => {
  const former = {
    id: 'f',
    type: 'freehand',
    ...box,
    closed: false,
    points: [
      { nx: 0, ny: 0 },
      { nx: 1, ny: 1 },
    ],
  };

  it('packs a stroke a model wrote in the former { nx, ny } shape, so the tab validates', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const [f] = normaliseElements([former]) as { packedPoints?: string; points?: unknown }[];
    expect(typeof f!.packedPoints).toBe('string');
    expect(f!.points).toBeUndefined();
    expect(valid([f])).toBe(true);
  });

  it('leaves a packed stroke exactly as it was read', () => {
    const packed = { id: 'f', type: 'freehand', ...box, closed: false, packedPoints: 'AQAAAAAA' };
    expect(normaliseElement(packed)).toEqual(packed);
  });
});

describe('mergeElementUpdate', () => {
  const packed = { id: 'f', type: 'freehand', ...box, closed: false, packedPoints: 'AQAAAAAA' };

  it('lays the model\u2019s fields over the element\u2019s', () => {
    expect(mergeElementUpdate(packed, { x: 40 })).toEqual({ ...packed, x: 40 });
    expect(mergeElementUpdate(undefined, { id: 'n' })).toEqual({ id: 'n' });
    expect(mergeElementUpdate(packed, undefined)).toEqual(packed);
  });

  it('lets new former-shape points replace the packed ones, which then pack', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const points = [
      { nx: 0, ny: 1 },
      { nx: 1, ny: 0 },
    ];
    const merged = mergeElementUpdate(packed, { points });
    expect(merged).not.toHaveProperty('packedPoints');
    const [f] = normaliseElements([merged]) as { packedPoints: string }[];
    expect(f!.packedPoints).not.toBe(packed.packedPoints);
    expect(valid([f])).toBe(true);
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: a badge, a step, a pointer note and a
// Timeline are retired kinds. Nothing settles, attaches, numbers or trims them: each comes back as it was sent.
describe('retired layout kinds through normaliseElements', () => {
  it('leaves an attached badge and pointer note, and a Timeline, as they were', () => {
    const host = { ...createShape('square', 100, 100), id: 'host', width: 120, height: 60 };
    const badge = {
      id: 'b',
      type: 'shape',
      shape: 'badge',
      ...box,
      attachedTo: 'host',
      attachAt: 'top-right',
      chipLook: 'tinted',
    };
    const note = {
      id: 'n',
      type: 'shape',
      shape: 'pointer-note',
      ...box,
      attachedTo: 'gone',
      attachAt: 'top-left',
      pointerTip: { x: -200, y: 80 },
    };
    const rail = {
      id: 'r',
      type: 'shape',
      shape: 'timeline-rail',
      ...box,
      conceptRows: Array.from({ length: 10 }, (_, i) => ({ label: `R${i + 1}` })),
      railCount: 4,
    };
    const [, b, n, r] = normaliseElements([host, badge, note, rail]) as Record<string, unknown>[];
    expect(b).toMatchObject({
      attachedTo: 'host',
      attachAt: 'top-right',
      chipLook: 'tinted',
      ...box,
    });
    expect(n).toMatchObject({ attachedTo: 'gone', pointerTip: { x: -200, y: 80 }, ...box });
    expect((r!.conceptRows as unknown[]).length).toBe(10);
    expect(r!.railCount).toBe(4);
  });
});

describe('an agent’s labels', () => {
  it('writes a numbered label as text, valid', () => {
    const shape = { ...createShape('square', 0, 0), id: 's', label: 5 };
    const [out] = normaliseElements([shape]) as Record<string, unknown>[];
    expect(out!.label).toBe('5');
    expect(isValidElement(out as never)).toBe(true);
  });

  it('leaves a label it cannot read for validation to refuse, rather than throwing', () => {
    const shape = { ...createShape('square', 0, 0), id: 's', label: { n: 5 } };
    let out: unknown;
    expect(() => (out = normaliseElements([shape]))).not.toThrow();
    expect(isValidElement((out as unknown[])[0] as never)).toBe(false);
  });
});
