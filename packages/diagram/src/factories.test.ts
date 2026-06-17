import { describe, expect, it } from 'vitest';
import {
  createLinkCard,
  activeCommentCount,
  createAnnotation,
  createArrow,
  createBanner,
  createComment,
  createImage,
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  duplicateGroupedElements,
  isBoxed,
  type ArrowElement,
  type CommentThread,
  type Element,
  type ShapeElement,
  type TextElement,
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

  it('createAnnotation is a 44x44 boxed marker with no note yet (spec/38)', () => {
    const a = createAnnotation(7, 8);
    expect(a).toMatchObject({ type: 'annotation', x: 7, y: 8, width: 44, height: 44 });
    // Aspect-locked by default so resizing keeps the marker round.
    expect(a.aspectLocked).toBe(true);
    expect(a.note).toBeUndefined();
    expect(a.id).toMatch(/[0-9a-f-]{36}/);
    // It must count as boxed so it flows through selection / drag / layering.
    expect(isBoxed(a)).toBe(true);
  });

  it('createLinkCard is a 280x120 boxed bookmark with no link/meta yet (spec/40)', () => {
    const c = createLinkCard(3, 4);
    expect(c).toMatchObject({ type: 'link-card', x: 3, y: 4, width: 280, height: 120 });
    expect(c.link).toBeUndefined();
    expect(c.meta).toBeUndefined();
    expect(isBoxed(c)).toBe(true);
  });

  it('createBanner is a composite group: accent bar (first) + title + subtitle (spec/09)', () => {
    const els = createBanner(100, 50, '#db2777');
    expect(els).toHaveLength(3);
    const [bar, title, subtitle] = els as [ShapeElement, TextElement, TextElement];

    // All three share ONE fresh group id so they move / lock / copy as a unit.
    expect(bar.groupId).toBeDefined();
    expect(title.groupId).toBe(bar.groupId);
    expect(subtitle.groupId).toBe(bar.groupId);

    // Bar paints first (lowest z), filled with the accent and borderless.
    expect(bar.type).toBe('shape');
    expect(bar.shape).toBe('square');
    expect(bar).toMatchObject({ fillColor: '#db2777', strokeWidth: 'none', borderRadius: 'lg' });

    // Title + subtitle are white, centred text; subtitle is smaller + muted.
    expect(title).toMatchObject({ type: 'text', textColor: '#ffffff', textBold: true, textSize: 'lg' });
    expect(title.textAlignX).toBe('center');
    expect(subtitle).toMatchObject({ type: 'text', textColor: '#ffffff', textSize: 'sm' });
    expect(subtitle.opacity).toBeLessThan(1);

    // Centred on the drop point.
    expect(bar.x + bar.width / 2).toBe(100);
    expect(bar.y + bar.height / 2).toBe(50);
  });

  it('createBanner mints a distinct group id each call', () => {
    const a = createBanner(0, 0, '#000')[0] as ShapeElement;
    const b = createBanner(0, 0, '#000')[0] as ShapeElement;
    expect(a.groupId).not.toBe(b.groupId);
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

  it('does NOT group loose (ungrouped) duplicates — they stay loose', () => {
    // Two elements with no shared groupId (e.g. a marquee multi-select
    // that was copied + pasted) must not be welded into a new group.
    const els = [shape('a'), shape('b', { x: 100 })];
    const { newElements } = duplicateGroupedElements(els, new Set(['a', 'b']), 0, 0);
    const groups = newElements.map((e) => (e as ShapeElement).groupId);
    expect(groups[0]).toBeUndefined();
    expect(groups[1]).toBeUndefined();
  });

  it('preserves a source group as a fresh, distinct group', () => {
    const els = [shape('a', { groupId: 'g1' }), shape('b', { x: 100, groupId: 'g1' })];
    const { newElements } = duplicateGroupedElements(els, new Set(['a', 'b']), 0, 0);
    const groups = newElements.map((e) => (e as ShapeElement).groupId);
    expect(groups[0]).toBeDefined();
    expect(groups[0]).toBe(groups[1]); // copies share one group
    expect(groups[0]).not.toBe('g1'); // but a NEW group, not the source's
  });

  it('keeps two distinct source groups distinct in the copies', () => {
    const els = [
      shape('a', { groupId: 'g1' }),
      shape('b', { x: 100, groupId: 'g1' }),
      shape('c', { x: 200, groupId: 'g2' }),
      shape('d', { x: 300, groupId: 'g2' }),
    ];
    const { newElements } = duplicateGroupedElements(els, new Set(['a', 'b', 'c', 'd']), 0, 0);
    const g = newElements.map((e) => (e as ShapeElement).groupId);
    expect(g[0]).toBe(g[1]);
    expect(g[2]).toBe(g[3]);
    expect(g[0]).not.toBe(g[2]); // two groups in, two groups out
  });

  it('drops a lone group member (only part of a group duplicated)', () => {
    const els = [shape('a', { groupId: 'g1' }), shape('b', { x: 100, groupId: 'g1' })];
    // Only 'a' is in the duplicated set → its copy would be a group of
    // one, so the groupId is dropped.
    const { newElements } = duplicateGroupedElements(els, new Set(['a']), 0, 0);
    expect(newElements).toHaveLength(1);
    expect((newElements[0] as ShapeElement).groupId).toBeUndefined();
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
    const { newElements } = duplicateGroupedElements([a, b, arrow], new Set(['a']), 0, 0);
    expect(newElements.some((e) => e.type === 'arrow')).toBe(false);
  });

  it('copies a selected free arrow, translating both endpoints', () => {
    const arrow: ArrowElement = {
      id: 'arrow',
      type: 'arrow',
      from: { kind: 'free', x: 10, y: 10 },
      to: { kind: 'free', x: 60, y: 40 },
    };
    const { newElements } = duplicateGroupedElements([arrow], new Set(['arrow']), 5, 7);
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
    const { newElements } = duplicateGroupedElements([a, b, arrow], new Set(['arrow']), 0, 0);
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
    const { newElements } = duplicateGroupedElements([arrow], new Set(['arrow']), 0, 0);
    expect(newElements.some((e) => e.type === 'arrow')).toBe(false);
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
    const { newElements } = duplicateGroupedElements([arrow], new Set(['arrow']), 1, 1);
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
