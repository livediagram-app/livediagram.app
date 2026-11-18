// The small copies of a selection's pictures a save sends for its tile (liveworkspace/docs/specs/006-media/
// libraries.md "Pictures"): sized by their share of the item, the largest first, within the budget, each URL given back.
import { LIBRARY_PICTURE_EDGE, LIBRARY_PICTURES_BYTES_MAX } from '@liveworkspace/media';
import { describe, expect, it, vi } from 'vitest';
import { LIBRARY_PICTURES_MAX, libraryPictures, pictureEdge } from './library-pictures';

const pic = (imageId: string, width: number, height = width) => ({
  id: `el-${imageId}`,
  type: 'image',
  imageId,
  width,
  height,
});
const source = () => ({
  url: vi.fn(async (id: string): Promise<string | null> => `blob:${id}`),
  release: vi.fn((_url: string) => {}),
});

describe('pictureEdge', () => {
  it('gives a picture its share of the item’s longest side, within the floor and the edge', () => {
    expect(pictureEdge(pic('a', 100), { width: 100, height: 50 })).toBe(LIBRARY_PICTURE_EDGE);
    expect(pictureEdge(pic('a', 50), { width: 100, height: 50 })).toBe(LIBRARY_PICTURE_EDGE / 2);
    expect(pictureEdge(pic('a', 1), { width: 1000, height: 10 })).toBe(16);
    expect(pictureEdge(pic('a', 0), { width: 100, height: 100 })).toBe(LIBRARY_PICTURE_EDGE);
    expect(pictureEdge({ type: 'image' }, { width: 0, height: 0 })).toBe(LIBRARY_PICTURE_EDGE);
  });
});

describe('libraryPictures', () => {
  it('copies each gallery picture once, the largest first, at its own edge, and gives every URL back', async () => {
    const src = source();
    const encode = vi.fn(
      async (url: string, edge: number) => `data:image/jpeg;base64,${url.length}${edge}`,
    );
    const out = await libraryPictures(
      {
        width: 100,
        height: 100,
        elements: [
          pic('small', 25),
          pic('big', 100),
          pic('big', 50),
          { type: 'shape' },
          pic('data:x', 10),
        ],
      },
      src,
      encode,
    );
    expect(encode.mock.calls.map((c) => c[1])).toEqual([LIBRARY_PICTURE_EDGE, 32]);
    expect(Object.keys(out)).toEqual(['big', 'small']);
    expect(src.release.mock.calls).toEqual([['blob:big'], ['blob:small']]);
  });

  it('leaves out a picture it can’t read or draw, or one past the budget', async () => {
    const src = source();
    src.url.mockImplementation(async (id: string) => (id === 'gone' ? null : `blob:${id}`));
    const big = `data:image/jpeg;base64,${'A'.repeat(LIBRARY_PICTURES_BYTES_MAX)}`;
    const encode = vi.fn(async (url: string) => {
      if (url === 'blob:broken') throw new Error('decode');
      return url === 'blob:huge' ? big : 'data:image/jpeg;base64,QUJD';
    });
    const out = await libraryPictures(
      {
        width: 10,
        height: 10,
        elements: [pic('gone', 10), pic('broken', 9), pic('huge', 8), pic('fine', 7)],
      },
      src,
      encode,
    );
    expect(Object.keys(out)).toEqual(['fine']);
    expect(src.release).toHaveBeenCalledWith('blob:broken');
  });

  it('reads at most LIBRARY_PICTURES_MAX pictures', async () => {
    const src = source();
    const encode = vi.fn(async () => 'data:image/jpeg;base64,QQ==');
    const elements = Array.from({ length: LIBRARY_PICTURES_MAX + 5 }, (_, i) => pic(`p${i}`, 10));
    const out = await libraryPictures({ width: 10, height: 10, elements }, src, encode);
    expect(Object.keys(out)).toHaveLength(LIBRARY_PICTURES_MAX);
  });
});
