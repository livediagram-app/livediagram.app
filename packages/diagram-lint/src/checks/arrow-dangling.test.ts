import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';

describe('arrow-dangling', () => {
  it('fires on an arrow pinned to a missing element, and one free at both ends', () => {
    const free = {
      id: 'loose',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 50, y: 0 },
    } as Element;
    const report = lint(tabOf(box('a', 0, 0), arrow('gone', 'a', 'missing'), free));
    expect(of(report, 'arrow-dangling').map((f) => [f.message, f.fix])).toEqual([
      ['loose is free at both ends', 'rm loose'],
      ['gone points at a missing element', 'rm gone'],
    ]);
  });

  it('fires on an end pinned to an arrow, or on-arrow to a box', () => {
    const onBox = {
      ...arrow('x', 'a', 'b'),
      to: { kind: 'on-arrow', arrowId: 'b', t: 0.5 },
    } as Element;
    const toArrow = arrow('y', 'a', 'link');
    const report = lint(
      tabOf(box('a', 0, 0), box('b', 300, 0), arrow('link', 'a', 'b'), onBox, toArrow),
    );
    expect(of(report, 'arrow-dangling').map((f) => f.refs[0])).toEqual(['x', 'y']);
  });

  it('stays quiet for a pinned arrow, a half-free one, one on an arrow, and one to a hidden layer (N4)', () => {
    const half = { ...arrow('half', 'a', 'b'), to: { kind: 'free', x: 400, y: 0 } } as Element;
    const onArrow = {
      ...arrow('on', 'a', 'b'),
      to: { kind: 'on-arrow', arrowId: 'link', t: 0.5 },
    } as Element;
    const hidden = { ...box('h', 0, 300), layerId: 'off' } as Element;
    const tab = {
      ...tabOf(
        box('a', 0, 0),
        box('b', 300, 0),
        arrow('link', 'a', 'b'),
        half,
        onArrow,
        hidden,
        arrow('toHidden', 'a', 'h'),
      ),
      layers: [
        { id: 'default', name: 'Base' },
        { id: 'off', name: 'Off', visible: false },
      ],
    };
    expect(of(lint(tab), 'arrow-dangling')).toEqual([]);
  });

  it('says remove the edge for a graph source', () => {
    expect(
      of(lint(tabOf(arrow('gone', 'a', 'b')), { source: 'graph' }), 'arrow-dangling')[0]!.fix,
    ).toBe('remove the edge');
  });
});
