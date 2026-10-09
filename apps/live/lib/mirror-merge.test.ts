import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_MIRROR,
  encodeStrokePoints,
  layOutIllustratePages,
  newLogoPage,
  type BoxedElement,
  type FreehandElement,
  type PathElement,
} from '@livediagram/document';
import { combineElements } from './combine/combine';
import { mergeWithTwin } from './mirror-merge';
import { isTidyable } from './stroke-tidy';
import { withTwinsAdded } from './mirror-commit';

// docs/specs/007-editor/logo-pages.md "Mirror": a drawing and its twin become one element.
beforeAll(async () => {
  // Load the engine, as turning Mirror on does.
  await combineElements([], 'unite', 'x');
  const disc = { id: 'a', type: 'shape', shape: 'circle', x: 0, y: 0, width: 10, height: 10 };
  await combineElements([disc, { ...disc, id: 'b' }] as BoxedElement[], 'unite', 'x');
});

const pages = layOutIllustratePages([newLogoPage('l')]).map((p) => ({
  ...p,
  mirror: DEFAULT_MIRROR,
}));

describe('mergeWithTwin', () => {
  it('unites a shape with its twin into one path that keeps the drawing id', () => {
    const shape = {
      id: 'drawn',
      type: 'shape',
      shape: 'circle',
      x: -300,
      y: -50,
      width: 100,
      height: 100,
      fillColor: '#ff0000',
    } as BoxedElement;
    const next = withTwinsAdded([], [shape], pages);
    expect(next).toHaveLength(1);
    const p = next[0] as PathElement;
    expect(p).toMatchObject({ id: 'drawn', type: 'path', closed: true, fillColor: '#ff0000' });
    // Two islands, either side of the axis.
    expect(p.subpaths).toHaveLength(1);
    expect(p.x).toBeCloseTo(-300);
    expect(p.x + p.width).toBeCloseTo(300);
  });

  it('joins an open path and its twin as one path of two open contours', () => {
    const line: PathElement = {
      id: 'line',
      type: 'path',
      x: -300,
      y: 0,
      width: 100,
      height: 50,
      closed: false,
      strokeColor: '#00ff00',
      nodes: [
        { nx: 0, ny: 0, mode: 'corner' },
        { nx: 1, ny: 1, mode: 'corner' },
      ],
    };
    const [p] = withTwinsAdded([], [line], pages) as PathElement[];
    expect(p).toMatchObject({ id: 'line', closed: false, strokeColor: '#00ff00' });
    expect(p!.subpaths).toHaveLength(1);
    expect(p!.width).toBeCloseTo(600);
  });

  it('turns an open stroke and its twin into one path', () => {
    const stroke: FreehandElement = {
      id: 'pencil',
      type: 'freehand',
      x: -300,
      y: 0,
      width: 100,
      height: 100,
      closed: false,
      strokeColor: '#0000ff',
      packedPoints: encodeStrokePoints([
        { nx: 0, ny: 0 },
        { nx: 0.5, ny: 0.5 },
        { nx: 1, ny: 1 },
      ]),
    };
    const twin = { ...stroke, id: 't', x: 200 };
    const merged = mergeWithTwin(stroke, twin) as PathElement;
    expect(merged).toMatchObject({ id: 'pencil', type: 'path', closed: false });
    // The straight stroke simplifies to its two ends.
    expect(merged.nodes).toHaveLength(2);
  });

  it('keeps the pair for what cannot merge', () => {
    const text = { id: 't', type: 'text', x: 0, y: 0, width: 10, height: 10 } as BoxedElement;
    expect(mergeWithTwin(text, { ...text, id: 'u' })).toBeNull();
  });

  it('joins a marker stroke and its twin as one tidyable line, in its colour (Ink when none)', () => {
    const marker = (over: Partial<FreehandElement>): FreehandElement => ({
      id: 'm',
      type: 'freehand',
      x: -300,
      y: 0,
      width: 100,
      height: 40,
      closed: false,
      penWidth: 6,
      packedPoints: encodeStrokePoints([
        { nx: 0, ny: 0 },
        { nx: 0.5, ny: 1 },
        { nx: 1, ny: 0 },
      ]),
      ...over,
    });
    const [ink] = withTwinsAdded([], [marker({})], pages) as PathElement[];
    // As a line: two open contours in the marker's colour (Ink when it has none) and width, so
    // Tidy Up can still take it.
    expect(ink).toMatchObject({ type: 'path', closed: false, penColour: 'ink' });
    expect(ink!.subpaths).toHaveLength(1);
    expect(ink!.strokeWidth).not.toBe('none');
    expect(isTidyable(ink!)).toBe(true);
    const [red] = withTwinsAdded([], [marker({ penColour: 'red' })], pages) as PathElement[];
    expect(red!.penColour).toBe('red');
  });
});
