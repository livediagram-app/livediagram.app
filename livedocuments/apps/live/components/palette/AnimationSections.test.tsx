import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createText, type Element } from '@livedocuments/document';
import { SHAPE_MOTIONS } from '@livedocuments/document';
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

  it('a sticky, an image and a table show Shape, their sets and Text, in order', () => {
    expect(animationCategoriesOf([of('table'), of('image'), createSticky(0, 0)])).toEqual([
      'shape',
      'sticky',
      'media',
      'table',
      'text',
    ]);
  });

  it('icons, charts and arrows keep their own categories', () => {
    const sel = [of('arrow'), createShape('icon', 0, 0), createShape('pie-chart', 0, 0)];
    expect(animationCategoriesOf(sel)).toEqual(['shape', 'icon', 'chart', 'arrow']);
    // The Shape category there is the chart's: an icon or an arrow alone takes none.
    expect(animationCategoriesOf([createShape('icon', 0, 0)])).toEqual(['icon']);
    expect(animationCategoriesOf([of('arrow')])).toEqual(['arrow']);
  });

  it('a drawing shows Shape and Drawing', () => {
    expect(animationCategoriesOf([of('freehand'), of('path')])).toEqual(['shape', 'drawing']);
  });

  // docs/specs/028-animation/element-animations.md "Shape motions": a photo on a slide can bounce.
  it('an image or a video shows Shape beside Media', () => {
    expect(animationCategoriesOf([of('image')])).toEqual(['shape', 'media']);
    expect(animationCategoriesOf([of('video')])).toEqual(['shape', 'media']);
  });

  // docs/specs/028-animation/element-animations.md "The menu": an element's own animation is a category of the
  // Animation row, never a picker in its own section.
  it('progress, rating and concept graphics take their own category, with the Shape motions', () => {
    const own = (shape: string) =>
      animationCategoriesOf([createShape(shape as never, 0, 0)]).filter((c) => c !== 'text');
    expect(own('progress-bar')).toEqual(['shape', 'progress']);
    expect(own('rating')).toEqual(['shape', 'rating']);
    for (const kind of ['chevrons', 'cycle', 'hub', 'onion', 'pyramid', 'layer-stack'])
      expect(own(kind)).toEqual(['shape', 'concept']);
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
