import { describe, expect, it } from 'vitest';
import { imageIdIssue, imagesPlacedIn } from './placed';

describe('imagesPlacedIn', () => {
  it('finds every imageId with the element that places it', () => {
    expect(
      imagesPlacedIn({
        tabs: [
          {
            elements: [
              { id: 'a', type: 'image', imageId: 'x' },
              { id: 'b', type: 'text' },
            ],
          },
        ],
        ops: [{ op: 'update', elementId: 'c', set: { imageId: 'y' } }],
        pages: [{ background: { fill: { kind: 'image', imageId: 'z' } } }],
      }),
    ).toEqual([
      { elementId: 'a', imageId: 'x' },
      { elementId: 'c', imageId: 'y' },
      { elementId: null, imageId: 'z' },
    ]);
  });

  it('ignores an empty or null imageId', () => {
    expect(
      imagesPlacedIn([
        { id: 'a', imageId: null },
        { id: 'b', imageId: '' },
      ]),
    ).toEqual([]);
  });
});

describe('imageIdIssue', () => {
  it('refuses an input that places a picture, naming the element', () => {
    expect(imageIdIssue({ elements: [{ id: 'a', type: 'image', imageId: 'x' }] })).toMatch(
      /^imageId "x" on element "a" names an uploaded picture.*Leave imageId out/,
    );
  });

  it('passes an input that places none, placeholders included', () => {
    expect(imageIdIssue({ elements: [{ id: 'a', type: 'image', imageId: null }] })).toBeNull();
  });
});
