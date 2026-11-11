import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { IMAGE_REMOVE_MAX } from '../images/remove';
import { mcpDeleteImage, mcpUploadImage } from './image-tools';

describe('the gallery writers', () => {
  it('upload_image adds, never removes', () => {
    expect(mcpUploadImage).toMatchObject({
      id: 'mcp.upload_image',
      behaviour: 'write',
      openWorld: true,
    });
    expect(mcpUploadImage.idempotent).toBeUndefined();
    expect(mcpUploadImage.description).toContain('SVG is refused');
    expect(mcpUploadImage.description).toContain('Made by AI');
    expect(mcpUploadImage.input.parse({ url: 'https://a.example.com/a.png' })).toEqual({
      url: 'https://a.example.com/a.png',
    });
    const image = { id: 'a', name: 'a.png', width: 1, height: 1, size: 1, uploadedAt: 'x' };
    expect(mcpUploadImage.output.parse({ ...image, deduped: false })).toMatchObject(image);
  });

  it('delete_image is destructive, and the same call twice removes nothing more', () => {
    expect(mcpDeleteImage).toMatchObject({
      id: 'mcp.delete_image',
      behaviour: 'destructive',
      idempotent: true,
    });
    expect(mcpDeleteImage.description).toContain('broken picture');
    const input = mcpDeleteImage.input;
    expect(input.safeParse({ imageIds: [] }).success).toBe(false);
    expect(
      input.safeParse({ imageIds: Array.from({ length: IMAGE_REMOVE_MAX + 1 }, () => 'x') })
        .success,
    ).toBe(false);
    const output = z.object(mcpDeleteImage.mcpShapes.output);
    expect(
      output.parse({
        results: [{ id: 'a', outcome: 'in_use', usedIn: [{ id: 'd', name: 'D', app: 'x' }] }],
        deleted: 0,
        kept: 1,
      }).kept,
    ).toBe(1);
  });
});
