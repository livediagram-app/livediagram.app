import { describe, expect, it } from 'vitest';
import {
  activeCommentCount,
  createArrow,
  createComment,
  createImage,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  duplicateGroupedElements,
  type ArrowElement,
  type CommentThread,
  type Element,
  type ShapeElement,
} from './index';

describe('boxed-element factories', () => {
  it('createShape sets type/shape/position and a fresh uuid', () => {
    const s = createShape('circle', 10, 20);
    expect(s.type).toBe('shape');
    expect(s.shape).toBe('circle');
    expect(s).toMatchObject({ x: 10, y: 20, textSize: 'md' });
    expect(s.width).toBeGreaterThan(0);
    expect(s.height).toBeGreaterThan(0);
    expect(s.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('createShape uses per-kind default sizes', () => {
    expect(createShape('square', 0, 0)).toMatchObject({ width: 120, height: 120 });
    expect(createShape('stadium', 0, 0)).toMatchObject({ width: 160, height: 64 });
  });

  it('createText seeds a default label and size', () => {
    expect(createText(5, 6)).toMatchObject({
      type: 'text',
      x: 5,
      y: 6,
      label: 'Text',
      textSize: 'md',
    });
  });

  it('createSticky is a 200x200 note', () => {
    expect(createSticky(1, 2)).toMatchObject({
      type: 'sticky',
      x: 1,
      y: 2,
      width: 200,
      height: 200,
    });
  });

  it('createImage drops a 200x150 placeholder with null imageId and aspect-lock on', () => {
    // spec/19 contract: the canvas drops an image element with no
    // bytes attached, the picker fills imageId in afterwards. The
    // empty-state thumbnail renders while imageId is null, then the
    // aspectLocked default kicks in so resizing once a real image
    // lands preserves the natural ratio.
    expect(createImage(3, 4)).toMatchObject({
      type: 'image',
      x: 3,
      y: 4,
      width: 200,
      height: 150,
      imageId: null,
      aspectLocked: true,
    });
  });

  it('factories mint distinct ids on each call', () => {
    expect(createShape('square', 0, 0).id).not.toBe(createShape('square', 0, 0).id);
    expect(createImage(0, 0).id).not.toBe(createImage(0, 0).id);
  });
});

describe('arrow factories', () => {
  it('createArrow builds two free endpoints', () => {
    const a = createArrow(0, 0, 10, 20);
    expect(a.type).toBe('arrow');
    expect(a.from).toEqual({ kind: 'free', x: 0, y: 0 });
    expect(a.to).toEqual({ kind: 'free', x: 10, y: 20 });
  });

  it('createPinnedArrow builds two pinned endpoints with anchors', () => {
    const a = createPinnedArrow('a', 'e', 'b', 'w');
    expect(a.from).toEqual({ kind: 'pinned', elementId: 'a', anchor: 'e' });
    expect(a.to).toEqual({ kind: 'pinned', elementId: 'b', anchor: 'w' });
  });
});

describe('duplicateGroupedElements', () => {
  const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    ...overrides,
  });

  it('offsets duplicated boxed elements and maps old ids to new', () => {
    const a = shape('a', { x: 0, y: 0 });
    const { newElements, idMap } = duplicateGroupedElements([a], new Set(['a']), 10, 20);
    expect(newElements).toHaveLength(1);
    const dup = newElements[0] as ShapeElement;
    expect(dup).toMatchObject({ x: 10, y: 20 });
    expect(dup.id).toBe(idMap.get('a'));
    expect(dup.id).not.toBe('a');
  });

  it('puts multiple duplicates into one shared new group', () => {
    const els = [shape('a'), shape('b', { x: 100 })];
    const { newElements } = duplicateGroupedElements(els, new Set(['a', 'b']), 0, 0);
    const groups = newElements.map((e) => (e as ShapeElement).groupId);
    expect(groups[0]).toBeDefined();
    expect(groups[0]).toBe(groups[1]);
  });

  it('does not group a single duplicated element', () => {
    const { newElements } = duplicateGroupedElements([shape('a')], new Set(['a']), 0, 0);
    expect((newElements[0] as ShapeElement).groupId).toBeUndefined();
  });

  it('remaps a pinned arrow whose both ends are duplicated', () => {
    const a = shape('a');
    const b = shape('b', { x: 100 });
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    };
    const { newElements, idMap } = duplicateGroupedElements(
      [a, b, arrow],
      new Set(['a', 'b']),
      0,
      0,
    );
    const dupArrow = newElements.find((e): e is ArrowElement => e.type === 'arrow');
    expect(dupArrow).toBeDefined();
    expect(dupArrow!.from).toEqual({ kind: 'pinned', elementId: idMap.get('a'), anchor: 'e' });
    expect(dupArrow!.to).toEqual({ kind: 'pinned', elementId: idMap.get('b'), anchor: 'w' });
  });

  it('drops an arrow when only one endpoint is in the duplicated set', () => {
    const a = shape('a');
    const b = shape('b', { x: 100 });
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    };
    // Only 'a' selected → arrow can't be remapped → omitted.
    const { newElements } = duplicateGroupedElements([a, b, arrow], new Set(['a']), 0, 0);
    expect(newElements.some((e) => e.type === 'arrow')).toBe(false);
  });

  it('leaves the source list untouched', () => {
    const a = shape('a', { x: 0, y: 0 });
    duplicateGroupedElements([a], new Set(['a']), 99, 99);
    expect(a).toMatchObject({ x: 0, y: 0 });
  });
});

describe('comment helpers', () => {
  it('createComment carries the text and denormalised author identity', () => {
    const c = createComment('hello', { name: 'Ada', color: '#ff0000' });
    expect(c).toMatchObject({ text: 'hello', authorName: 'Ada', authorColor: '#ff0000' });
    expect(typeof c.createdAt).toBe('number');
    expect(c.id.length).toBeGreaterThan(0);
  });

  it('activeCommentCount is 0 for undefined or resolved threads', () => {
    expect(activeCommentCount(undefined)).toBe(0);
    const resolved: CommentThread = {
      resolved: true,
      comments: [createComment('x', { name: 'A', color: '#000' })],
    };
    expect(activeCommentCount(resolved)).toBe(0);
  });

  it('activeCommentCount counts comments on an open thread', () => {
    const thread: CommentThread = {
      resolved: false,
      comments: [
        createComment('a', { name: 'A', color: '#000' }),
        createComment('b', { name: 'B', color: '#111' }),
      ],
    };
    expect(activeCommentCount(thread)).toBe(2);
  });
});

// Sanity: the Element union import is exercised so the type stays referenced.
const _typecheck: Element = createShape('square', 0, 0);
void _typecheck;
