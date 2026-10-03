import { describe, expect, it, vi } from 'vitest';
import { entityHeight, isValidTab } from '@livediagram/document';
import {
  lanesToFront,
  mergeElementUpdate,
  normaliseElement,
  normaliseElements,
} from './element-normalise';

// docs/specs/015-api/mcp-server.md §4.7a: the content-carrying kinds are made safe before validation.

const box = { x: 0, y: 0, width: 200, height: 100 };
const valid = (elements: unknown[]) => isValidTab({ id: 't', name: 'T', elements });

describe('content kinds', () => {
  it('pads a ragged table', () => {
    const [t] = normaliseElements([
      { id: 't', type: 'table', ...box, cells: [['a', 'b', 'c'], ['d'], [1, 2]] },
    ]) as { cells: string[][] }[];
    expect(t!.cells).toEqual([
      ['a', 'b', 'c'],
      ['d', '', ''],
      ['1', '2', ''],
    ]);
  });

  it('turns an unknown code language plain and drops an unknown theme, so the tab validates', () => {
    const els = normaliseElements([
      {
        id: 'c',
        type: 'shape',
        shape: 'code-block',
        ...box,
        code: 'x',
        codeLanguage: 'rust',
        codeTheme: 'dracula',
      },
    ]);
    expect(els[0]).toMatchObject({ codeLanguage: 'plain' });
    expect(els[0]).not.toHaveProperty('codeTheme');
    expect(valid(els)).toBe(true);
  });

  it('aligns an entity title top-left and grows the box to its rows', () => {
    const fields = Array.from({ length: 6 }, (_, i) => ({ name: `f${i}`, type: 'text' }));
    const [e] = normaliseElements([
      { id: 'e', type: 'shape', shape: 'entity', ...box, label: 'User', entityFields: fields },
    ]);
    expect(e).toMatchObject({
      textAlignX: 'left',
      textAlignY: 'top',
      height: entityHeight(6, 'md'),
    });
  });

  it('keeps an alignment the model chose', () => {
    const lane = normaliseElement({
      id: 'l',
      type: 'shape',
      shape: 'lane',
      ...box,
      textAlignX: 'right',
    });
    expect(lane).toMatchObject({ textAlignX: 'right', padding: 'lg' });
  });

  it('coerces chart data and fits each series to the categories', () => {
    const [pie, line] = normaliseElements([
      {
        id: 'p',
        type: 'shape',
        shape: 'pie-chart',
        ...box,
        pieSlices: [{ label: 'A', value: '3' }, { label: 2, value: -1 }, 'junk'],
      },
      {
        id: 'l',
        type: 'shape',
        shape: 'line-chart',
        ...box,
        lineCategories: ['Q1', 'Q2', 'Q3'],
        lineSeries: [
          { name: 'Rev', values: [1, 'x'] },
          { name: 'Cost', values: [1, 2, 3, 4] },
        ],
      },
    ]);
    expect(pie).toMatchObject({
      pieSlices: [
        { label: 'A', value: 3 },
        { label: '2', value: 0 },
      ],
    });
    expect(line).toMatchObject({
      lineSeries: [
        { name: 'Rev', values: [1, 0, 0] },
        { name: 'Cost', values: [1, 2, 3] },
      ],
    });
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

  it('moves lanes to the front, keeping their order', () => {
    const ids = lanesToFront([
      { id: 'a', type: 'shape', shape: 'square' },
      { id: 'l1', type: 'shape', shape: 'lane' },
      { id: 'b', type: 'sticky' },
      { id: 'l2', type: 'shape', shape: 'lane' },
    ]).map((e) => e.id);
    expect(ids).toEqual(['l1', 'l2', 'a', 'b']);
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
