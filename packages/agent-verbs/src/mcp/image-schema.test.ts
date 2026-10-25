import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CONTACT_SHEET_MAX, IMAGE_LIST_MAX_LIMIT } from '../images/gallery';
import { listImagesOutput, listImagesShape } from './image-schema';

describe('list_images’ shapes', () => {
  it('take a query, a limit up to the gallery’s cap, and the contact sheet', () => {
    const input = z.object(listImagesShape);
    expect(input.parse({ query: 'logo', limit: IMAGE_LIST_MAX_LIMIT, image: true })).toEqual({
      query: 'logo',
      limit: IMAGE_LIST_MAX_LIMIT,
      image: true,
    });
    expect(input.safeParse({ limit: IMAGE_LIST_MAX_LIMIT + 1 }).success).toBe(false);
    expect(listImagesShape.image.description).toContain(`the first ${CONTACT_SHEET_MAX}`);
  });

  it('answer the listing a gallery gives', () => {
    const output = z.object(listImagesOutput);
    const image = { id: 'a1', name: 'Logo.png', width: 1, height: 1, size: 9, uploadedAt: 'x' };
    expect(output.parse({ images: [image], more: 0 })).toEqual({ images: [image], more: 0 });
  });
});
