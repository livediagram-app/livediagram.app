import { describe, expect, it } from 'vitest';
import { normaliseElements } from './element-normalise';
import type { ArrowElement, Element } from './index';

// docs/specs/015-api/mcp-server.md "Every element takes the presentation defaults": raw arrows draw as elbow lines.

const box = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 120, height: 60, label: id }) as Element;
const arrow = (id: string, from: string, fa: string, to: string, ta: string, extra = {}) =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: fa },
    to: { kind: 'pinned', elementId: to, anchor: ta },
    ...extra,
  }) as unknown as Element;
const byId = (els: unknown, id: string) =>
  (els as Element[]).find((e) => e.id === id) as ArrowElement;

describe('raw arrows draw as elbow lines', () => {
  const boxes = [box('a', 0, 0), box('b', 300, 200), box('c', 0, 200)];

  it('angles a pinned arrow that names no style, with two bends that meet both ends square', () => {
    const out = normaliseElements([...boxes, arrow('x', 'a', 's', 'b', 'n')]);
    expect(byId(out, 'x')).toMatchObject({ arrowStyle: 'angled' });
    expect(byId(out, 'x').curvePoints).toHaveLength(2);
  });

  it('takes the axis from its start: out of a side, one bend into a top', () => {
    const out = normaliseElements([
      ...boxes,
      arrow('x', 'a', 'e', 'b', 'n', { arrowStyle: 'angled' }),
    ]);
    expect(byId(out, 'x').curvePoints).toHaveLength(1);
  });

  it('runs straight when the ends line up, and keeps a style or bends it was given', () => {
    const lined = normaliseElements([...boxes, arrow('x', 'a', 's', 'c', 'n')]);
    expect(byId(lined, 'x')).toMatchObject({ arrowStyle: 'straight' });
    const straight = normaliseElements([
      ...boxes,
      arrow('x', 'a', 's', 'b', 'n', { arrowStyle: 'straight' }),
    ]);
    expect(byId(straight, 'x').curvePoints).toBeUndefined();
    const bent = normaliseElements([
      ...boxes,
      arrow('x', 'a', 's', 'b', 'n', { arrowStyle: 'angled', curvePoints: [{ dx: 1, dy: 2 }] }),
    ]);
    expect(byId(bent, 'x').curvePoints).toEqual([{ dx: 1, dy: 2 }]);
    const curved = normaliseElements([
      ...boxes,
      arrow('x', 'a', 's', 'b', 'n', { arrowStyle: 'curved' }),
    ]);
    expect(byId(curved, 'x').arrowStyle).toBe('curved');
  });

  it('leaves a free-ended arrow as it is', () => {
    const free = {
      id: 'f',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 100, y: 100 },
    } as unknown as Element;
    expect(byId(normaliseElements([free]), 'f').arrowStyle).toBeUndefined();
  });
});
