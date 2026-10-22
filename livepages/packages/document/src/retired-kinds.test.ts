import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import type { Element } from './index';
import { dropRetiredKinds } from './retired-kinds';
import { migrateStoredElements } from './stored-elements';

// A stored path (retired with Draw mode) never reaches the editor or a save.
const path = {
  id: 'p',
  type: 'path',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  closed: false,
  nodes: [],
} as unknown as Element;

describe('dropRetiredKinds', () => {
  it('drops a stored path and keeps everything else', () => {
    const square = createShape('square', 0, 0);
    expect(dropRetiredKinds([square, path])).toEqual([square]);
    expect(migrateStoredElements([path, square]).map((el) => el.id)).toEqual([square.id]);
  });

  it('hands back the same array when nothing is retired', () => {
    const els = [createShape('square', 0, 0)];
    expect(dropRetiredKinds(els)).toBe(els);
  });
});
