import { describe, expect, it } from 'vitest';
import { box, lint, of, tabOf } from '../fixtures/build';

describe('aspect-extreme', () => {
  it('fires on a drawing more than three times wider than tall, or the reverse', () => {
    const wide = lint(tabOf(box('a', 0, 0), box('b', 600, 0), box('c', 1200, 0)));
    expect(of(wide, 'aspect-extreme')).toEqual([
      {
        code: 'aspect-extreme',
        severity: 'info',
        refs: [],
        message: 'drawing: 1320×60, 22.0 times wider than tall',
        fix: 'layout type:shape direction=down',
      },
    ]);
    const tall = lint(tabOf(box('a', 0, 0), box('b', 0, 600), box('c', 0, 1200)), {
      source: 'graph',
    });
    expect(of(tall, 'aspect-extreme')[0]).toMatchObject({
      message: 'drawing: 120×1260, 10.5 times taller than wide',
      fix: 'direction: right',
    });
  });

  it('stays quiet under three boxes, near square, or with nothing visible', () => {
    expect(of(lint(tabOf(box('a', 0, 0), box('b', 600, 0))), 'aspect-extreme')).toEqual([]);
    expect(
      of(lint(tabOf(box('a', 0, 0), box('b', 200, 0), box('c', 0, 100))), 'aspect-extreme'),
    ).toEqual([]);
    expect(of(lint(tabOf()), 'aspect-extreme')).toEqual([]);
    const flat = [
      box('a', 0, 0, { height: 0 }),
      box('b', 300, 0, { height: 0 }),
      box('c', 600, 0, { height: 0 }),
    ];
    expect(of(lint(tabOf(...flat)), 'aspect-extreme')).toEqual([]);
  });
});
