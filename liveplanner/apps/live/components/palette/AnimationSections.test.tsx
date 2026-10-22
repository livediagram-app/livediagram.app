import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createText, type Element } from '@liveplanner/project';
import { animationCategoriesOf } from './AnimationSections';

const of = (type: string) =>
  ({ id: type, type, x: 0, y: 0, width: 10, height: 10 }) as unknown as Element;

describe('animationCategoriesOf (one category per element-owned set present)', () => {
  it('icons, charts and arrows take their own categories, in order', () => {
    const sel = [of('arrow'), createShape('icon', 0, 0), createShape('pie-chart', 0, 0)];
    expect(animationCategoriesOf(sel)).toEqual(['icon', 'chart', 'arrow']);
    expect(animationCategoriesOf([createShape('icon', 0, 0)])).toEqual(['icon']);
    expect(animationCategoriesOf([of('arrow')])).toEqual(['arrow']);
  });

  it('progress, rating, concept graphics and sequence diagrams take their own category', () => {
    const own = (shape: string) => animationCategoriesOf([createShape(shape as never, 0, 0)]);
    expect(own('progress-bar')).toEqual(['progress']);
    expect(own('rating')).toEqual(['rating']);
    for (const kind of ['chevrons', 'cycle', 'hub', 'onion', 'pyramid', 'layer-stack'])
      expect(own(kind)).toEqual(['concept']);
    expect(own('sequence')).toEqual(['sequence']);
  });

  it('offers nothing for a plain shape, a note, a text element or a drawing', () => {
    expect(
      animationCategoriesOf([
        createShape('square', 0, 0),
        createSticky(0, 0),
        createText(0, 0),
        of('freehand'),
        of('image'),
        of('table'),
      ]),
    ).toEqual([]);
  });
});
