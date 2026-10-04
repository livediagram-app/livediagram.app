import { describe, expect, it } from 'vitest';
import { computeRefs, type Element } from '@livediagram/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { edgeJson, edgesOf, edgeText, ownLineText } from './edges';

describe('edgesOf (R12)', () => {
  const a = shapeAt('square', 'a', 0, 0);
  const b = shapeAt('square', 'b', 200, 0);
  const elements: Element[] = [
    a,
    b,
    arrowBetween('ab', 'a', 'b', { label: 'charge' }),
    arrowBetween('ab2', 'a', 'b', { strokeStyle: 'dashed', arrowEnds: 'both' }),
    arrowBetween('aa', 'a', 'a'),
    { ...arrowBetween('free-src', 'a', 'b'), from: { kind: 'free', x: 5, y: 6 } },
    { ...arrowBetween('on-arrow', 'a', 'b'), from: { kind: 'on-arrow', arrowId: 'ab', t: 0.5 } },
    { ...arrowBetween('to-free', 'b', 'a'), to: { kind: 'free', x: 1, y: 2 } },
    arrowBetween('dangling', 'gone', 'a', { arrowEnds: 'none', strokeStyle: 'solid' }),
  ];
  const refs = computeRefs(elements.map((el) => el.id));
  const edges = edgesOf(elements, refs, new Set(['a', 'b']));

  it('puts pinned-source arrows on their source in array order, parallel and self-loops included', () => {
    expect(edges.bySource.get('a')!.map((e) => edgeText(e))).toEqual([
      'b "charge"',
      'b ~dashed ~both',
      'a',
    ]);
    expect(edges.bySource.get('b')!.map((e) => edgeText(e))).toEqual(['free']);
  });

  it('puts free, on-arrow and dangling sources on their own line (E8)', () => {
    expect(edges.ownLine.map((e) => ownLineText(e))).toEqual([
      'arrow free-src free → b',
      'arrow on-arrow arrow:ab → b',
      'arrow dangling id:"gone" → a ~none',
    ]);
    expect(edges.all).toHaveLength(7);
  });

  it('appends extra attributes and gives JSON ends', () => {
    const [first] = edges.bySource.get('a')!;
    expect(edgeText(first!, ['line=angled'])).toBe('b "charge" line=angled');
    expect(edgeJson(edges.ownLine[0]!)).toEqual({
      ref: 'free-src',
      id: 'free-src',
      from: { free: { x: 5, y: 6 } },
      to: { ref: 'b' },
      label: null,
      style: [],
    });
  });

  it('cuts a long arrow label at 60 characters', () => {
    const long = arrowBetween('l', 'a', 'b', { label: 'x '.repeat(40) });
    const [edge] = edgesOf([a, b, long], refs, new Set(['a', 'b'])).all;
    expect(edgeText(edge!)).toBe(`b "${'x '.repeat(30).trim()}"…`);
  });
});
