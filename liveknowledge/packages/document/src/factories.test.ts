import { describe, expect, it } from 'vitest';
import {
  createLinkCard,
  activeCommentCount,
  createArrow,
  createComment,
  createComponent,
  scaleElements,
  createImage,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  duplicateElements,
  isBoxed,
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
      textSize: 'sm',
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
    // docs/specs/009-elements/images.md contract: the canvas drops an image element with no
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

  it('createLinkCard is a 280x120 boxed bookmark with no link/meta yet (docs/specs/009-elements/link-cards.md)', () => {
    const c = createLinkCard(3, 4);
    expect(c).toMatchObject({ type: 'link-card', x: 3, y: 4, width: 280, height: 120 });
    expect(c.link).toBeUndefined();
    expect(c.meta).toBeUndefined();
    expect(isBoxed(c)).toBe(true);
  });

  it('scaleElements scales boxed position + size about the origin, 2x', () => {
    const before = createComponent('banner', 0, 0, {
      accent: '#000',
      surface: '#fff',
      ink: '#111',
    });
    if (before.type === 'arrow') throw new Error('expected boxed');
    const scaled = scaleElements([before], 0, 0, 2)[0]!;
    if (scaled.type === 'arrow') throw new Error('expected boxed');
    expect(scaled.width).toBe(before.width * 2);
    expect(scaled.height).toBe(before.height * 2);
    expect(scaled.x).toBe(before.x * 2);
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

describe('duplicateElements', () => {
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

  it('points an element link at the copy when its target was copied', () => {
    const target = shape('t');
    const linker = shape('l', {
      link: { kind: 'element', tabId: 'tab-1', elementId: 't' },
    });
    const { newElements, idMap } = duplicateElements([target, linker], new Set(['t', 'l']), 0, 0);
    const dup = newElements.find((el) => el.id === idMap.get('l')) as ShapeElement;
    expect(dup.link).toEqual({ kind: 'element', tabId: 'tab-1', elementId: idMap.get('t') });
  });

  it('offsets duplicated boxed elements and maps old ids to new', () => {
    const a = shape('a', { x: 0, y: 0 });
    const { newElements, idMap } = duplicateElements([a], new Set(['a']), 10, 20);
    expect(newElements).toHaveLength(1);
    const dup = newElements[0] as ShapeElement;
    expect(dup).toMatchObject({ x: 10, y: 20 });
    expect(dup.id).toBe(idMap.get('a'));
    expect(dup.id).not.toBe('a');
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
    const { newElements, idMap } = duplicateElements([a, b, arrow], new Set(['a', 'b']), 0, 0);
    const dupArrow = newElements.find((e): e is ArrowElement => e.type === 'arrow');
    expect(dupArrow).toBeDefined();
    expect(dupArrow!.from).toEqual({ kind: 'pinned', elementId: idMap.get('a'), anchor: 'e' });
    expect(dupArrow!.to).toEqual({ kind: 'pinned', elementId: idMap.get('b'), anchor: 'w' });
  });

  it('drops a non-selected arrow when only one endpoint is in the duplicated set', () => {
    const a = shape('a');
    const b = shape('b', { x: 100 });
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    };
    // Only 'a' selected (NOT the arrow) → the internal-connector rule
    // needs both ends duplicated, so the arrow doesn't ride along.
    const { newElements } = duplicateElements([a, b, arrow], new Set(['a']), 0, 0);
    expect(newElements.some((e) => e.type === 'arrow')).toBe(false);
  });

  it('copies a selected free arrow, translating both endpoints', () => {
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'free', x: 10, y: 10 },
      to: { kind: 'free', x: 60, y: 40 },
    };
    const { newElements } = duplicateElements([arrow], new Set(['arrow']), 5, 7);
    const dup = newElements.find((e): e is ArrowElement => e.type === 'arrow');
    expect(dup).toBeDefined();
    expect(dup!.id).not.toBe('arrow');
    expect(dup!.from).toEqual({ kind: 'free', x: 15, y: 17 });
    expect(dup!.to).toEqual({ kind: 'free', x: 65, y: 47 });
  });

  it('keeps a selected arrow pinned to elements that exist but were not copied', () => {
    const a = shape('a');
    const b = shape('b', { x: 100 });
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    };
    // Only the arrow is selected; a + b stay put → the copy keeps the
    // original pins (still real elements, so no orphan).
    const { newElements } = duplicateElements([a, b, arrow], new Set(['arrow']), 0, 0);
    const dup = newElements.find((e): e is ArrowElement => e.type === 'arrow');
    expect(dup).toBeDefined();
    expect(dup!.from).toEqual({ kind: 'pinned', elementId: 'a', anchor: 'e' });
    expect(dup!.to).toEqual({ kind: 'pinned', elementId: 'b', anchor: 'w' });
  });

  it('skips a selected arrow whose pinned target no longer exists (no orphan)', () => {
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'pinned', elementId: 'gone', anchor: 'w' },
    };
    const { newElements } = duplicateElements([arrow], new Set(['arrow']), 0, 0);
    expect(newElements.some((e) => e.type === 'arrow')).toBe(false);
    // The skipped arrow must not leave a phantom mapping behind.
    const { idMap } = duplicateElements([arrow], new Set(['arrow']), 0, 0);
    expect(idMap.has('arrow')).toBe(false);
  });

  it('remaps an on-arrow endpoint to the duplicate when the target arrow copies too (docs/specs/008-canvas/arrow-to-arrow.md)', () => {
    const a = shape('a');
    const lifeline: ArrowElement = {
      id: 'lifeline',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 's' },
      to: { kind: 'free', x: 0, y: 300 },
    };
    const message: ArrowElement = {
      id: 'message',
      type: 'arrow',
      from: { kind: 'on-arrow', arrowId: 'lifeline', t: 0.4 },
      to: { kind: 'free', x: 200, y: 120 },
    };
    const { newElements, idMap } = duplicateElements(
      [a, lifeline, message],
      new Set(['a', 'lifeline', 'message']),
      10,
      0,
    );
    const dupMessage = newElements.find(
      (e): e is ArrowElement => e.type === 'arrow' && e.from.kind === 'on-arrow',
    );
    expect(dupMessage).toBeDefined();
    // Follows the COPY of the lifeline, not the original.
    expect(dupMessage!.from).toEqual({ kind: 'on-arrow', arrowId: idMap.get('lifeline'), t: 0.4 });
  });

  it('re-points an on-arrow endpoint at the ORIGINAL when its target arrow gets dropped mid-copy', () => {
    // B pins to an element that neither copies nor exists, so B is
    // dropped; A (earlier in the array) must NOT keep a remap to the
    // never-created dup(B) — that endpoint would resolve to the canvas
    // origin. The droppability fixpoint settles before any remap.
    const messageA: ArrowElement = {
      id: 'A',
      type: 'arrow',
      from: { kind: 'on-arrow', arrowId: 'B', t: 0.5 },
      to: { kind: 'free', x: 100, y: 50 },
    };
    const lifelineB: ArrowElement = {
      id: 'B',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'pinned', elementId: 'gone', anchor: 's' },
    };
    const { newElements, idMap } = duplicateElements(
      [messageA, lifelineB],
      new Set(['A', 'B']),
      0,
      0,
    );
    const arrows = newElements.filter((e): e is ArrowElement => e.type === 'arrow');
    expect(arrows).toHaveLength(1);
    // The copy of A follows the ORIGINAL B (still a real element in the
    // source list), never a phantom duplicate id.
    expect(arrows[0]!.from).toEqual({ kind: 'on-arrow', arrowId: 'B', t: 0.5 });
    expect(idMap.has('B')).toBe(false);
  });

  it('keeps an on-arrow endpoint on the original when the target arrow was not copied', () => {
    const lifeline: ArrowElement = {
      id: 'lifeline',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 0, y: 300 },
    };
    const message: ArrowElement = {
      id: 'message',
      type: 'arrow',
      from: { kind: 'on-arrow', arrowId: 'lifeline', t: 0.4 },
      to: { kind: 'free', x: 200, y: 120 },
    };
    const { newElements } = duplicateElements([lifeline, message], new Set(['message']), 0, 0);
    const dup = newElements.find((e): e is ArrowElement => e.type === 'arrow');
    expect(dup!.from).toEqual({ kind: 'on-arrow', arrowId: 'lifeline', t: 0.4 });
  });

  it('repins both ends to the duplicates, anchors unchanged', () => {
    const a = shape('a');
    const b = shape('b', { x: 100 });
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'ene' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    };
    const { newElements, idMap } = duplicateElements(
      [a, b, arrow],
      new Set(['a', 'b', 'arrow']),
      0,
      0,
    );
    const dup = newElements.find((e): e is ArrowElement => e.type === 'arrow');
    expect(dup!.from).toEqual({ kind: 'pinned', elementId: idMap.get('a'), anchor: 'ene' });
    expect(dup!.to).toEqual({ kind: 'pinned', elementId: idMap.get('b'), anchor: 'w' });
  });

  it('preserves arrow styling (stroke / ends / label) on copy', () => {
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 50, y: 0 },
      strokeColor: '#ff0000',
      arrowEnds: 'both',
      strokeStyle: 'dashed',
      label: 'flow',
    };
    const { newElements } = duplicateElements([arrow], new Set(['arrow']), 1, 1);
    const dup = newElements.find((e): e is ArrowElement => e.type === 'arrow')!;
    expect(dup).toMatchObject({
      strokeColor: '#ff0000',
      arrowEnds: 'both',
      strokeStyle: 'dashed',
      label: 'flow',
    });
  });

  it('leaves the source list untouched', () => {
    const a = shape('a', { x: 0, y: 0 });
    duplicateElements([a], new Set(['a']), 99, 99);
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

describe('duplicateElements — rotation', () => {
  const note = {
    id: 'n1',
    type: 'sticky',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  } as unknown as Element;

  it('leaves a deliberately-rotated ordinary element exactly as it was', () => {
    const tilted = {
      ...note,
      id: 'p1',
      rotation: 12,
    } as unknown as Element;
    const { newElements } = duplicateElements([tilted], new Set(['p1']), 5, 5);
    expect((newElements[0] as { rotation?: number }).rotation).toBe(12);
  });
});
