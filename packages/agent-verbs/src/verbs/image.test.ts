import { describe, expect, it } from 'vitest';
import { contextOf, fakeApi } from '../testing/fake-api';
import { imageLs, sizeText } from './image';

const image = (id: string, createdAt: number, originalName: string, byteSize: number) => ({
  id,
  contentType: 'image/png',
  byteSize,
  width: 1280,
  height: 800,
  originalName,
  createdAt,
});

describe('image ls', () => {
  it('lists the gallery newest first, filtered by name, and says when more matched', async () => {
    const api = fakeApi({
      '/images': {
        images: [
          image('a1', 1, 'Screenshot one.png', 512),
          image('b2', 2, 'Screenshot two.png', 245_760),
          image('c3', 3, 'Logo.png', 3_250_000),
        ],
      },
    });
    const hit = await imageLs.run!(
      contextOf(api),
      imageLs.input.parse({ query: 'screenshot', limit: '1' }),
    );
    expect(imageLs.text!(hit)).toEqual([
      'b2  1280x800  240 KB  "Screenshot two.png"',
      '… 1 more; --limit 2, or narrow the name',
    ]);
    expect(imageLs.quiet!(hit)).toEqual(['b2']);
    const all = await imageLs.run!(contextOf(api), imageLs.input.parse({}));
    expect(all.images.map((i) => i.id)).toEqual(['c3', 'b2', 'a1']);
  });

  it('says how pictures get there when there are none', async () => {
    const api = fakeApi({ '/images': {} });
    const none = await imageLs.run!(contextOf(api), imageLs.input.parse({}));
    expect(imageLs.text!(none)).toEqual(['no images; upload them in the editor']);
  });
});

describe('sizeText', () => {
  it('reads bytes, kilobytes and megabytes', () => {
    expect(sizeText(512)).toBe('512 B');
    expect(sizeText(245_760)).toBe('240 KB');
    expect(sizeText(3_250_000)).toBe('3.1 MB');
  });
});
