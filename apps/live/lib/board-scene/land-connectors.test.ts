import { describe, expect, it } from 'vitest';
import { isValidElement, type Element, type ShapeElement } from '@livediagram/document';
import { createLandContext, LANDING_RULES } from './context';
import { landArrow } from './land-connectors';
import type { SceneConnector } from './scene';

// docs/specs/020-import-export/board-scene.md "Kinds": connectors become arrows.
const target: ShapeElement = {
  id: 'shape-1',
  type: 'shape',
  shape: 'square',
  x: 200,
  y: 0,
  width: 100,
  height: 100,
};
const landed = new Map<string, Element>([['box', target]]);
const connector = (over: Partial<SceneConnector> = {}): SceneConnector => ({
  key: 'c',
  kind: 'connector',
  points: [
    { x: 0, y: 50 },
    { x: 200, y: 50 },
  ],
  stroke: { colour: { hex: '#1e1e1e' }, widthPx: 2 },
  heads: { end: 'arrow' },
  ...over,
});

describe('landArrow', () => {
  it('pins a bound end to the nearest anchor and leaves the other free', () => {
    const el = landArrow(connector({ to: 'box' }), 'a', createLandContext(), landed, 'whiteboard');
    expect(isValidElement(el)).toBe(true);
    expect(el.from).toEqual({ kind: 'free', x: 0, y: 50 });
    expect(el.to).toEqual({ kind: 'pinned', elementId: 'shape-1', anchor: 'w' });
    expect(el.arrowheadShape).toBe('line');
    expect(el.arrowEnds).toBeUndefined();
    expect(el.strokeColor).toBeUndefined();
    expect(el.strokeWidth).toBe(2);
  });

  it('leaves an end bound to nothing it knows free', () => {
    const el = landArrow(connector({ to: 'gone' }), 'a', createLandContext(), landed, 'whiteboard');
    expect(el.to).toEqual({ kind: 'free', x: 200, y: 50 });
  });

  it.each([
    [{ start: 'triangle', end: 'triangle' }, 'both', undefined],
    [{ start: 'circle' }, 'from', 'circle'],
    [{}, 'none', undefined],
    [{ end: 'diamond-hollow' }, undefined, 'diamond-hollow'],
  ] as const)('heads %o: ends %s, shape %s', (heads, ends, shape) => {
    const el = landArrow(connector({ heads }), 'a', createLandContext(), landed, 'whiteboard');
    expect(el.arrowEnds).toBe(ends);
    expect(el.arrowheadShape).toBe(shape);
  });

  it('says so for a bar head and for two different heads', () => {
    const ctx = createLandContext();
    landArrow(connector({ heads: { start: 'bar', end: 'arrow' } }), 'a', ctx, landed, 'whiteboard');
    expect(ctx.notes().map((n) => n.rule)).toEqual([LANDING_RULES.barHead, LANDING_RULES.twoHeads]);
  });

  it('bends through middle points as a curve, saying so when the source was sharp', () => {
    const ctx = createLandContext();
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 0 },
    ];
    const curved = landArrow(connector({ points, curved: true }), 'a', ctx, landed, 'whiteboard');
    expect(curved).toMatchObject({ arrowStyle: 'curved', curvePoints: [{ dx: 0, dy: 40 }] });
    expect(ctx.notes()).toEqual([]);
    landArrow(connector({ points }), 'a', ctx, landed, 'whiteboard');
    expect(ctx.notes()).toEqual([{ rule: LANDING_RULES.bentArrow, count: 1, kind: 'degraded' }]);
  });

  it('carries its label, coloured only when it differs from the line', () => {
    const label = { text: 'yes', fontPx: 16, family: 'hand' as const, colour: { hex: '#1971c2' } };
    const same = landArrow(
      connector({ stroke: { colour: { hex: '#1971c2' }, widthPx: 2 }, label }),
      'a',
      createLandContext(),
      landed,
      'whiteboard',
    );
    expect(same).toMatchObject({ label: 'yes', penColour: 'blue', font: 'caveat', textSize: 'sm' });
    expect(same.penTextColour).toBeUndefined();
    const other = landArrow(connector({ label }), 'a', createLandContext(), landed, 'whiteboard');
    expect(other.penTextColour).toBe('blue');
  });

  it('turns its points by its rotation', () => {
    const el = landArrow(
      connector({ rotationDeg: 180 }),
      'a',
      createLandContext(),
      landed,
      'whiteboard',
    );
    expect(el.from).toMatchObject({ x: expect.closeTo(200, 6), y: expect.closeTo(50, 6) });
  });

  it('keeps colours and the width verbatim on the diagram profile', () => {
    const el = landArrow(
      connector({ stroke: { colour: { hex: '#1971c2' }, widthPx: 3, dash: 'dotted' } }),
      'a',
      createLandContext(),
      landed,
      'diagram',
    );
    expect(el).toMatchObject({ strokeColor: '#1971c2', strokeWidth: 3, strokeStyle: 'dotted' });
    expect(el.penColour).toBeUndefined();
  });
});
