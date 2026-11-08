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
    const tall = lint(tabOf(box('a', 0, 0), box('b', 0, 600), box('c', 0, 1200), ...joined));
    expect(of(tall, 'aspect-extreme')[0]).toMatchObject({
      message: 'drawing: 120×1260, 10.5 times taller than wide',
      fix: 'layout type:shape direction=right',
    });
  });

  it('stays quiet on a tab whose boxes no line joins, a board shaped by its design', () => {
    const board = tabOf(box('a', 0, 0), box('b', 600, 0), box('c', 1200, 0));
    expect(of(lint(board), 'aspect-extreme')).toEqual([]);
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
    expect(
      of(lint(tabOf(...flat, arrow('ab', 'a', 'b'), arrow('bc', 'b', 'c'))), 'aspect-extreme'),
    ).toEqual([]);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: a stored boundary, lane, stack
  // or frame is a backdrop its boxes sit on, which no layout keeps.
  it('stays quiet on a tab with a stored backdrop, which no layout keeps', () => {
    const framed = tabOf(
      frame('f', -20, -20, 1400, 120),
      box('a', 0, 0),
      box('b', 600, 0),
      box('c', 1200, 0),
    );
    expect(of(lint(framed), 'aspect-extreme')).toEqual([]);
  });
});
