import { describe, expect, it } from 'vitest';
import { pagesOf, layOutPages, type Page } from './page';
import { guardLockedPages } from './page-lock';
import type { ShapeElement } from './index';

// docs/specs/007-editor/pages-mode.md "Locking a page".
const pages: Page[] = [
  { id: 'a', orientation: 'portrait', locked: true },
  { id: 'b', orientation: 'portrait' },
];
const [pa, pb] = layOutPages(pages);
const box = (id: string, x: number, y: number): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 40,
  height: 40,
});
const onB = box('on-b', pb!.rect.x + 100, pb!.rect.y + 100);

describe('page lock', () => {
  // The guard itself is @liveworkspace/element-model's (page-lock.test.ts there); this is it on this model's layout.
  it('keeps a new element off a locked page laid out by this model', () => {
    const added = box('new', pa!.rect.x + 300, pa!.rect.y + 300);
    expect(guardLockedPages([onB], [onB, added], pages, pages)).toEqual({
      elements: [onB],
      blocked: true,
    });
  });

  it('reads a stored lock, and only `true`', () => {
    const laid = layOutPages([{ id: 'x', orientation: 'portrait', locked: true }]);
    expect(laid[0]!.locked).toBe(true);
  });

  it('reads a page lock and Started Blank back only as true', () => {
    const tab = {
      pages: [
        { id: 'x', orientation: 'portrait', locked: true, startedBlank: true },
        { id: 'y', orientation: 'portrait', locked: 'yes', startedBlank: 1 },
      ],
    } as never;
    const [x, y] = pagesOf(tab);
    expect(x).toMatchObject({ locked: true, startedBlank: true });
    expect(y!.locked).toBeUndefined();
    expect(y!.startedBlank).toBeUndefined();
  });
});
