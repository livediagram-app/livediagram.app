// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blobToDataUrl } from './blob-data-url';

describe('blobToDataUrl', () => {
  it('reads a blob’s bytes as a data URL of its type', async () => {
    const url = await blobToDataUrl(new Blob(['GIF'], { type: 'image/gif' }));
    expect(url).toBe('data:image/gif;base64,R0lG');
  });
});
