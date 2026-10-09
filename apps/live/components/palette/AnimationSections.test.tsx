import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createText, type Element } from '@livediagram/document';
import { animationCategoriesOf } from './AnimationSections';

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

  it('a sticky, an image and a table show their sets and Text, in order', () => {
    expect(animationCategoriesOf([of('table'), of('image'), createSticky(0, 0)])).toEqual([
      'sticky',
      'media',
      'table',
      'text',
    ]);
  });

  it('icons, charts and arrows keep their own categories', () => {
    const sel = [of('arrow'), createShape('icon', 0, 0), createShape('pie-chart', 0, 0)];
    expect(animationCategoriesOf(sel)).toEqual(['icon', 'chart', 'arrow']);
  });

  it('a drawing shows Drawing only', () => {
    expect(animationCategoriesOf([of('freehand'), of('path')])).toEqual(['drawing']);
  });
});
