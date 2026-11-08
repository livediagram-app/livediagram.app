import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createText, type Element } from '@livehuddle/document';
import { SHAPE_MOTIONS } from '@livehuddle/document';
import { animationCategoriesOf, sharedShapeAnimations } from './AnimationSections';

const of = (type: string) =>
  ({ id: type, type, x: 0, y: 0, width: 10, height: 10 }) as unknown as Element;

describe('animationCategoriesOf (one category per set present)', () => {
  it('a single labelled shape shows Shape and Text', () => {
    expect(animationCategoriesOf([createShape('square', 0, 0)])).toEqual(['shape', 'text']);
  });

  it('a single text element shows Text only', () => {
    expect(animationCategoriesOf([createText(0, 0)])).toEqual(['text']);
  });

  it('a shape and a text element show Shape and Text once each', () => {
    expect(animationCategoriesOf([createShape('square', 0, 0), createText(0, 0)])).toEqual([
      'shape',
      'text',
    ]);
  });

  it('a sticky and an image show Shape, their sets and Text, in order; a stored table adds nothing', () => {
    expect(animationCategoriesOf([of('table'), of('image'), createSticky(0, 0)])).toEqual([
      'shape',
      'sticky',
      'media',
      'text',
    ]);
  });

  it('an icon keeps its own category, and a stored arrow adds none', () => {
    const sel = [of('arrow'), createShape('icon', 0, 0), createShape('square', 0, 0)];
    expect(animationCategoriesOf(sel)).toEqual(['shape', 'icon', 'text']);
    // The Shape category there is the square's: an icon alone takes none.
    expect(animationCategoriesOf([createShape('icon', 0, 0)])).toEqual(['icon']);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4: a stored arrow, pen stroke, path
  // or annotation is retired, and is never animated.
  it('gives a retired element no category', () => {
    expect(
      animationCategoriesOf([of('arrow'), of('freehand'), of('path'), of('annotation')]),
    ).toEqual([]);
  });

  // docs/specs/028-animation/element-animations.md "Shape motions": a photo on a slide can bounce.
  it('an image shows Shape beside Media', () => {
    expect(animationCategoriesOf([of('image')])).toEqual(['shape', 'media']);
  });
});

describe('sharedShapeAnimations (what a Shape category offers)', () => {
  it('offers a shape the whole set and a photo the motions', () => {
    expect(sharedShapeAnimations([createShape('square', 0, 0)])).toHaveLength(15);
    expect(sharedShapeAnimations([of('image')])).toEqual(SHAPE_MOTIONS);
  });

  it('offers a mixed selection the overlap, ignoring elements outside the category', () => {
    expect(sharedShapeAnimations([createShape('square', 0, 0), of('image')])).toEqual(
      SHAPE_MOTIONS,
    );
    expect(sharedShapeAnimations([of('image'), createText(0, 0), of('arrow')])).toEqual(
      SHAPE_MOTIONS,
    );
  });
});
