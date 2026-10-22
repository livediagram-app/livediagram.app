import { describe, expect, it } from 'vitest';
import type { Element, LaidOutPage } from '@livediagram/document';
import { articlePlusBlocked } from './article-plus-blocked';

// docs/specs/007-editor/article-pages.md "Zones": an object in an article's writing gets no quick-connect pluses.
const page = (x: number, flow: boolean) =>
  ({
    id: `p${x}`,
    rect: { x, y: 0, width: 100, height: 100 },
    ...(flow ? { flow: {} } : {}),
  }) as unknown as LaidOutPage;
const image = (id: string, x: number) =>
  ({ id, type: 'image', x, y: 10, width: 20, height: 20, src: '' }) as unknown as Element;
const square = (id: string, x: number) =>
  ({ id, type: 'shape', shape: 'square', x, y: 10, width: 20, height: 20 }) as Element;

describe('articlePlusBlocked', () => {
  it('checks nothing when no page holds writing', () => {
    expect(articlePlusBlocked(undefined, [])).toBeUndefined();
    expect(articlePlusBlocked([page(0, false)], [])).toBeUndefined();
  });

  it('blocks an object on a page with writing, never a drawing, and nothing elsewhere', () => {
    const inWriting = image('a', 10);
    const drawing = square('d', 10);
    const onPlainPage = image('b', 210);
    const blocked = articlePlusBlocked(
      [page(0, true), page(200, false)],
      [inWriting, drawing, onPlainPage],
    )!;
    expect(blocked(inWriting)).toBe(true);
    expect(blocked(drawing)).toBe(false);
    expect(blocked(onPlainPage)).toBe(false);
  });
});
