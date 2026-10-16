import { describe, expect, it } from 'vitest';
import type { ImageSummary } from '@livediagram/api-schema';
import { cpuBudgetMs, cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import {
  galleryListing,
  imageName,
  imagesPlacedIn,
  IMAGE_LIST_DEFAULT_LIMIT,
  unknownImageIssue,
} from './gallery';

const image = (id: string, createdAt: number, originalName?: string): ImageSummary => ({
  id,
  contentType: 'image/png',
  byteSize: 1000 + createdAt,
  width: 1280,
  height: 800,
  createdAt,
  ...(originalName === undefined ? {} : { originalName }),
});

const GALLERY = [
  image('a1', 1, 'Screenshot dashboard.png'),
  image('b2', 3, 'Logo.svg'),
  image('c3', 2, 'Screenshot settings.png'),
];

describe('galleryListing', () => {
  it('lists newest first, with a name, size and an ISO time', () => {
    expect(galleryListing(GALLERY, {})).toEqual({
      images: [
        {
          id: 'b2',
          name: 'Logo.svg',
          width: 1280,
          height: 800,
          size: 1003,
          uploadedAt: '1970-01-01T00:00:00.003Z',
        },
        {
          id: 'c3',
          name: 'Screenshot settings.png',
          width: 1280,
          height: 800,
          size: 1002,
          uploadedAt: '1970-01-01T00:00:00.002Z',
        },
        {
          id: 'a1',
          name: 'Screenshot dashboard.png',
          width: 1280,
          height: 800,
          size: 1001,
          uploadedAt: '1970-01-01T00:00:00.001Z',
        },
      ],
      more: 0,
    });
  });

  it('filters by name in any case and says how many more there are', () => {
    const listed = galleryListing(GALLERY, { query: 'SCREENSHOT', limit: 1 });
    expect(listed.images.map((i) => i.id)).toEqual(['c3']);
    expect(listed.more).toBe(1);
  });

  it('defaults to twenty', () => {
    const many = Array.from({ length: 30 }, (_, i) => image(`i${i}`, i, `p${i}.png`));
    expect(galleryListing(many, {}).images).toHaveLength(IMAGE_LIST_DEFAULT_LIMIT);
    expect(galleryListing(many, {}).more).toBe(10);
  });

  it('lists a gallery of the api’s largest size quickly', () => {
    const many = Array.from({ length: 5000 }, (_, i) => image(`i${i}`, i, `shot ${i}.png`));
    expect(cpuMsOf(() => galleryListing(many, { query: 'shot 49' }))).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('imageName', () => {
  it('names an upload without a file name by its type and id', () => {
    expect(imageName(image('0123456789', 1))).toBe('(unnamed png 01234567)');
    expect(imageName(image('x', 1, '  '))).toBe('(unnamed png x)');
  });
});

describe('imagesPlacedIn', () => {
  it('finds every imageId in tabs, elements and ops, with its element', () => {
    const input = {
      tabs: [
        {
          name: 'Page',
          elements: [
            { id: 'hero', type: 'image', imageId: 'a1' },
            { id: 'empty', type: 'image', imageId: null },
            { id: 'box', type: 'shape', label: 'imageId' },
          ],
        },
      ],
      ops: [{ op: 'update', elementId: 'shot', element: { imageId: 'zz' } }],
    };
    expect(imagesPlacedIn(input)).toEqual([
      { elementId: 'hero', imageId: 'a1' },
      { elementId: 'shot', imageId: 'zz' },
    ]);
    expect(imagesPlacedIn({ elements: [{ id: 'a', type: 'shape' }] })).toEqual([]);
    expect(imagesPlacedIn([{ imageId: 'q' }])).toEqual([{ elementId: null, imageId: 'q' }]);
  });
});

describe('unknownImageIssue', () => {
  it('names the first picture the gallery lacks, and what to do', () => {
    const gallery = new Set(['a1']);
    expect(unknownImageIssue([{ elementId: 'hero', imageId: 'a1' }], gallery)).toBeNull();
    expect(unknownImageIssue([{ elementId: 'hero', imageId: 'nope' }], gallery)).toBe(
      'imageId "nope" on element "hero" is not in your image gallery: list_images lists the pictures you can ' +
        'place. Leave imageId out for a placeholder the user fills in the editor.',
    );
    expect(unknownImageIssue([{ elementId: null, imageId: 'nope' }], gallery)).toMatch(
      /^imageId "nope" is not in your image gallery/,
    );
  });
});
