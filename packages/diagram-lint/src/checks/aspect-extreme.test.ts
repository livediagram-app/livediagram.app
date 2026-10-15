import { describe, expect, it } from 'vitest';
import { arrow, box, frame, lint, of, tabOf } from '../fixtures/build';

describe('aspect-extreme', () => {
  it('fires on a drawing more than three times wider than tall, or the reverse', () => {
    const joined = [arrow('ab', 'a', 'b'), arrow('bc', 'b', 'c')];
    const wide = lint(tabOf(box('a', 0, 0), box('b', 600, 0), box('c', 1200, 0), ...joined));
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

  it('stays quiet on a tab whose boxes no line joins, a board shaped by its design', () => {
    const board = tabOf(box('a', 0, 0), box('b', 600, 0), box('c', 1200, 0));
    expect(of(lint(board), 'aspect-extreme')).toEqual([]);
    expect(of(lint(board, { source: 'graph' }), 'aspect-extreme')).toHaveLength(1);
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

  it('stays quiet on an Illustrate tab, whose pages fix its shape (a row of slides)', () => {
    const row = tabOf(box('a', 0, 0), box('b', 600, 0), box('c', 1200, 0));
    expect(of(lint({ ...row, opensIn: 'illustrate' }), 'aspect-extreme')).toEqual([]);
  });

  it('stays quiet on a tab whose boxes sit in frames, which no layout keeps', () => {
    const framed = tabOf(
      frame('f', -20, -20, 1400, 120),
      box('a', 0, 0),
      box('b', 600, 0),
      box('c', 1200, 0),
    );
    expect(of(lint(framed), 'aspect-extreme')).toEqual([]);
  });

  it('fires on a framed graph, whose fix lays it out again with its groups', () => {
    const framed = tabOf(
      frame('f', -20, -20, 1400, 120),
      box('a', 0, 0),
      box('b', 600, 0),
      box('c', 1200, 0),
    );
    expect(of(lint(framed, { source: 'graph' }), 'aspect-extreme')[0]).toMatchObject({
      fix: 'direction: down',
    });
  });
});
